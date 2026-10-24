using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Http;
using TaskManager.Api.Contracts;
using TaskManager.Api.Facades;
using TaskManager.Application.Auth;
using TaskManager.Domain.Board;
using TaskManager.Infrastructure.Persistence;
using Xunit;

namespace TaskManager.Tests;

public sealed partial class TaskAuthorizationTests
{
    [Theory]
    [InlineData("outside")]
    [InlineData("inside")]
    [InlineData("shared")]
    [InlineData("cross-week")]
    [InlineData("normal")]
    public async Task Conversion_Http_PreservesOriginalAndOldSiblingsAndRetries(string placement)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
        var weeks = await CreateConversionWeeksAsync(db);
        var source = weeks[0];
        var start = source.WeekStartDate.AddDays(placement == "cross-week" ? 12 : 5); // Saturday through Tuesday.
        var end = start.AddDays(3);
        DateOnly? sourceDate = placement == "shared" ? null
            : placement == "inside" ? start.AddDays(1) : source.WeekStartDate;
        var oldKey = placement == "normal" ? null : Guid.NewGuid().ToString();
        var original = TaskItem.Create(source.Id, source.WeekStartDate, "Before", sourceDate,
            "Before notes", "Completed", "", oldKey);
        var sibling = TaskItem.Create(source.Id, source.WeekStartDate, "Old sibling", sourceDate,
            "Do not edit", "Not done", "", oldKey);
        sibling.SetOrderIndex(1);
        var secondSibling = TaskItem.Create(source.Id, source.WeekStartDate, "Second sibling", sourceDate,
            "Also keep", "Completed", "", oldKey);
        secondSibling.SetOrderIndex(2);
        var destinationWeek = placement == "cross-week" ? weeks[1] : source;
        var destinationTask = TaskItem.Create(destinationWeek.Id, destinationWeek.WeekStartDate,
            "Destination first", start, "Keep destination", "Completed");
        db.Tasks.AddRange(original, sibling, secondSibling, destinationTask);
        await db.SaveChangesAsync();
        await db.Entry(original).ReloadAsync();
        await db.Entry(sibling).ReloadAsync();
        var createdAt = original.CreatedAtUtc;
        var siblingUpdatedAt = sibling.UpdatedAtUtc;

