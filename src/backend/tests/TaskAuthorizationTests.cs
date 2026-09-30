using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
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
        var weekStart = default(DateOnly);
        var workspaceId = Guid.Empty;
        var taskId = Guid.Empty;
        var dayDate = default(DateOnly);

        await using (var seedScope = factory.Services.CreateAsyncScope())
        {
            var dbContext = seedScope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
            do
            {
                weekStart = GetRandomWeekStartDate();
            }
            while (await dbContext.WeekWorkspaces.AnyAsync(workspace => workspace.WeekStartDate == weekStart));

            dayDate = weekStart.AddDays(2);
            var workspace = WeekWorkspace.Create(weekStart);
            var task = TaskItem.Create(workspace.Id, weekStart, "Unauthorized move", dayDate);
            workspaceId = workspace.Id;
            taskId = task.Id;
            dbContext.WeekWorkspaces.Add(workspace);
            dbContext.Tasks.Add(task);
            await dbContext.SaveChangesAsync();
        }

        try
        {
            using var client = factory.CreateClient();
            var request = new
            {
                sourceWeekStartDate = weekStart.ToString("yyyy-MM-dd"),
                sourceDayDate = dayDate.ToString("yyyy-MM-dd"),
                sourceIndex = 0,
                destinationWeekStartDate = weekStart.AddDays(7).ToString("yyyy-MM-dd"),
                destinationDayDate = (string?)null,
                destinationIndex = 0,
                sourceSnapshotVersion = "source-version",
                destinationSnapshotVersion = (string?)null,
            };

            var response = await client.PostAsJsonAsync($"/api/v1/tasks/{taskId}/move", request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal(
                "auth.unauthorized",
                body.RootElement.GetProperty("error").GetProperty("code").GetString());

            await using var verificationScope = factory.Services.CreateAsyncScope();
            var verificationContext = verificationScope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
            var persistedTask = await verificationContext.Tasks.SingleAsync(task => task.Id == taskId);
            Assert.Equal(workspaceId, persistedTask.WeekWorkspaceId);
            Assert.Equal(dayDate, persistedTask.DayDate);
            Assert.Equal(0, persistedTask.OrderIndex);
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
    public async Task MoveTask_PersistsSameWeekAndCrossWeekLaneMovesThroughApi()
    {
        DateOnly sourceWeek;
        var sourceWorkspaceId = Guid.Empty;
        var destinationWorkspaceId = Guid.Empty;
        Guid dayToDayId;
        Guid dayToSharedId;
        Guid sharedToDayId;
        Guid reorderId;
        Guid crossWeekId;
        Guid sourceRemainderId;
        Guid destinationRemainderId;
        var monday = default(DateOnly);
        var tuesday = default(DateOnly);
        var wednesday = default(DateOnly);
        var thursday = default(DateOnly);
        var destinationWeek = default(DateOnly);
        var destinationTuesday = default(DateOnly);

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

            monday = sourceWeek;
            tuesday = sourceWeek.AddDays(1);
            wednesday = sourceWeek.AddDays(2);
            thursday = sourceWeek.AddDays(3);
            destinationTuesday = destinationWeek.AddDays(1);
            var sourceWorkspace = WeekWorkspace.Create(sourceWeek);
            var destinationWorkspace = WeekWorkspace.Create(destinationWeek);
            var dayToDay = TaskItem.Create(sourceWorkspace.Id, sourceWeek, "Day to day", monday);
            var sourceRemainder = TaskItem.Create(sourceWorkspace.Id, sourceWeek, "Monday first", monday);
            var reorder = TaskItem.Create(sourceWorkspace.Id, sourceWeek, "Monday reorder", monday);
            var dayToShared = TaskItem.Create(sourceWorkspace.Id, sourceWeek, "Day to shared", tuesday);
            var sharedToDay = TaskItem.Create(sourceWorkspace.Id, sourceWeek, "Shared to day");
            var crossWeek = TaskItem.Create(sourceWorkspace.Id, sourceWeek, "Cross week", thursday);
            var destinationRemainder = TaskItem.Create(
                destinationWorkspace.Id, destinationWeek, "Destination Tuesday", destinationTuesday);
            dayToDay.SetOrderIndex(0);
            sourceRemainder.SetOrderIndex(1);
            reorder.SetOrderIndex(2);
            dayToShared.SetOrderIndex(0);
            sharedToDay.SetOrderIndex(0);
            crossWeek.SetOrderIndex(0);
            destinationRemainder.SetOrderIndex(0);
            sourceWorkspaceId = sourceWorkspace.Id;
            destinationWorkspaceId = destinationWorkspace.Id;
            dayToDayId = dayToDay.Id;
            sourceRemainderId = sourceRemainder.Id;
            reorderId = reorder.Id;
            dayToSharedId = dayToShared.Id;
            sharedToDayId = sharedToDay.Id;
            crossWeekId = crossWeek.Id;
            destinationRemainderId = destinationRemainder.Id;
            dbContext.WeekWorkspaces.AddRange(sourceWorkspace, destinationWorkspace);
            dbContext.Tasks.AddRange(
                dayToDay, sourceRemainder, reorder, dayToShared, sharedToDay, crossWeek, destinationRemainder);
            await dbContext.SaveChangesAsync();
        }

        try
        {
            string token;
            using (var tokenScope = factory.Services.CreateScope())
            {
                token = tokenScope.ServiceProvider.GetRequiredService<IJwtTokenService>()
                    .CreateToken(Guid.NewGuid(), "move-api-test")
                    .Token;
            }

            using var client = factory.CreateClient();
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

            async Task<JsonDocument> MoveAsync(
                Guid taskId,
                DateOnly fromWeek,
                DateOnly? fromDay,
                int fromIndex,
                DateOnly toWeek,
                DateOnly? toDay,
                int toIndex)
            {
                var sourceVersion = await GetSnapshotVersionAsync(client, fromWeek);
                var destinationVersion = fromWeek == toWeek
                    ? sourceVersion
                    : await GetSnapshotVersionAsync(client, toWeek);
                var response = await client.PostAsJsonAsync($"/api/v1/tasks/{taskId}/move", new
                {
                    sourceWeekStartDate = fromWeek.ToString("yyyy-MM-dd"),
                    sourceDayDate = fromDay?.ToString("yyyy-MM-dd"),
                    sourceIndex = fromIndex,
                    destinationWeekStartDate = toWeek.ToString("yyyy-MM-dd"),
                    destinationDayDate = toDay?.ToString("yyyy-MM-dd"),
                    destinationIndex = toIndex,
                    sourceSnapshotVersion = sourceVersion,
                    destinationSnapshotVersion = destinationVersion,
                });

                Assert.Equal(HttpStatusCode.OK, response.StatusCode);
                return JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            }

            using (var dayToDay = await MoveAsync(dayToDayId, sourceWeek, monday, 0, sourceWeek, tuesday, 1))
            {
                Assert.Contains(dayToDayId,
                    dayToDay.RootElement.GetProperty("data").GetProperty("destination").GetProperty("tasks")
                        .EnumerateArray().Select(task => task.GetProperty("id").GetGuid()));
            }

            using (var dayToShared = await MoveAsync(dayToSharedId, sourceWeek, tuesday, 0, sourceWeek, null, 1))
            {
                var sharedTask = Assert.Single(
                    dayToShared.RootElement.GetProperty("data").GetProperty("source").GetProperty("tasks")
                        .EnumerateArray().Where(task => task.GetProperty("id").GetGuid() == dayToSharedId));
                Assert.Null(sharedTask.GetProperty("dayDate").GetString());
            }

            using (var sharedToDay = await MoveAsync(sharedToDayId, sourceWeek, null, 0, sourceWeek, wednesday, 0))
            {
                var movedTask = Assert.Single(
                    sharedToDay.RootElement.GetProperty("data").GetProperty("destination").GetProperty("tasks")
                        .EnumerateArray().Where(task => task.GetProperty("id").GetGuid() == sharedToDayId));
                Assert.Equal(wednesday.ToString("yyyy-MM-dd"), movedTask.GetProperty("dayDate").GetString());
            }

            using (var sameLaneReorder = await MoveAsync(reorderId, sourceWeek, monday, 1, sourceWeek, monday, 0))
            {
                Assert.Equal(
                    new[] { reorderId, sourceRemainderId },
                    sameLaneReorder.RootElement.GetProperty("data").GetProperty("source").GetProperty("tasks")
                        .EnumerateArray()
                        .Where(task => task.GetProperty("dayDate").GetString() == monday.ToString("yyyy-MM-dd"))
                        .OrderBy(task => task.GetProperty("orderIndex").GetInt32())
                        .Select(task => task.GetProperty("id").GetGuid()));
            }

            using (var crossWeek = await MoveAsync(
                crossWeekId, sourceWeek, thursday, 0, destinationWeek, destinationTuesday, 1))
            {
                var snapshots = crossWeek.RootElement.GetProperty("data");
                Assert.DoesNotContain(crossWeekId,
                    snapshots.GetProperty("source").GetProperty("tasks").EnumerateArray()
                        .Select(task => task.GetProperty("id").GetGuid()));
                Assert.Equal(
                    new[] { destinationRemainderId, crossWeekId },
                    snapshots.GetProperty("destination").GetProperty("tasks").EnumerateArray()
                        .Where(task => task.GetProperty("dayDate").GetString() == destinationTuesday.ToString("yyyy-MM-dd"))
                        .OrderBy(task => task.GetProperty("orderIndex").GetInt32())
                        .Select(task => task.GetProperty("id").GetGuid()));
            }

            var sourceReload = await client.GetFromJsonAsync<JsonElement>(
                $"/api/v1/tasks?weekStartDate={sourceWeek:yyyy-MM-dd}");
            var destinationReload = await client.GetFromJsonAsync<JsonElement>(
                $"/api/v1/tasks?weekStartDate={destinationWeek:yyyy-MM-dd}");
            Assert.DoesNotContain(crossWeekId,
                sourceReload.GetProperty("data").EnumerateArray()
                    .Select(task => task.GetProperty("id").GetGuid()));
            Assert.Single(destinationReload.GetProperty("data").EnumerateArray()
                .Where(task => task.GetProperty("id").GetGuid() == crossWeekId));
            await using var verificationScope = factory.Services.CreateAsyncScope();
            var verificationContext = verificationScope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
            var persistedCrossWeekTask = await verificationContext.Tasks.SingleAsync(task => task.Id == crossWeekId);
            Assert.Equal(destinationWorkspaceId, persistedCrossWeekTask.WeekWorkspaceId);
            Assert.Equal(destinationTuesday, persistedCrossWeekTask.DayDate);
            Assert.Equal(1, persistedCrossWeekTask.OrderIndex);
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

    [Fact]
    public async Task MoveTask_StaleSnapshotReturnsConflictAndLeavesBothWeeksUnchanged()
    {
        var sourceWeek = default(DateOnly);
        var destinationWeek = default(DateOnly);
        var sourceWorkspaceId = Guid.Empty;
        var destinationWorkspaceId = Guid.Empty;
        var taskId = Guid.Empty;
        var destinationTaskId = Guid.Empty;
        DateOnly sourceDay = default;
        DateOnly destinationDay = default;

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

            sourceDay = sourceWeek.AddDays(1);
            destinationDay = destinationWeek.AddDays(1);
            var sourceWorkspace = WeekWorkspace.Create(sourceWeek);
            var destinationWorkspace = WeekWorkspace.Create(destinationWeek);
            var task = TaskItem.Create(sourceWorkspace.Id, sourceWeek, "Conflict source", sourceDay);
            var destinationTask = TaskItem.Create(destinationWorkspace.Id, destinationWeek, "Conflict destination", destinationDay);
            sourceWorkspaceId = sourceWorkspace.Id;
            destinationWorkspaceId = destinationWorkspace.Id;
            taskId = task.Id;
            destinationTaskId = destinationTask.Id;
            dbContext.WeekWorkspaces.AddRange(sourceWorkspace, destinationWorkspace);
            dbContext.Tasks.AddRange(task, destinationTask);
            await dbContext.SaveChangesAsync();
        }

        try
        {
            string token;
            using (var tokenScope = factory.Services.CreateScope())
            {
                token = tokenScope.ServiceProvider.GetRequiredService<IJwtTokenService>()
                    .CreateToken(Guid.NewGuid(), "move-conflict-test")
                    .Token;
            }

            using var client = factory.CreateClient();
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            var response = await client.PostAsJsonAsync($"/api/v1/tasks/{taskId}/move", new
            {
                sourceWeekStartDate = sourceWeek.ToString("yyyy-MM-dd"),
                sourceDayDate = sourceDay.ToString("yyyy-MM-dd"),
                sourceIndex = 0,
                destinationWeekStartDate = destinationWeek.ToString("yyyy-MM-dd"),
                destinationDayDate = destinationDay.ToString("yyyy-MM-dd"),
                destinationIndex = 1,
                sourceSnapshotVersion = "stale-source-version",
                destinationSnapshotVersion = "stale-destination-version",
            });

            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal("task.move.conflict", body.RootElement.GetProperty("error").GetProperty("code").GetString());

            await using var verificationScope = factory.Services.CreateAsyncScope();
            var verificationContext = verificationScope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
            var persistedTask = await verificationContext.Tasks.SingleAsync(task => task.Id == taskId);
            Assert.Equal(sourceWorkspaceId, persistedTask.WeekWorkspaceId);
            Assert.Equal(sourceDay, persistedTask.DayDate);
            Assert.Equal(0, persistedTask.OrderIndex);
            Assert.Equal(destinationWorkspaceId,
                (await verificationContext.Tasks.SingleAsync(task => task.Id == destinationTaskId)).WeekWorkspaceId);
            Assert.Equal(0,
                (await verificationContext.Tasks.SingleAsync(task => task.Id == destinationTaskId)).OrderIndex);
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

    [Fact]
    public async Task MoveTask_RollsBackLaneChangesWhenSecondSaveFails()
    {
        var weekStart = default(DateOnly);
        var workspaceId = Guid.Empty;
        var movedTaskId = Guid.Empty;
        var remainingTaskId = Guid.Empty;
        DateOnly sourceDay = default;
        DateOnly destinationDay = default;

        await using (var seedScope = factory.Services.CreateAsyncScope())
        {
            var dbContext = seedScope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
            do
            {
                weekStart = GetRandomWeekStartDate();
            }
            while (await dbContext.WeekWorkspaces.AnyAsync(workspace => workspace.WeekStartDate == weekStart));

            sourceDay = weekStart.AddDays(1);
            destinationDay = weekStart.AddDays(2);
            var workspace = WeekWorkspace.Create(weekStart);
            var movedTask = TaskItem.Create(workspace.Id, weekStart, "Rollback move", sourceDay);
            var remainingTask = TaskItem.Create(workspace.Id, weekStart, "Rollback remainder", sourceDay);
            movedTask.SetOrderIndex(0);
            remainingTask.SetOrderIndex(1);
            workspaceId = workspace.Id;
            movedTaskId = movedTask.Id;
            remainingTaskId = remainingTask.Id;
            dbContext.WeekWorkspaces.Add(workspace);
            dbContext.Tasks.AddRange(movedTask, remainingTask);
            await dbContext.SaveChangesAsync();
        }

        try
        {
            await using (var optionsScope = factory.Services.CreateAsyncScope())
            {
                var options = optionsScope.ServiceProvider.GetRequiredService<DbContextOptions<TaskManagerDbContext>>();
                var failingOptions = new DbContextOptionsBuilder<TaskManagerDbContext>(options)
                    .AddInterceptors(new FailOnSecondSaveChangesInterceptor())
                    .Options;
                await using var failingContext = new TaskManagerDbContext(failingOptions);
                await Assert.ThrowsAsync<InvalidOperationException>(() => new TaskManagerFacade().MoveTaskAsync(
                    new MoveTaskCommand(
                        movedTaskId,
                        new TaskLanePosition(weekStart, sourceDay, 0),
                        new TaskLanePosition(weekStart, destinationDay, 0)),
                    failingContext,
                    CancellationToken.None));
            }

            await using var verificationScope = factory.Services.CreateAsyncScope();
            var verificationContext = verificationScope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
            var tasks = await verificationContext.Tasks
                .Where(task => task.WeekWorkspaceId == workspaceId)
                .OrderBy(task => task.OrderIndex)
                .ToListAsync();
            Assert.Equal(new[] { movedTaskId, remainingTaskId }, tasks.Select(task => task.Id));
            Assert.All(tasks, task => Assert.Equal(sourceDay, task.DayDate));
            Assert.Equal(new[] { 0, 1 }, tasks.Select(task => task.OrderIndex));
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

    private static async Task<string> GetSnapshotVersionAsync(HttpClient client, DateOnly weekStartDate)
    {
        var response = await client.GetAsync($"/api/v1/board?week_start_date={weekStartDate:yyyy-MM-dd}");
        response.EnsureSuccessStatusCode();
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return body.RootElement.GetProperty("data").GetProperty("snapshotVersion").GetString()!;
    }

    private sealed class FailOnSecondSaveChangesInterceptor : SaveChangesInterceptor
    {
        private int saveCount;

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            if (Interlocked.Increment(ref saveCount) == 2)
            {
                throw new InvalidOperationException("Injected failure after the move transaction's first write.");
            }

            return ValueTask.FromResult(result);
        }
    }
}