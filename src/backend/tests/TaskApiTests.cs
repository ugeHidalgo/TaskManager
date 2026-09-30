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
            null,
            "09:30");

        var createResult = await facade.CreateTaskAsync(
            context,
            createRequest,
            dbContext,
            CancellationToken.None);
        var createResponse = ToResponse(createResult);

        Assert.Equal(StatusCodes.Status201Created, createResponse.StatusCode);
        Assert.Equal("Not Started", createResponse.Body.RootElement
            .GetProperty("Data").GetProperty("Status").GetString());
        Assert.Equal("09:30", createResponse.Body.RootElement
            .GetProperty("Data").GetProperty("ExecutionTime").GetString());

        context.Request.QueryString = new QueryString("?weekStartDate=2026-08-21");
        var getResult = await facade.GetTasksAsync(context, dbContext, CancellationToken.None);
        var getResponse = ToResponse(getResult);
        var tasks = getResponse.Body.RootElement.GetProperty("Data").EnumerateArray().ToArray();

        Assert.Single(tasks);
        Assert.Equal("Prepare release", tasks[0].GetProperty("Title").GetString());
        Assert.Equal("2026-08-21", tasks[0].GetProperty("DayDate").GetString());
        Assert.Equal("09:30", tasks[0].GetProperty("ExecutionTime").GetString());
    }

    [Fact]
    public async Task CreateTaskAsync_PersistsEmptyExecutionTime()
    {
        var context = CreateContext();
        await using var dbContext = CreateDbContext();

        var result = await facade.CreateTaskAsync(
            context,
            new CreateTaskRequest(new DateOnly(2026, 8, 17), "Flexible task", null, null, null, string.Empty),
            dbContext,
            CancellationToken.None);
        var response = ToResponse(result);

        Assert.Equal(StatusCodes.Status201Created, response.StatusCode);
        Assert.Equal(string.Empty, response.Body.RootElement
            .GetProperty("Data").GetProperty("ExecutionTime").GetString());
    }

    [Fact]
    public async Task DeleteTaskAsync_CompactsOrderWithinTheSameLane()
    {
        var context = CreateContext();
        await using var dbContext = CreateDbContext();
        var dayDate = new DateOnly(2026, 8, 18);
        var taskIds = new List<Guid>();

        foreach (var title in new[] { "First", "Second", "Third" })
        {
            var result = await facade.CreateTaskAsync(
                context,
                new CreateTaskRequest(new DateOnly(2026, 8, 17), title, dayDate, null, null, string.Empty),
                dbContext,
                CancellationToken.None);

            taskIds.Add(ToResponse(result).Body.RootElement.GetProperty("Data").GetProperty("Id").GetGuid());
        }

        context.Request.QueryString = new QueryString("?weekStartDate=2026-08-17");
        var deleteResult = await facade.DeleteTaskAsync(
            taskIds[1],
            context,
            dbContext,
            CancellationToken.None);

        Assert.IsType<Microsoft.AspNetCore.Http.HttpResults.NoContent>(deleteResult);
        var remainingTasks = await dbContext.Tasks
            .Where(task => task.DayDate == dayDate)
            .OrderBy(task => task.OrderIndex)
            .ToListAsync();

        Assert.Equal(new[] { taskIds[0], taskIds[2] }, remainingTasks.Select(task => task.Id));
        Assert.Equal(new[] { 0, 1 }, remainingTasks.Select(task => task.OrderIndex));
    }

    [Fact]
    public async Task CreateTaskAsync_ClearsExecutionTimeForSharedWeekPlacement()
    {
        var context = CreateContext();
        await using var dbContext = CreateDbContext();

        var result = await facade.CreateTaskAsync(
            context,
            new CreateTaskRequest(new DateOnly(2026, 8, 17), "Shared task", null, null, null, "09:30"),
            dbContext,
            CancellationToken.None);
        var response = ToResponse(result);

        Assert.Equal(StatusCodes.Status201Created, response.StatusCode);
        Assert.Equal(string.Empty, response.Body.RootElement
            .GetProperty("Data").GetProperty("ExecutionTime").GetString());
        Assert.Equal(string.Empty, (await dbContext.Tasks.SingleAsync()).ExecutionTime);
    }

    [Fact]
    public async Task CreateRecurringTasksAsync_CreatesOneTaskPerDateAcrossWeeks()
    {
        await using var dbContext = CreateDbContext();
        var context = CreateContext();
        context.Request.Headers["Idempotency-Key"] = "batch-august-2026";

        var result = await facade.CreateRecurringTasksAsync(
            context,
            new CreateRecurringTasksRequest(
                new DateOnly(2026, 8, 21),
                new DateOnly(2026, 8, 24),
                "Daily review",
                "Same notes",
                "In Progress",
                "09:30"),
            dbContext,
            CancellationToken.None);
        var response = ToResponse(result);

        Assert.Equal(StatusCodes.Status201Created, response.StatusCode);
        var data = response.Body.RootElement.GetProperty("Data");
        Assert.Equal(4, data.GetProperty("CreatedCount").GetInt32());
        Assert.Equal(2, data.GetProperty("AffectedWeekStartDates").GetArrayLength());
        Assert.Equal(4, await dbContext.Tasks.CountAsync());
        Assert.Equal(2, await dbContext.WeekWorkspaces.CountAsync());
        Assert.Equal(
            new[] { "2026-08-21", "2026-08-22", "2026-08-23", "2026-08-24" },
            await dbContext.Tasks
                .OrderBy(task => task.DayDate)
                .Select(task => task.DayDate!.Value.ToString("yyyy-MM-dd"))
                .ToArrayAsync());
        Assert.All(await dbContext.Tasks.ToListAsync(), task =>
        {
            Assert.Equal("Daily review", task.Title);
            Assert.Equal("Same notes", task.Notes);
            Assert.Equal("In Progress", task.Status);
            Assert.Equal("09:30", task.ExecutionTime);
            Assert.Equal("batch-august-2026", task.BatchId);
        });
    }

    [Fact]
    public async Task CreateRecurringTasksAsync_ReturnsExistingBatchOnRetry()
    {
        await using var dbContext = CreateDbContext();
        var context = CreateContext();
        context.Request.Headers["Idempotency-Key"] = "retryable-batch";
        var request = new CreateRecurringTasksRequest(
            new DateOnly(2026, 8, 17),
            new DateOnly(2026, 8, 19),
            "Repeat safely",
            null,
            null,
            string.Empty);

        var firstResult = await facade.CreateRecurringTasksAsync(
            context, request, dbContext, CancellationToken.None);
        var retryResult = await facade.CreateRecurringTasksAsync(
            context, request, dbContext, CancellationToken.None);

        Assert.Equal(StatusCodes.Status201Created, (firstResult as IStatusCodeHttpResult)?.StatusCode);
        Assert.Equal(StatusCodes.Status200OK, (retryResult as IStatusCodeHttpResult)?.StatusCode);
        Assert.Equal(3, await dbContext.Tasks.CountAsync());
        Assert.Equal(
            3,
            ToResponse(retryResult).Body.RootElement
                .GetProperty("Data").GetProperty("CreatedCount").GetInt32());
    }

    [Fact]
    public async Task CreateRecurringTasksAsync_RequiresIdempotencyKey()
    {
        await using var dbContext = CreateDbContext();
        var result = await facade.CreateRecurringTasksAsync(
            CreateContext(),
            new CreateRecurringTasksRequest(
                new DateOnly(2026, 8, 17),
                new DateOnly(2026, 8, 17),
                "Missing key",
                null,
                null,
                string.Empty),
            dbContext,
            CancellationToken.None);

        var response = ToResponse(result);
        Assert.Equal(StatusCodes.Status400BadRequest, response.StatusCode);
        Assert.Equal("task.idempotency_key_required", response.Body.RootElement
            .GetProperty("Error").GetProperty("Code").GetString());
        Assert.Empty(await dbContext.Tasks.ToListAsync());
    }

    [Fact]
    public async Task CreateRecurringTasksAsync_RejectsInvertedRangeWithoutPersisting()
    {
        await using var dbContext = CreateDbContext();
        var context = CreateContext();
        context.Request.Headers["Idempotency-Key"] = "invalid-range";

        var result = await facade.CreateRecurringTasksAsync(
            context,
            new CreateRecurringTasksRequest(
                new DateOnly(2026, 8, 20),
                new DateOnly(2026, 8, 19),
                "Invalid range",
                null,
                null,
                string.Empty),
            dbContext,
            CancellationToken.None);

        var response = ToResponse(result);
        Assert.Equal(StatusCodes.Status400BadRequest, response.StatusCode);
        Assert.Empty(await dbContext.Tasks.ToListAsync());
        Assert.Empty(await dbContext.WeekWorkspaces.ToListAsync());
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
            "Draft plan",
            dayDate: new DateOnly(2026, 8, 18));
        dbContext.WeekWorkspaces.Add(workspace);
        dbContext.Tasks.Add(task);
        await dbContext.SaveChangesAsync();

        var result = await facade.UpdateTaskAsync(
            task.Id,
            context,
            new UpdateTaskRequest(
                new DateOnly(2026, 8, 17),
                "Final plan",
                new DateOnly(2026, 8, 18),
                "Ready",
                "In Progress",
                "10:30"),
            dbContext,
            CancellationToken.None);
        var response = ToResponse(result);

        Assert.Equal(StatusCodes.Status200OK, response.StatusCode);
        Assert.Equal("Final plan", response.Body.RootElement.GetProperty("Data").GetProperty("Title").GetString());
        Assert.Equal("In Progress", response.Body.RootElement.GetProperty("Data").GetProperty("Status").GetString());
        Assert.Equal("10:30", response.Body.RootElement.GetProperty("Data").GetProperty("ExecutionTime").GetString());

        var clearResult = await facade.UpdateTaskAsync(
            task.Id,
            context,
            new UpdateTaskRequest(new DateOnly(2026, 8, 17), "Final plan", new DateOnly(2026, 8, 18), "Ready", "In Progress", string.Empty),
            dbContext,
            CancellationToken.None);
        var clearResponse = ToResponse(clearResult);

        Assert.Equal(StatusCodes.Status200OK, clearResponse.StatusCode);
        Assert.Equal(string.Empty, clearResponse.Body.RootElement
            .GetProperty("Data").GetProperty("ExecutionTime").GetString());
        Assert.Equal(string.Empty, (await dbContext.Tasks.SingleAsync()).ExecutionTime);
    }

    [Fact]
    public async Task UpdateTaskAsync_ClearsExecutionTimeWhenMovingTimedTaskToSharedWeek()
    {
        var context = CreateContext();
        await using var dbContext = CreateDbContext();
        var weekStartDate = new DateOnly(2026, 8, 17);
        var workspace = TaskManager.Domain.Board.WeekWorkspace.Create(weekStartDate);
        var task = TaskManager.Domain.Board.TaskItem.Create(
            workspace.Id,
            weekStartDate,
            "Timed task",
            dayDate: new DateOnly(2026, 8, 18),
            executionTime: "09:30");
        dbContext.WeekWorkspaces.Add(workspace);
        dbContext.Tasks.Add(task);
        await dbContext.SaveChangesAsync();

        var result = await facade.UpdateTaskAsync(
            task.Id,
            context,
            new UpdateTaskRequest(
                weekStartDate,
                "Timed task",
                null,
                null,
                "Not Started",
                "09:30"),
            dbContext,
            CancellationToken.None);
        var response = ToResponse(result);

        Assert.Equal(StatusCodes.Status200OK, response.StatusCode);
        Assert.Null(response.Body.RootElement.GetProperty("Data").GetProperty("DayDate").GetString());
        Assert.Equal(string.Empty, response.Body.RootElement
            .GetProperty("Data").GetProperty("ExecutionTime").GetString());
        Assert.Equal(string.Empty, (await dbContext.Tasks.SingleAsync()).ExecutionTime);
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
            "Target notes",
            executionTime: "08:30");
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
                        status,
                        task.ExecutionTime),
                    updateContext,
                    CancellationToken.None);
                var response = ToResponse(result);

                Assert.Equal(StatusCodes.Status200OK, response.StatusCode);
                Assert.Equal(status, response.Body.RootElement.GetProperty("Data").GetProperty("Status").GetString());
                Assert.Equal(dayDate is null ? string.Empty : "08:30", response.Body.RootElement.GetProperty("Data").GetProperty("ExecutionTime").GetString());
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
            Assert.Equal(dayDate is null ? string.Empty : "08:30", reloadedTask.GetProperty("ExecutionTime").GetString());
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
            new CreateTaskRequest(new DateOnly(2026, 8, 17), "  ", null, null, null, string.Empty),
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
            new UpdateTaskRequest(new DateOnly(2026, 8, 24), "Changed", null, null, null, string.Empty),
            dbContext,
            CancellationToken.None);
        var response = ToResponse(result);

        Assert.Equal(StatusCodes.Status404NotFound, response.StatusCode);
        Assert.Equal("task.not_found", response.Body.RootElement.GetProperty("Error").GetProperty("Code").GetString());
    }

    [Fact]
    public async Task UpdateTaskAsync_RejectsInvalidExecutionTime_WithoutChangingPersistedValue()
    {
        var weekStartDate = new DateOnly(2026, 8, 17);
        var context = CreateContext();
        await using var dbContext = CreateDbContext();
        var workspace = TaskManager.Domain.Board.WeekWorkspace.Create(weekStartDate);
        var task = TaskManager.Domain.Board.TaskItem.Create(
            workspace.Id,
            weekStartDate,
            "Plan sprint",
            dayDate: new DateOnly(2026, 8, 18),
            executionTime: "09:30");
        dbContext.WeekWorkspaces.Add(workspace);
        dbContext.Tasks.Add(task);
        await dbContext.SaveChangesAsync();

        var result = await facade.UpdateTaskAsync(
            task.Id,
            context,
            new UpdateTaskRequest(weekStartDate, "Changed title", new DateOnly(2026, 8, 18), null, "In Progress", "24:00"),
            dbContext,
            CancellationToken.None);
        var response = ToResponse(result);

        Assert.Equal(StatusCodes.Status400BadRequest, response.StatusCode);
        Assert.StartsWith(
            "Execution time must be empty or within the range 00:00 - 23:59.",
            response.Body.RootElement.GetProperty("Error").GetProperty("Message").GetString());
        Assert.Equal("Plan sprint", task.Title);
        Assert.Equal("09:30", task.ExecutionTime);
        Assert.Equal("09:30", (await dbContext.Tasks.SingleAsync()).ExecutionTime);
    }

    [Fact]
    public async Task DeleteTaskAsync_RemovesTaskFromSelectedWeek()
    {
        var weekStartDate = new DateOnly(2026, 8, 17);
        await using var dbContext = CreateDbContext();
        var workspace = TaskManager.Domain.Board.WeekWorkspace.Create(weekStartDate);
        var task = TaskManager.Domain.Board.TaskItem.Create(workspace.Id, weekStartDate, "Delete me");
        dbContext.WeekWorkspaces.Add(workspace);
        dbContext.Tasks.Add(task);
        await dbContext.SaveChangesAsync();

        var context = CreateContext();
        context.Request.QueryString = new QueryString("?weekStartDate=2026-08-17");
        var result = await facade.DeleteTaskAsync(task.Id, context, dbContext, CancellationToken.None);

        Assert.Equal(StatusCodes.Status204NoContent, (result as IStatusCodeHttpResult)?.StatusCode);
        Assert.Null(await dbContext.Tasks.SingleOrDefaultAsync(candidate => candidate.Id == task.Id));
    }

    [Fact]
    public async Task DeleteTaskAsync_ReturnsNotFound_WhenTaskIsOutsideSelectedWeek()
    {
        await using var dbContext = CreateDbContext();
        var workspace = TaskManager.Domain.Board.WeekWorkspace.Create(new DateOnly(2026, 8, 17));
        var task = TaskManager.Domain.Board.TaskItem.Create(workspace.Id, workspace.WeekStartDate, "Keep me");
        dbContext.WeekWorkspaces.Add(workspace);
        dbContext.Tasks.Add(task);
        await dbContext.SaveChangesAsync();

        var context = CreateContext();
        context.Request.QueryString = new QueryString("?weekStartDate=2026-08-24");
        var result = await facade.DeleteTaskAsync(task.Id, context, dbContext, CancellationToken.None);
        var response = ToResponse(result);

        Assert.Equal(StatusCodes.Status404NotFound, response.StatusCode);
        Assert.Equal("task.not_found", response.Body.RootElement.GetProperty("Error").GetProperty("Code").GetString());
        Assert.NotNull(await dbContext.Tasks.SingleOrDefaultAsync(candidate => candidate.Id == task.Id));
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