        try
        {
            using var client = CreateConversionClient();
            var key = Guid.NewGuid().ToString();
            client.DefaultRequestHeaders.Add("Idempotency-Key", key);
            var request = new
            {
                weekStartDate = source.WeekStartDate,
                startDate = start,
                endDate = end,
                title = "Submitted title",
                notes = "Submitted notes",
                status = "In Progress",
                executionTime = "14:25",
            };
            var response = await client.PostAsJsonAsync($"/api/v1/tasks/{original.Id}/recurring", request);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var data = body.RootElement.GetProperty("data");
            Assert.Equal(4, data.GetProperty("createdCount").GetInt32());
            var tasks = data.GetProperty("tasks").EnumerateArray().ToArray();
            Assert.Equal(4, tasks.Select(t => t.GetProperty("id").GetGuid()).Distinct().Count());
            Assert.Equal(Enumerable.Range(0, 4).Select(i => start.AddDays(i).ToString("yyyy-MM-dd")),
                tasks.Select(t => t.GetProperty("dayDate").GetString()));
            Assert.All(tasks, t =>
            {
                Assert.Equal(request.title, t.GetProperty("title").GetString());
                Assert.Equal(request.notes, t.GetProperty("notes").GetString());
                Assert.Equal(request.status, t.GetProperty("status").GetString());
                Assert.Equal(request.executionTime, t.GetProperty("executionTime").GetString());
            });
            db.ChangeTracker.Clear();
            var persisted = await db.Tasks.SingleAsync(t => t.Id == original.Id);
            Assert.Equal(placement == "inside" ? sourceDate : start, persisted.DayDate);
            Assert.Equal(placement == "cross-week" ? weeks[1].Id : source.Id, persisted.WeekWorkspaceId);
            Assert.Equal(createdAt, persisted.CreatedAtUtc);
            Assert.Equal(key, persisted.BatchId);
            var untouched = await db.Tasks.SingleAsync(t => t.Id == sibling.Id);
            Assert.Equal("Old sibling", untouched.Title);
            Assert.Equal(oldKey, untouched.BatchId);
            Assert.Equal(siblingUpdatedAt, untouched.UpdatedAtUtc);
            Assert.Equal(placement == "inside" ? 1 : 0, untouched.OrderIndex);
            var secondUntouched = await db.Tasks.SingleAsync(t => t.Id == secondSibling.Id);
            Assert.Equal(placement == "inside" ? 2 : 1, secondUntouched.OrderIndex);
            Assert.Equal(oldKey, secondUntouched.BatchId);
            Assert.Equal("Second sibling", secondUntouched.Title);
            var firstGenerated = tasks.Single(t => t.GetProperty("dayDate").GetString() == start.ToString("yyyy-MM-dd"));
            Assert.Equal(1, firstGenerated.GetProperty("orderIndex").GetInt32());
            var beforeRetry = await ConversionSnapshotAsync(db, weeks);
            // The original may no longer belong to the submitted source week on retry.
            var retry = await client.PostAsJsonAsync($"/api/v1/tasks/{original.Id}/recurring",
                new { request.weekStartDate, startDate = end, endDate = end,
                    title = "Must not edit siblings", notes = "Changed", status = "Completed", executionTime = "01:00" });
            Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
            using var retryBody = JsonDocument.Parse(await retry.Content.ReadAsStringAsync());
            Assert.Equal(data.GetRawText(), retryBody.RootElement.GetProperty("data").GetRawText());
            Assert.Equal(beforeRetry, await ConversionSnapshotAsync(db, weeks));
        }
        finally
        {
            await CleanupConversionWeeksAsync(db, weeks);
        }
    }

    [Theory]
    [InlineData("range", HttpStatusCode.BadRequest, "task.validation")]
    [InlineData("title", HttpStatusCode.BadRequest, "task.validation")]
    [InlineData("long-title", HttpStatusCode.BadRequest, "task.validation")]
    [InlineData("long-notes", HttpStatusCode.BadRequest, "task.validation")]
    [InlineData("status", HttpStatusCode.BadRequest, "task.validation")]
    [InlineData("time", HttpStatusCode.BadRequest, "task.validation")]
    [InlineData("null-time", HttpStatusCode.BadRequest, "task.validation")]
    [InlineData("missing-key", HttpStatusCode.BadRequest, "task.idempotency_key_required")]
    [InlineData("long-key", HttpStatusCode.BadRequest, "task.idempotency_key_required")]
    [InlineData("collision", HttpStatusCode.Conflict, "task.idempotency_key_conflict")]
    [InlineData("wrong-week", HttpStatusCode.NotFound, "task.not_found")]
    [InlineData("missing-task", HttpStatusCode.NotFound, "task.not_found")]
    public async Task Conversion_Http_InvalidRequestDoesNotMutate(
        string scenario, HttpStatusCode expectedStatus, string expectedCode)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
        var weeks = await CreateConversionWeeksAsync(db);
        var source = weeks[0];
        var key = Guid.NewGuid().ToString();
        var original = TaskItem.Create(source.Id, source.WeekStartDate, "Original", source.WeekStartDate);
        var sibling = TaskItem.Create(source.Id, source.WeekStartDate, "Sibling", source.WeekStartDate,
            batchId: scenario == "collision" ? key : null);
        sibling.SetOrderIndex(1);
        db.Tasks.AddRange(original, sibling);
        await db.SaveChangesAsync();
        try
        {
            var before = await ConversionSnapshotAsync(db, weeks);
            using var client = CreateConversionClient();
            if (scenario != "missing-key")
            {
                client.DefaultRequestHeaders.Add("Idempotency-Key", scenario == "long-key" ? new string('x', 101) : key);
            }
            var taskId = scenario == "missing-task" ? Guid.NewGuid() : original.Id;
            var start = source.WeekStartDate.AddDays(12);
            var response = await client.PostAsJsonAsync($"/api/v1/tasks/{taskId}/recurring", new
            {
                weekStartDate = scenario == "wrong-week" ? weeks[1].WeekStartDate : source.WeekStartDate,
                startDate = start,
                endDate = scenario == "range" ? start.AddDays(-1) : start.AddDays(3),
                title = scenario == "title" ? " " : scenario == "long-title" ? new string('x', 201) : "Changed",
                notes = scenario == "long-notes" ? new string('x', 4001) : "Changed notes",
                status = scenario == "status" ? "Invalid" : "Completed",
                executionTime = scenario == "time" ? "24:00" : scenario == "null-time" ? null : "09:00",
            });
            Assert.Equal(expectedStatus, response.StatusCode);
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal(expectedCode, body.RootElement.GetProperty("error").GetProperty("code").GetString());
            Assert.Equal(before, await ConversionSnapshotAsync(db, weeks));
        }
        finally { await CleanupConversionWeeksAsync(db, weeks); }
    }

    [Fact]
    public async Task Conversion_Http_RequiresAuthentication()
    {
        using var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync($"/api/v1/tasks/{Guid.NewGuid()}/recurring", new
        {
            weekStartDate = "2026-08-17", startDate = "2026-08-17", endDate = "2026-08-18",
            title = "Unauthorized", notes = (string?)null, status = (string?)null, executionTime = "",
        });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("auth.unauthorized", body.RootElement.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task Conversion_Http_ConcurrentSameKeyReturnsOneBatch()
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
        var weeks = await CreateConversionWeeksAsync(db);
        var source = weeks[0];
        var original = TaskItem.Create(source.Id, source.WeekStartDate, "Original", source.WeekStartDate);
        db.Tasks.Add(original);
        await db.SaveChangesAsync();
        try
        {
            using var client = CreateConversionClient();
            var key = Guid.NewGuid().ToString();
            client.DefaultRequestHeaders.Add("Idempotency-Key", key);
            var request = new { weekStartDate = source.WeekStartDate, startDate = weeks[1].WeekStartDate,
                endDate = weeks[1].WeekStartDate.AddDays(2), title = "Batch", notes = "Notes",
                status = "Completed", executionTime = "12:00" };
            var responses = await Task.WhenAll(Enumerable.Range(0, 3)
                .Select(_ => client.PostAsJsonAsync($"/api/v1/tasks/{original.Id}/recurring", request)));
            Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Created);
            Assert.Equal(2, responses.Count(r => r.StatusCode == HttpStatusCode.OK));
            Assert.Equal(3, await db.Tasks.CountAsync(t => t.BatchId == key));
            Assert.Equal(1, await db.Tasks.CountAsync(t => t.BatchId == key && t.Id == original.Id));
            foreach (var response in responses) { response.Dispose(); }
        }
        finally { await CleanupConversionWeeksAsync(db, weeks); }
    }

    [Fact]
    public async Task Conversion_Http_CreatesMissingDestinationWorkspace()
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
        var weeks = await CreateConversionWeeksAsync(db);
        var source = weeks[0];
        var destinationDate = weeks[1].WeekStartDate;
        db.WeekWorkspaces.Remove(weeks[1]);
        var original = TaskItem.Create(source.Id, source.WeekStartDate, "Original", source.WeekStartDate);
        db.Tasks.Add(original);
        await db.SaveChangesAsync();
        try
        {
            using var client = CreateConversionClient();
            client.DefaultRequestHeaders.Add("Idempotency-Key", Guid.NewGuid().ToString());
            var response = await client.PostAsJsonAsync($"/api/v1/tasks/{original.Id}/recurring", new
            {
                weekStartDate = source.WeekStartDate, startDate = destinationDate, endDate = destinationDate.AddDays(1),
                title = "Converted", notes = "Notes", status = "Not done", executionTime = "08:00",
            });
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            db.ChangeTracker.Clear();
            var destination = await db.WeekWorkspaces.SingleAsync(w => w.WeekStartDate == destinationDate);
            var tasks = await db.Tasks.Where(t => t.WeekWorkspaceId == destination.Id).OrderBy(t => t.DayDate).ToListAsync();
            Assert.Equal(2, tasks.Count);
            Assert.Equal(original.Id, tasks[0].Id);
            Assert.Equal(destinationDate, tasks[0].DayDate);
            Assert.Equal(destinationDate.AddDays(1), tasks[1].DayDate);
            Assert.All(tasks, task => Assert.Equal("08:00", task.ExecutionTime));
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal(new[] { source.WeekStartDate.ToString("yyyy-MM-dd"), destinationDate.ToString("yyyy-MM-dd") },
                body.RootElement.GetProperty("data").GetProperty("affectedWeekStartDates").EnumerateArray().Select(w => w.GetString()));
        }
        finally
        {
            // These dates were reserved by this test before deleting/recreating its destination.
            var dates = weeks.Select(w => w.WeekStartDate).ToArray();
            var ownedWeeks = await db.WeekWorkspaces.AsNoTracking().Where(w => dates.Contains(w.WeekStartDate)).ToArrayAsync();
            await CleanupConversionWeeksAsync(db, ownedWeeks);
        }
    }

    [Fact]
    public async Task Conversion_Postgres_RollsBackAllWritesWhenFinalSaveFails()
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
        var weeks = await CreateConversionWeeksAsync(db);
        var source = weeks[0];
        var original = TaskItem.Create(source.Id, source.WeekStartDate, "Original", source.WeekStartDate);
        var sibling = TaskItem.Create(source.Id, source.WeekStartDate, "Sibling", source.WeekStartDate);
        sibling.SetOrderIndex(1);
        db.Tasks.AddRange(original, sibling);
        await db.SaveChangesAsync();
        try
        {
            var before = await ConversionSnapshotAsync(db, weeks);
            var options = scope.ServiceProvider.GetRequiredService<DbContextOptions<TaskManagerDbContext>>();
            var interceptor = new FailAfterConversionFinalSaveInterceptor();
            await using var failingDb = new TaskManagerDbContext(new DbContextOptionsBuilder<TaskManagerDbContext>(options)
                .AddInterceptors(interceptor).Options);
            var http = new DefaultHttpContext { TraceIdentifier = "conversion-rollback" };
            var key = Guid.NewGuid().ToString();
            http.Request.Headers["Idempotency-Key"] = key;
            var result = await new TaskManagerFacade().ConvertTaskToRecurringAsync(original.Id, http,
                new ConvertTaskToRecurringRequest(source.WeekStartDate, weeks[1].WeekStartDate,
                    weeks[1].WeekStartDate.AddDays(2), "Changed", "Changed", "Completed", "11:00"), failingDb, default);
            Assert.Equal(409, ((IStatusCodeHttpResult)result).StatusCode);
            Assert.Equal(2, interceptor.CompletedSaves);
            Assert.Equal(before, await ConversionSnapshotAsync(db, weeks));
            Assert.False(await db.Tasks.AnyAsync(t => t.BatchId == key));
        }
        finally { await CleanupConversionWeeksAsync(db, weeks); }
    }

    private sealed class FailAfterConversionFinalSaveInterceptor : SaveChangesInterceptor
    {
        public int CompletedSaves { get; private set; }

        public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData eventData, int result,
            CancellationToken cancellationToken = default)
        {
            CompletedSaves++;
            if (CompletedSaves == 2)
            {
                throw new DbUpdateException("Injected failure after conversion writes, before commit.");
            }
            return ValueTask.FromResult(result);
        }
    }

    private HttpClient CreateConversionClient()
    {
        var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();
        var token = scope.ServiceProvider.GetRequiredService<IJwtTokenService>()
            .CreateToken(Guid.NewGuid(), "conversion-test").Token;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private static async Task<WeekWorkspace[]> CreateConversionWeeksAsync(TaskManagerDbContext db)
    {
        DateOnly week;
        do { week = GetRandomWeekStartDate(); }
        while (await db.WeekWorkspaces.AnyAsync(w => w.WeekStartDate >= week && w.WeekStartDate <= week.AddDays(14)));
        var weeks = Enumerable.Range(0, 3).Select(i => WeekWorkspace.Create(week.AddDays(7 * i))).ToArray();
        db.WeekWorkspaces.AddRange(weeks);
        await db.SaveChangesAsync();
        return weeks;
    }

    private static async Task<string> ConversionSnapshotAsync(TaskManagerDbContext db, WeekWorkspace[] weeks)
    {
        var ids = weeks.Select(w => w.Id).ToArray();
        return JsonSerializer.Serialize(await db.Tasks.AsNoTracking().Where(t => ids.Contains(t.WeekWorkspaceId))
            .OrderBy(t => t.Id).ToListAsync());
    }

    private static async Task CleanupConversionWeeksAsync(TaskManagerDbContext db, WeekWorkspace[] weeks)
    {
        db.ChangeTracker.Clear();
        var ids = weeks.Select(w => w.Id).ToArray();
        db.Tasks.RemoveRange(await db.Tasks.Where(t => ids.Contains(t.WeekWorkspaceId)).ToListAsync());
        db.WeekWorkspaces.RemoveRange(await db.WeekWorkspaces.Where(w => ids.Contains(w.Id)).ToListAsync());
        await db.SaveChangesAsync();
    }
}