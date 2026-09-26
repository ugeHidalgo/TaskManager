using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using TaskManager.Api.Contracts;
using TaskManager.Api.Facades;
using TaskManager.Infrastructure.Persistence;
using Xunit;

namespace TaskManager.Tests;

public sealed class TaskApiTests
{
    private readonly TaskManagerFacade facade = new();

    [Fact]
    public async Task CreateTaskAsync_CreatesTask_AndGetTasksFiltersByWeek()
    {
        var context = CreateContext();
        await using var dbContext = CreateDbContext();
        var createRequest = new CreateTaskRequest(
            new DateOnly(2026, 8, 19),
            "  Prepare release  ",
            new DateOnly(2026, 8, 21),
            "Review checklist",
            null);

        var createResult = await facade.CreateTaskAsync(
            context,
            createRequest,
            dbContext,
            CancellationToken.None);
        var createResponse = ToResponse(createResult);

        Assert.Equal(StatusCodes.Status201Created, createResponse.StatusCode);
        Assert.Equal("Not Started", createResponse.Body.RootElement
            .GetProperty("Data").GetProperty("Status").GetString());

        context.Request.QueryString = new QueryString("?weekStartDate=2026-08-21");
        var getResult = await facade.GetTasksAsync(context, dbContext, CancellationToken.None);
        var getResponse = ToResponse(getResult);
        var tasks = getResponse.Body.RootElement.GetProperty("Data").EnumerateArray().ToArray();

        Assert.Single(tasks);
        Assert.Equal("Prepare release", tasks[0].GetProperty("Title").GetString());
        Assert.Equal("2026-08-21", tasks[0].GetProperty("DayDate").GetString());
    }

    [Fact]
    public async Task UpdateTaskAsync_UpdatesTaskValues()
    {
        var context = CreateContext();
        await using var dbContext = CreateDbContext();
        var workspace = TaskManager.Domain.Board.WeekWorkspace.Create(new DateOnly(2026, 8, 17));
        var task = TaskManager.Domain.Board.TaskItem.Create(
            workspace.Id,
            workspace.WeekStartDate,
            "Draft plan");
        dbContext.WeekWorkspaces.Add(workspace);
        dbContext.Tasks.Add(task);
        await dbContext.SaveChangesAsync();

        var result = await facade.UpdateTaskAsync(
            task.Id,
            context,
            new UpdateTaskRequest(
                new DateOnly(2026, 8, 17),
                "Final plan",
                null,
                "Ready",
                "In Progress"),
            dbContext,
            CancellationToken.None);
        var response = ToResponse(result);

        Assert.Equal(StatusCodes.Status200OK, response.StatusCode);
        Assert.Equal("Final plan", response.Body.RootElement.GetProperty("Data").GetProperty("Title").GetString());
        Assert.Equal("In Progress", response.Body.RootElement.GetProperty("Data").GetProperty("Status").GetString());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("2026-08-19")]
    public async Task UpdateTaskAsync_CompleteAndReopen_PreservesPlacementAndRelativeOrder(
        string? dayDateValue)
    {
        var weekStartDate = new DateOnly(2026, 8, 17);
        DateOnly? dayDate = dayDateValue is null ? null : DateOnly.Parse(dayDateValue);
        var databaseName = Guid.NewGuid().ToString();
        var options = new DbContextOptionsBuilder<TaskManagerDbContext>()
            .UseInMemoryDatabase(databaseName)
            .Options;
        var workspace = TaskManager.Domain.Board.WeekWorkspace.Create(weekStartDate);
        var firstTask = TaskManager.Domain.Board.TaskItem.Create(
            workspace.Id,
            weekStartDate,
            "First task",
            new DateOnly(2026, 8, 18),
            "First notes");
        var task = TaskManager.Domain.Board.TaskItem.Create(
            workspace.Id,
            weekStartDate,
            "Target task",
            dayDate,
            "Target notes");
        var lastTask = TaskManager.Domain.Board.TaskItem.Create(
            workspace.Id,
            weekStartDate,
            "Last task",
            null,
            "Last notes");
        var firstCreatedAt = new DateTime(2026, 8, 17, 8, 0, 0, DateTimeKind.Utc);
        var taskCreatedAt = firstCreatedAt.AddMinutes(1);
        var lastCreatedAt = firstCreatedAt.AddMinutes(2);

        await using (var seedContext = new TaskManagerDbContext(options))
        {
            seedContext.WeekWorkspaces.Add(workspace);
            seedContext.Tasks.AddRange(firstTask, task, lastTask);
            seedContext.Entry(firstTask).Property(item => item.CreatedAtUtc).CurrentValue = firstCreatedAt;
            seedContext.Entry(task).Property(item => item.CreatedAtUtc).CurrentValue = taskCreatedAt;
            seedContext.Entry(lastTask).Property(item => item.CreatedAtUtc).CurrentValue = lastCreatedAt;
            await seedContext.SaveChangesAsync();
        }

        var expectedTaskIds = new[] { firstTask.Id, task.Id, lastTask.Id };
        var context = CreateContext();

        foreach (var status in new[] { "Completed", "In Progress" })
        {
            await using (var updateContext = new TaskManagerDbContext(options))
            {
                var result = await facade.UpdateTaskAsync(
                    task.Id,
                    context,
                    new UpdateTaskRequest(
                        weekStartDate,
                        "Target task",
                        dayDate,
                        "Target notes",
                        status),
                    updateContext,
                    CancellationToken.None);
                var response = ToResponse(result);

                Assert.Equal(StatusCodes.Status200OK, response.StatusCode);
                Assert.Equal(status, response.Body.RootElement.GetProperty("Data").GetProperty("Status").GetString());
            }

            context.Request.QueryString = new QueryString("?weekStartDate=2026-08-17");
            await using var reloadContext = new TaskManagerDbContext(options);
            var reloadResult = await facade.GetTasksAsync(context, reloadContext, CancellationToken.None);
            var reloadResponse = ToResponse(reloadResult);
            var tasks = reloadResponse.Body.RootElement.GetProperty("Data").EnumerateArray().ToArray();
            var reloadedTask = Assert.Single(tasks, item => item.GetProperty("Id").GetGuid() == task.Id);

            Assert.Equal(expectedTaskIds, tasks.Select(item => item.GetProperty("Id").GetGuid()));
            Assert.Equal(task.Id, reloadedTask.GetProperty("Id").GetGuid());
            Assert.Equal(workspace.Id, reloadedTask.GetProperty("WeekWorkspaceId").GetGuid());
            Assert.Equal(dayDate?.ToString("yyyy-MM-dd"), reloadedTask.GetProperty("DayDate").GetString());
            Assert.Equal(status, reloadedTask.GetProperty("Status").GetString());
            Assert.Equal("Target task", reloadedTask.GetProperty("Title").GetString());
            Assert.Equal("Target notes", reloadedTask.GetProperty("Notes").GetString());
            Assert.Equal(taskCreatedAt, reloadedTask.GetProperty("CreatedAtUtc").GetDateTime());
        }
    }

