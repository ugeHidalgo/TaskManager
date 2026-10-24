using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using TaskManager.Api.Contracts;
using TaskManager.Api.Facades;
using TaskManager.Domain.Board;
using TaskManager.Infrastructure.Persistence;
using Xunit;

namespace TaskManager.Tests;

public sealed class TaskConversionFacadeTests
{
    [Theory]
    [InlineData(-1)]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    public async Task Conversion_Facade_PreservesIdAndCompactsOnlySourceLane(int offset)
    {
        await using var db = CreateDb();
        var week = new DateOnly(2026, 8, 17);
        var start = week.AddDays(12);
        DateOnly? day = offset < 0 ? null : offset == 0 ? week : offset == 3 ? week.AddDays(18) : start.AddDays(offset - 1);
        var sourceWeek = offset == 3 ? week.AddDays(14) : offset > 0 ? week.AddDays(7) : week;
        var source = WeekWorkspace.Create(sourceWeek);
        var original = TaskItem.Create(source.Id, sourceWeek, "Original", day, batchId: "old-key");
        var sibling = TaskItem.Create(source.Id, sourceWeek, "Old sibling", day, "Keep", "Not done", "", "old-key");
        sibling.SetOrderIndex(1);
        var otherLane = TaskItem.Create(source.Id, sourceWeek, "Other lane", sourceWeek.AddDays(1));
        db.WeekWorkspaces.Add(source);
        db.Tasks.AddRange(original, sibling, otherLane);
        await db.SaveChangesAsync();
        var createdAt = original.CreatedAtUtc;
        var siblingUpdatedAt = sibling.UpdatedAtUtc;
        var otherBefore = JsonSerializer.Serialize(otherLane);
        var http = Context("new-key");
        var request = new ConvertTaskToRecurringRequest(sourceWeek, start, start.AddDays(3),
            " Submitted ", " Notes ", "In Progress", "10:15");

        var result = await new TaskManagerFacade().ConvertTaskToRecurringAsync(original.Id, http, request, db, default);

        Assert.Equal(201, ((IStatusCodeHttpResult)result).StatusCode);
        var envelope = Assert.IsType<ApiSuccessResponse<RecurringTasksResponse>>(((IValueHttpResult)result).Value);
        var batch = envelope.Data;
        Assert.Equal(4, batch.CreatedCount);
        Assert.Equal(Enumerable.Range(0, 4).Select(i => start.AddDays(i)), batch.Tasks.Select(t => t.DayDate!.Value));
        Assert.Equal(4, batch.Tasks.Select(t => t.Id).Distinct().Count());
        Assert.Equal(offset is 1 or 2 ? day : start, original.DayDate);
        Assert.Equal(createdAt, original.CreatedAtUtc);
        Assert.Equal("new-key", original.BatchId);
        Assert.All(batch.Tasks, task =>
        {
            Assert.Equal("Submitted", task.Title);
            Assert.Equal("Notes", task.Notes);
            Assert.Equal("In Progress", task.Status);
            Assert.Equal("10:15", task.ExecutionTime);
        });
        Assert.Equal("old-key", sibling.BatchId);
        Assert.Equal("Old sibling", sibling.Title);
        Assert.Equal(siblingUpdatedAt, sibling.UpdatedAtUtc);
        Assert.Equal(offset is 1 or 2 ? 1 : 0, sibling.OrderIndex);
        Assert.Equal(otherBefore, JsonSerializer.Serialize(otherLane));
        Assert.Contains(sourceWeek, batch.AffectedWeekStartDates);
        Assert.Equal(start.AddDays(2), batch.Tasks[2].DayDate);
        var destination = await db.WeekWorkspaces.SingleAsync(w => w.Id == original.WeekWorkspaceId);
        Assert.Equal(week.AddDays(7), destination.WeekStartDate);

        var beforeRetry = await SnapshotAsync(db);
        var retry = await new TaskManagerFacade().ConvertTaskToRecurringAsync(original.Id, http,
            request with { Title = "Ignore", StartDate = start.AddDays(1) }, db, default);
        Assert.Equal(200, ((IStatusCodeHttpResult)retry).StatusCode);
        Assert.Equal(beforeRetry, await SnapshotAsync(db));
    }

