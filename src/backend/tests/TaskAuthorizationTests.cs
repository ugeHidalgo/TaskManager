using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TaskManager.Api.Facades;
using TaskManager.Application.Auth;
using TaskManager.Application.Board;
using TaskManager.Domain.Board;
using TaskManager.Infrastructure.Persistence;
using Xunit;

namespace TaskManager.Tests;

public sealed class TaskAuthorizationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> factory;

    public TaskAuthorizationTests(WebApplicationFactory<Program> factory)
    {
        this.factory = factory.WithWebHostBuilder(builder =>
            builder
                .UseEnvironment("Development")
                .UseSetting("Jwt:Secret", "zQ7mR4vN8xK2pL6sW9cF3hJ5dG1bY0uA")
                .ConfigureAppConfiguration((_, configuration) =>
                    configuration.AddInMemoryCollection(new Dictionary<string, string?>
                    {
                        ["Jwt:Secret"] = "zQ7mR4vN8xK2pL6sW9cF3hJ5dG1bY0uA",
                    })));
    }

    [Fact]
    public async Task GetTasks_ReturnsUnauthorizedEnvelopeWithoutToken()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/v1/tasks?weekStartDate=2026-08-24");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(
            "auth.unauthorized",
            body.RootElement.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task ReorderTasks_ReturnsUnauthorizedEnvelopeWithoutToken()
    {
        using var client = factory.CreateClient();
        var request = new
        {
            weekStartDate = "2026-08-24",
            dayDate = "2026-08-26",
            taskIds = Array.Empty<Guid>(),
        };

        var response = await client.PutAsJsonAsync("/api/v1/tasks/reorder", request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(
            "auth.unauthorized",
            body.RootElement.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task MoveTask_ReturnsUnauthorizedEnvelopeWithoutToken()
    {
        using var client = factory.CreateClient();
        var request = new
        {
            sourceWeekStartDate = "2026-08-24",
            sourceDayDate = "2026-08-26",
            sourceIndex = 0,
            destinationWeekStartDate = "2026-08-31",
            destinationDayDate = (string?)null,
            destinationIndex = 0,
            sourceSnapshotVersion = "source-version",
            destinationSnapshotVersion = (string?)null,
        };

        var response = await client.PostAsJsonAsync(
            $"/api/v1/tasks/{Guid.NewGuid()}/move",
            request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(
            "auth.unauthorized",
            body.RootElement.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task ReorderTasks_PersistsAuthenticatedSameLaneOrder()
    {
        DateOnly weekStartDate;
        Guid workspaceId;
        Guid firstTaskId;
        Guid secondTaskId;
        DateTime firstUpdatedAtUtc;
        DateTime secondUpdatedAtUtc;
        var dayDate = default(DateOnly);

        await using (var seedScope = factory.Services.CreateAsyncScope())
        {
            var dbContext = seedScope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
            do
            {
                var candidate = GetRandomWeekStartDate();
                weekStartDate = candidate;
            }
            while (await dbContext.WeekWorkspaces.AnyAsync(workspace => workspace.WeekStartDate == weekStartDate));

            dayDate = weekStartDate.AddDays(2);
            var workspace = WeekWorkspace.Create(weekStartDate);
            var firstTask = TaskItem.Create(workspace.Id, weekStartDate, "First", dayDate, "Keep first", "Completed", "08:30");
            var secondTask = TaskItem.Create(workspace.Id, weekStartDate, "Second", dayDate, "Keep second", "In Progress", "09:30");
            firstTask.SetOrderIndex(0);
            secondTask.SetOrderIndex(1);
            workspaceId = workspace.Id;
            firstTaskId = firstTask.Id;
            secondTaskId = secondTask.Id;
            firstUpdatedAtUtc = firstTask.UpdatedAtUtc;
            secondUpdatedAtUtc = secondTask.UpdatedAtUtc;
            dbContext.WeekWorkspaces.Add(workspace);
            dbContext.Tasks.AddRange(firstTask, secondTask);
            await dbContext.SaveChangesAsync();
        }

        try
        {
            string token;
            using (var tokenScope = factory.Services.CreateScope())
            {
                token = tokenScope.ServiceProvider.GetRequiredService<IJwtTokenService>()
                    .CreateToken(Guid.NewGuid(), "reorder-test")
                    .Token;
            }

            using var client = factory.CreateClient();
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            var request = new
            {
                weekStartDate = weekStartDate.ToString("yyyy-MM-dd"),
                dayDate = dayDate.ToString("yyyy-MM-dd"),
                taskIds = new[] { secondTaskId, firstTaskId },
            };

            var response = await client.PutAsJsonAsync("/api/v1/tasks/reorder", request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal(
                new[] { secondTaskId, firstTaskId },
                body.RootElement.GetProperty("data").GetProperty("tasks")
                    .EnumerateArray().Select(task => task.GetProperty("id").GetGuid()));

            await using var verificationScope = factory.Services.CreateAsyncScope();
            var verificationContext = verificationScope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
            var persistedTasks = await verificationContext.Tasks
                .Where(task => task.WeekWorkspaceId == workspaceId)
                .OrderBy(task => task.OrderIndex)
                .ToListAsync();
            Assert.Equal(new[] { secondTaskId, firstTaskId }, persistedTasks.Select(task => task.Id));
            Assert.Equal(secondUpdatedAtUtc, persistedTasks[0].UpdatedAtUtc);
            Assert.Equal(firstUpdatedAtUtc, persistedTasks[1].UpdatedAtUtc);
            Assert.Equal("Completed", persistedTasks[1].Status);
            Assert.Equal("Keep first", persistedTasks[1].Notes);
            Assert.Equal("08:30", persistedTasks[1].ExecutionTime);
        }
        finally
        {
            await using var cleanupScope = factory.Services.CreateAsyncScope();
            var cleanupContext = cleanupScope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
            cleanupContext.Tasks.RemoveRange(await cleanupContext.Tasks
                .Where(task => task.WeekWorkspaceId == workspaceId)
                .ToListAsync());
            var workspace = await cleanupContext.WeekWorkspaces
                .SingleOrDefaultAsync(candidate => candidate.Id == workspaceId);
            if (workspace is not null)
            {
                cleanupContext.WeekWorkspaces.Remove(workspace);
            }

            await cleanupContext.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task UpdateTask_ReturnsUnauthorizedEnvelopeWithoutToken()
    {
        DateOnly weekStartDate;
        Guid taskId;
        Guid workspaceId;
        DateOnly? originalDayDate;
        string originalTitle;
        string? originalNotes;
        string originalStatus;
        DateTime originalCreatedAtUtc;
        DateTime originalUpdatedAtUtc;

        await using (var seedScope = factory.Services.CreateAsyncScope())
        {
            var dbContext = seedScope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
            do
            {
                weekStartDate = GetRandomWeekStartDate();
            }
            while (await dbContext.WeekWorkspaces.AnyAsync(workspace => workspace.WeekStartDate == weekStartDate));

            var workspace = WeekWorkspace.Create(weekStartDate);
            var task = TaskItem.Create(workspace.Id, weekStartDate, "Protected task", notes: "Original notes");
            taskId = task.Id;
            workspaceId = workspace.Id;
            originalDayDate = task.DayDate;
            originalTitle = task.Title;
            originalNotes = task.Notes;
            originalStatus = task.Status;
            originalCreatedAtUtc = task.CreatedAtUtc;
            originalUpdatedAtUtc = task.UpdatedAtUtc;
            dbContext.WeekWorkspaces.Add(workspace);
            dbContext.Tasks.Add(task);
            await dbContext.SaveChangesAsync();
        }

        try
        {
            using var client = factory.CreateClient();
            var request = new
            {
                weekStartDate = weekStartDate.ToString("yyyy-MM-dd"),
                title = "Attempted unauthorized update",
                dayDate = (string?)null,
                notes = "Changed notes",
                status = "Completed",
            };

            var response = await client.PutAsJsonAsync($"/api/v1/tasks/{taskId}", request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal(
                "auth.unauthorized",
                body.RootElement.GetProperty("error").GetProperty("code").GetString());

            await using var verificationScope = factory.Services.CreateAsyncScope();
            var verificationContext = verificationScope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
            var unchangedTask = await verificationContext.Tasks.SingleAsync(task => task.Id == taskId);
            var unchangedWorkspace = await verificationContext.WeekWorkspaces.SingleAsync(workspace => workspace.Id == workspaceId);

            Assert.Equal(workspaceId, unchangedTask.WeekWorkspaceId);
            Assert.Equal(weekStartDate, unchangedWorkspace.WeekStartDate);
            Assert.Equal(originalTitle, unchangedTask.Title);
            Assert.Equal(originalNotes, unchangedTask.Notes);
            Assert.Equal(originalStatus, unchangedTask.Status);
            Assert.Equal(originalDayDate, unchangedTask.DayDate);
            Assert.Equal(originalCreatedAtUtc, unchangedTask.CreatedAtUtc);
            Assert.Equal(originalUpdatedAtUtc, unchangedTask.UpdatedAtUtc);
        }
        finally
        {
            await using var cleanupScope = factory.Services.CreateAsyncScope();
            var cleanupContext = cleanupScope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
            var seededTask = await cleanupContext.Tasks.SingleOrDefaultAsync(task => task.Id == taskId);
            if (seededTask is not null)
            {
                cleanupContext.Tasks.Remove(seededTask);
            }

            var seededWorkspace = await cleanupContext.WeekWorkspaces
                .SingleOrDefaultAsync(workspace => workspace.WeekStartDate == weekStartDate);
            if (seededWorkspace is not null)
            {
                cleanupContext.WeekWorkspaces.Remove(seededWorkspace);
            }

            await cleanupContext.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task DeleteTask_ReturnsUnauthorizedEnvelopeWithoutToken()
    {
        DateOnly weekStartDate;
        Guid taskId;

        await using (var seedScope = factory.Services.CreateAsyncScope())
        {
            var dbContext = seedScope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
            do
            {
                weekStartDate = GetRandomWeekStartDate();
            }
            while (await dbContext.WeekWorkspaces.AnyAsync(workspace => workspace.WeekStartDate == weekStartDate));

            var workspace = WeekWorkspace.Create(weekStartDate);
            var task = TaskItem.Create(workspace.Id, weekStartDate, "Protected delete task");
            taskId = task.Id;
            dbContext.WeekWorkspaces.Add(workspace);
            dbContext.Tasks.Add(task);
            await dbContext.SaveChangesAsync();
        }

        try
        {
            using var client = factory.CreateClient();
            var response = await client.DeleteAsync(
                $"/api/v1/tasks/{taskId}?weekStartDate={weekStartDate:yyyy-MM-dd}");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal(
                "auth.unauthorized",
                body.RootElement.GetProperty("error").GetProperty("code").GetString());

            await using var verificationScope = factory.Services.CreateAsyncScope();
            var verificationContext = verificationScope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
            Assert.NotNull(await verificationContext.Tasks.SingleOrDefaultAsync(task => task.Id == taskId));
        }
        finally
        {
            await using var cleanupScope = factory.Services.CreateAsyncScope();
            var cleanupContext = cleanupScope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
            var seededTask = await cleanupContext.Tasks.SingleOrDefaultAsync(task => task.Id == taskId);
            if (seededTask is not null)
            {
                cleanupContext.Tasks.Remove(seededTask);
            }

            var seededWorkspace = await cleanupContext.WeekWorkspaces
                .SingleOrDefaultAsync(workspace => workspace.WeekStartDate == weekStartDate);
            if (seededWorkspace is not null)
            {
                cleanupContext.WeekWorkspaces.Remove(seededWorkspace);
            }

            await cleanupContext.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task MoveTaskAsync_PersistsCrossWeekLaneReindexingInRelationalTransaction()
    {
        DateOnly sourceWeek;
        DateOnly destinationWeek;
        Guid sourceWorkspaceId;
        Guid destinationWorkspaceId;
        Guid movedTaskId;
        Guid sourceRemainingTaskId;
        Guid destinationTaskId;

        await using (var seedScope = factory.Services.CreateAsyncScope())
        {
            var dbContext = seedScope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
            do
            {
                sourceWeek = GetRandomWeekStartDate();
                destinationWeek = sourceWeek.AddDays(7);
            }
            while (await dbContext.WeekWorkspaces.AnyAsync(workspace =>
                workspace.WeekStartDate == sourceWeek || workspace.WeekStartDate == destinationWeek));

            var sourceWorkspace = WeekWorkspace.Create(sourceWeek);
            var destinationWorkspace = WeekWorkspace.Create(destinationWeek);
            var sourceRemainingTask = TaskItem.Create(sourceWorkspace.Id, sourceWeek, "Source remains", sourceWeek.AddDays(1));
            var movedTask = TaskItem.Create(sourceWorkspace.Id, sourceWeek, "Move across weeks", sourceWeek.AddDays(1));
            var destinationTask = TaskItem.Create(destinationWorkspace.Id, destinationWeek, "Destination remains", destinationWeek.AddDays(2));
            sourceRemainingTask.SetOrderIndex(0);
            movedTask.SetOrderIndex(1);
            destinationTask.SetOrderIndex(0);
            sourceWorkspaceId = sourceWorkspace.Id;
            destinationWorkspaceId = destinationWorkspace.Id;
            movedTaskId = movedTask.Id;
            sourceRemainingTaskId = sourceRemainingTask.Id;
            destinationTaskId = destinationTask.Id;
            dbContext.WeekWorkspaces.AddRange(sourceWorkspace, destinationWorkspace);
            dbContext.Tasks.AddRange(sourceRemainingTask, movedTask, destinationTask);
            await dbContext.SaveChangesAsync();
        }

        try
        {
            await using (var moveScope = factory.Services.CreateAsyncScope())
            {
                var dbContext = moveScope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
                await new TaskManagerFacade().MoveTaskAsync(
                    new MoveTaskCommand(
                        movedTaskId,
                        new TaskLanePosition(sourceWeek, sourceWeek.AddDays(1), 1),
                        new TaskLanePosition(destinationWeek, destinationWeek.AddDays(2), 0)),
                    dbContext,
                    CancellationToken.None);
            }

            await using var verificationScope = factory.Services.CreateAsyncScope();
            var verificationContext = verificationScope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
            var sourceTasks = await verificationContext.Tasks
                .Where(task => task.WeekWorkspaceId == sourceWorkspaceId)
                .OrderBy(task => task.OrderIndex)
                .ToListAsync();
            var destinationTasks = await verificationContext.Tasks
                .Where(task => task.WeekWorkspaceId == destinationWorkspaceId)
                .OrderBy(task => task.OrderIndex)
                .ToListAsync();

            Assert.Equal(new[] { sourceRemainingTaskId }, sourceTasks.Select(task => task.Id));
            Assert.Equal(new[] { movedTaskId, destinationTaskId }, destinationTasks.Select(task => task.Id));
            Assert.Equal(new[] { 0 }, sourceTasks.Select(task => task.OrderIndex));
            Assert.Equal(new[] { 0, 1 }, destinationTasks.Select(task => task.OrderIndex));
            Assert.Equal(destinationWorkspaceId, destinationTasks[0].WeekWorkspaceId);
            Assert.Equal(destinationWeek.AddDays(2), destinationTasks[0].DayDate);
        }
        finally
        {
            await using var cleanupScope = factory.Services.CreateAsyncScope();
            var cleanupContext = cleanupScope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
            cleanupContext.Tasks.RemoveRange(await cleanupContext.Tasks
                .Where(task => task.WeekWorkspaceId == sourceWorkspaceId
                    || task.WeekWorkspaceId == destinationWorkspaceId)
                .ToListAsync());
            cleanupContext.WeekWorkspaces.RemoveRange(await cleanupContext.WeekWorkspaces
                .Where(workspace => workspace.Id == sourceWorkspaceId || workspace.Id == destinationWorkspaceId)
                .ToListAsync());
            await cleanupContext.SaveChangesAsync();
        }
    }

    private static DateOnly GetRandomWeekStartDate()
    {
        var date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(Random.Shared.Next(365, 36500)));
        var daysSinceMonday = ((int)date.DayOfWeek + 6) % 7;
        return date.AddDays(-daysSinceMonday);
    }
}