    [Fact]
    public async Task CreateTaskAsync_ReturnsBadRequest_WhenTitleIsBlank()
    {
        var context = CreateContext();
        await using var dbContext = CreateDbContext();

        var result = await facade.CreateTaskAsync(
            context,
            new CreateTaskRequest(new DateOnly(2026, 8, 17), "  ", null, null, null),
            dbContext,
            CancellationToken.None);
        var response = ToResponse(result);

        Assert.Equal(StatusCodes.Status400BadRequest, response.StatusCode);
        Assert.Equal("task.validation", response.Body.RootElement.GetProperty("Error").GetProperty("Code").GetString());
        Assert.Empty(dbContext.Tasks);
    }

    [Fact]
    public async Task UpdateTaskAsync_ReturnsNotFound_WhenTaskIsOutsideSelectedWeek()
    {
        var context = CreateContext();
        await using var dbContext = CreateDbContext();
        var workspace = TaskManager.Domain.Board.WeekWorkspace.Create(new DateOnly(2026, 8, 17));
        var task = TaskManager.Domain.Board.TaskItem.Create(
            workspace.Id,
            workspace.WeekStartDate,
            "Draft plan");
        dbContext.WeekWorkspaces.Add(workspace);
        dbContext.Tasks.Add(task);
        await dbContext.SaveChangesAsync();

        var result = await facade.UpdateTaskAsync(
            task.Id,
            context,
            new UpdateTaskRequest(new DateOnly(2026, 8, 24), "Changed", null, null, null),
            dbContext,
            CancellationToken.None);
        var response = ToResponse(result);

        Assert.Equal(StatusCodes.Status404NotFound, response.StatusCode);
        Assert.Equal("task.not_found", response.Body.RootElement.GetProperty("Error").GetProperty("Code").GetString());
    }

    private static DefaultHttpContext CreateContext()
    {
        return new DefaultHttpContext
        {
            TraceIdentifier = "task-test-request"
        };
    }

    private static TaskManagerDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<TaskManagerDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new TaskManagerDbContext(options);
    }

    private static (int StatusCode, JsonDocument Body) ToResponse(IResult result)
    {
        var statusCode = (result as IStatusCodeHttpResult)?.StatusCode ?? StatusCodes.Status200OK;
        var value = (result as IValueHttpResult)?.Value;
        Assert.NotNull(value);
        return (statusCode, JsonDocument.Parse(JsonSerializer.Serialize(value)));
    }
}