    [Theory]
    [InlineData("range")]
    [InlineData("title")]
    [InlineData("status")]
    [InlineData("time")]
    [InlineData("null-time")]
    [InlineData("long-title")]
    [InlineData("long-notes")]
    [InlineData("missing-key")]
    [InlineData("long-key")]
    [InlineData("collision")]
    [InlineData("wrong-week")]
    [InlineData("missing-task")]
    public async Task Conversion_Facade_InvalidRequestDoesNotMutateEvenTrackedEntities(string scenario)
    {
        await using var db = CreateDb();
        var week = new DateOnly(2026, 8, 17);
        var workspace = WeekWorkspace.Create(week);
        var original = TaskItem.Create(workspace.Id, week, "Original", week, "Keep", "Completed", "08:00");
        var sibling = TaskItem.Create(workspace.Id, week, "Sibling", week,
            batchId: scenario == "collision" ? "key" : null);
        sibling.SetOrderIndex(1);
        db.WeekWorkspaces.Add(workspace);
        db.Tasks.AddRange(original, sibling);
        await db.SaveChangesAsync();
        var before = await SnapshotAsync(db);
        var request = new ConvertTaskToRecurringRequest(week, week.AddDays(12), week.AddDays(15), "Changed", null, null, "");
        request = scenario switch
        {
            "range" => request with { EndDate = week },
            "title" => request with { Title = " " },
            "status" => request with { Status = "Invalid" },
            "time" => request with { ExecutionTime = "24:00" },
            "null-time" => request with { ExecutionTime = null! },
            "long-title" => request with { Title = new string('x', 201) },
            "long-notes" => request with { Notes = new string('x', 4001) },
            "wrong-week" => request with { WeekStartDate = week.AddDays(7) },
            _ => request,
        };
        var http = Context(scenario == "missing-key" ? " " : scenario == "long-key" ? new string('x', 101) : "key");
        var result = await new TaskManagerFacade().ConvertTaskToRecurringAsync(
            scenario == "missing-task" ? Guid.NewGuid() : original.Id, http, request, db, default);
        var expected = scenario == "collision" ? 409 : scenario is "wrong-week" or "missing-task" ? 404 : 400;
        Assert.Equal(expected, ((IStatusCodeHttpResult)result).StatusCode);
        Assert.Equal(before, await SnapshotAsync(db));
        Assert.Single(await db.WeekWorkspaces.ToListAsync());
        Assert.All(db.ChangeTracker.Entries(), entry => Assert.Equal(EntityState.Unchanged, entry.State));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(100)]
    public async Task Conversion_Facade_AcceptsKeyBoundariesAndSingleDay(int keyLength)
    {
        await using var db = CreateDb();
        var week = new DateOnly(2026, 8, 17);
        var workspace = WeekWorkspace.Create(week);
        var original = TaskItem.Create(workspace.Id, week, "Original");
        db.WeekWorkspaces.Add(workspace);
        db.Tasks.Add(original);
        await db.SaveChangesAsync();
        var result = await new TaskManagerFacade().ConvertTaskToRecurringAsync(original.Id, Context(new string('k', keyLength)),
            new ConvertTaskToRecurringRequest(week, week, week, "Single", null, null, ""), db, default);
        Assert.Equal(201, ((IStatusCodeHttpResult)result).StatusCode);
        Assert.Single(await db.Tasks.ToListAsync());
        Assert.Equal(week, original.DayDate);
    }

    private static DefaultHttpContext Context(string key)
    {
        var http = new DefaultHttpContext { TraceIdentifier = "conversion-test" };
        http.Request.Headers["Idempotency-Key"] = key;
        return http;
    }

    private static TaskManagerDbContext CreateDb() => new(new DbContextOptionsBuilder<TaskManagerDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static async Task<string> SnapshotAsync(TaskManagerDbContext db) =>
        JsonSerializer.Serialize(await db.Tasks.OrderBy(t => t.Id).ToListAsync());
}