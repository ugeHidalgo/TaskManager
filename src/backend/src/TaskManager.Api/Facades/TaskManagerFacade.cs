using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using TaskManager.Api.Contracts;
using TaskManager.Application.Auth;
using TaskManager.Application.Board;
using TaskManager.Domain.Board;
using TaskManager.Infrastructure.Persistence;

namespace TaskManager.Api.Facades;

public sealed class TaskManagerFacade
{
    public IResult GetHealth()
    {
        return Results.Ok(ApiSuccessResponse<object>.Create(new { status = "ok" }, "system"));
    }

    public async Task<IResult> LoginAsync(
        LoginRequest request,
        IAuthService authService,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return Results.BadRequest(ApiErrorResponse.Create(
                code: "auth.validation",
                message: "Username and password are required.",
                requestId: httpContext.TraceIdentifier));
        }

        var token = await authService.LoginAsync(request.Username, request.Password, cancellationToken);
        if (token is null)
        {
            return Results.Json(
                ApiErrorResponse.Create(
                    code: "auth.invalid_credentials",
                    message: "Invalid username or password.",
                    requestId: httpContext.TraceIdentifier),
                statusCode: StatusCodes.Status401Unauthorized);
        }

        return Results.Ok(ApiSuccessResponse<AuthToken>.Create(token, httpContext.TraceIdentifier));
    }

    public async Task<IResult> GetBoardAsync(
        HttpContext httpContext,
        TaskManagerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var requestedWeekStartDate = ResolveWeekStartDate(httpContext);

        var workspace = await dbContext.WeekWorkspaces
            .SingleOrDefaultAsync(w => w.WeekStartDate == requestedWeekStartDate, cancellationToken);

        if (workspace is null)
        {
            workspace = WeekWorkspace.Create(requestedWeekStartDate);
            dbContext.WeekWorkspaces.Add(workspace);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var lanes = DeserializeLanes(workspace.LanesJson);

        var payload = new
        {
            weekStartDate = requestedWeekStartDate,
            lanes,
        };

        return Results.Ok(ApiSuccessResponse<object>.Create(payload, httpContext.TraceIdentifier));
    }

    public async Task<IResult> SaveBoardAsync(
        HttpContext httpContext,
        SaveBoardRequest request,
        TaskManagerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (request.Lanes.ValueKind != JsonValueKind.Array)
        {
            return Results.BadRequest(ApiErrorResponse.Create(
                code: "board.validation",
                message: "Lanes must be a JSON array.",
                requestId: httpContext.TraceIdentifier));
        }

        var weekStartDate = ToMonday(request.WeekStartDate);
        var workspace = await dbContext.WeekWorkspaces
            .SingleOrDefaultAsync(w => w.WeekStartDate == weekStartDate, cancellationToken);

        if (workspace is null)
        {
            workspace = WeekWorkspace.Create(weekStartDate);
            dbContext.WeekWorkspaces.Add(workspace);
        }

        workspace.UpdateLanes(request.Lanes.GetRawText());
        await dbContext.SaveChangesAsync(cancellationToken);

        var payload = new
        {
            weekStartDate,
            lanes = DeserializeLanes(workspace.LanesJson),
        };

        return Results.Ok(ApiSuccessResponse<object>.Create(payload, httpContext.TraceIdentifier));
    }

    public async Task<IResult> GetTasksAsync(
        HttpContext httpContext,
        TaskManagerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var weekStartDate = ResolveWeekStartDate(httpContext, "weekStartDate");
        var workspace = await dbContext.WeekWorkspaces
            .SingleOrDefaultAsync(candidate => candidate.WeekStartDate == weekStartDate, cancellationToken);

        var tasks = workspace is null
            ? []
            : await dbContext.Tasks
                .Where(task => task.WeekWorkspaceId == workspace.Id)
                .OrderBy(task => task.OrderIndex)
                .ThenBy(task => task.CreatedAtUtc)
                .ThenBy(task => task.DayDate)
                .ThenBy(task => task.Id)
                .Select(task => ToTaskResponse(task))
                .ToListAsync(cancellationToken);

        return Results.Ok(ApiSuccessResponse<IReadOnlyList<TaskResponse>>.Create(
            tasks,
            httpContext.TraceIdentifier));
    }

    public async Task<IResult> CreateTaskAsync(
        HttpContext httpContext,
        CreateTaskRequest request,
        TaskManagerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        try
        {
            var weekStartDate = ToMonday(request.WeekStartDate);
            var workspace = await GetOrCreateWorkspaceAsync(dbContext, weekStartDate, cancellationToken);
            var orderIndex = await GetNextOrderIndexAsync(
                dbContext,
                workspace.Id,
                request.DayDate,
                cancellationToken);
            var task = TaskItem.Create(
                workspace.Id,
                weekStartDate,
                request.Title,
                request.DayDate,
                request.Notes,
                request.Status,
                request.ExecutionTime);
            task.SetOrderIndex(orderIndex);

            dbContext.Tasks.Add(task);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.Created(
                $"/api/v1/tasks/{task.Id}",
                ApiSuccessResponse<TaskResponse>.Create(ToTaskResponse(task), httpContext.TraceIdentifier));
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(ApiErrorResponse.Create(
                code: "task.validation",
                message: exception.Message,
                requestId: httpContext.TraceIdentifier));
        }
    }

    public async Task<IResult> CreateRecurringTasksAsync(
        HttpContext httpContext,
        CreateRecurringTasksRequest request,
        TaskManagerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var batchId = httpContext.Request.Headers["Idempotency-Key"].ToString().Trim();
        if (string.IsNullOrWhiteSpace(batchId) || batchId.Length > 100)
        {
            return Results.BadRequest(ApiErrorResponse.Create(
                code: "task.idempotency_key_required",
                message: "An idempotency key is required for recurring task creation.",
                requestId: httpContext.TraceIdentifier));
        }

        try
        {
            if (request.StartDate > request.EndDate)
            {
                throw new ArgumentException("Start date must be on or before end date.", nameof(request));
            }

            var existingTasks = await dbContext.Tasks
                .Where(task => task.BatchId == batchId)
                .OrderBy(task => task.DayDate)
                .ToListAsync(cancellationToken);
            if (existingTasks.Count > 0)
            {
                return Results.Ok(ApiSuccessResponse<RecurringTasksResponse>.Create(
                    ToRecurringTasksResponse(existingTasks),
                    httpContext.TraceIdentifier));
            }

            await using var transaction = dbContext.Database.IsRelational()
                ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
                : null;
            var generatedTasks = new List<TaskItem>();
            var affectedWeekStartDates = new HashSet<DateOnly>();
            var workspacesByWeek = new Dictionary<DateOnly, WeekWorkspace>();

            for (var date = request.StartDate; date <= request.EndDate; date = date.AddDays(1))
            {
                var weekStartDate = ToMonday(date);
                if (!workspacesByWeek.TryGetValue(weekStartDate, out var workspace))
                {
                    workspace = await GetOrCreateWorkspaceAsync(dbContext, weekStartDate, cancellationToken);
                    workspacesByWeek.Add(weekStartDate, workspace);
                }
                var task = TaskItem.Create(
                    workspace.Id,
                    weekStartDate,
                    request.Title,
                    date,
                    request.Notes,
                    request.Status,
                    request.ExecutionTime,
                    batchId);
                task.SetOrderIndex(await GetNextOrderIndexAsync(
                    dbContext,
                    workspace.Id,
                    date,
                    cancellationToken));
                generatedTasks.Add(task);
                affectedWeekStartDates.Add(weekStartDate);
                dbContext.Tasks.Add(task);
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }

            return Results.Created(
                "/api/v1/tasks/recurring",
                ApiSuccessResponse<RecurringTasksResponse>.Create(
                    ToRecurringTasksResponse(generatedTasks, affectedWeekStartDates),
                    httpContext.TraceIdentifier));
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(ApiErrorResponse.Create(
                code: "task.validation",
                message: exception.Message,
                requestId: httpContext.TraceIdentifier));
        }
    }

    public async Task<IResult> ReorderTasksAsync(
        HttpContext httpContext,
        ReorderTasksRequest request,
        TaskManagerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var weekStartDate = ToMonday(request.WeekStartDate);
        if (request.DayDate is not null
            && (request.DayDate.Value < weekStartDate || request.DayDate.Value > weekStartDate.AddDays(6)))
        {
            return Results.BadRequest(ApiErrorResponse.Create(
                code: "task.order.invalid_lane",
                message: "The requested lane must be within the selected week.",
                requestId: httpContext.TraceIdentifier));
        }

        if (request.TaskIds is null || request.TaskIds.Distinct().Count() != request.TaskIds.Count)
        {
            return Results.BadRequest(ApiErrorResponse.Create(
                code: "task.order.invalid_sequence",
                message: "Submit each task in the lane exactly once, in the desired order.",
                requestId: httpContext.TraceIdentifier));
        }

        try
        {
            await using var transaction = dbContext.Database.IsRelational()
                ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
                : null;
            var workspace = await dbContext.WeekWorkspaces
                .SingleOrDefaultAsync(candidate => candidate.WeekStartDate == weekStartDate, cancellationToken);
            var laneTasks = workspace is null
                ? []
                : await dbContext.Tasks
                    .Where(task => task.WeekWorkspaceId == workspace.Id && task.DayDate == request.DayDate)
                    .OrderBy(task => task.OrderIndex)
                    .ThenBy(task => task.Id)
                    .ToListAsync(cancellationToken);

            if (request.TaskIds.Count != laneTasks.Count
                || !request.TaskIds.ToHashSet().SetEquals(laneTasks.Select(task => task.Id)))
            {
                return Results.BadRequest(ApiErrorResponse.Create(
                    code: "task.order.invalid_sequence",
                    message: "The task list must contain every task in the selected lane and no others. Reload the lane and try again.",
                    requestId: httpContext.TraceIdentifier));
            }

            var laneTasksById = laneTasks.ToDictionary(task => task.Id);
            var sequenceChanged = request.TaskIds
                .Where((taskId, index) => laneTasks[index].Id != taskId)
                .Any();

            if (sequenceChanged)
            {
                if (transaction is not null)
                {
                    var temporaryStart = (long)laneTasks.Max(task => task.OrderIndex) + laneTasks.Count + 1;
                    if (temporaryStart + laneTasks.Count - 1 > int.MaxValue)
                    {
                        return Results.Conflict(ApiErrorResponse.Create(
                            code: "task.order.conflict",
                            message: "The lane order could not be updated. Reload the lane and try again.",
                            requestId: httpContext.TraceIdentifier));
                    }

                    for (var index = 0; index < laneTasks.Count; index++)
                    {
                        laneTasks[index].SetOrderIndex((int)(temporaryStart + index));
                    }

                    await dbContext.SaveChangesAsync(cancellationToken);
                }

                for (var index = 0; index < request.TaskIds.Count; index++)
                {
                    laneTasksById[request.TaskIds[index]].SetOrderIndex(index);
                }

                await dbContext.SaveChangesAsync(cancellationToken);
            }

            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }

            var orderedTasks = request.TaskIds.Select(taskId => laneTasksById[taskId]);
            return Results.Ok(ApiSuccessResponse<ReorderedTaskLaneResponse>.Create(
                new ReorderedTaskLaneResponse(
                    weekStartDate,
                    request.DayDate,
                    orderedTasks.Select(ToTaskResponse).ToArray()),
                httpContext.TraceIdentifier));
        }
        catch (DbUpdateException)
        {
            return Results.Conflict(ApiErrorResponse.Create(
                code: "task.order.conflict",
                message: "The lane order changed while the request was being processed. Reload the lane and try again.",
                requestId: httpContext.TraceIdentifier));
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            return Results.Json(
                ApiErrorResponse.Create(
                    code: "task.order.unexpected",
                    message: "The lane order could not be updated. Please reload and try again.",
                    requestId: httpContext.TraceIdentifier),
                statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IResult> UpdateTaskAsync(
        Guid taskId,
        HttpContext httpContext,
        UpdateTaskRequest request,
        TaskManagerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var weekStartDate = ToMonday(request.WeekStartDate);
        var workspace = await dbContext.WeekWorkspaces
            .SingleOrDefaultAsync(candidate => candidate.WeekStartDate == weekStartDate, cancellationToken);
        var task = workspace is null
            ? null
            : await dbContext.Tasks.SingleOrDefaultAsync(
                candidate => candidate.Id == taskId && candidate.WeekWorkspaceId == workspace.Id,
                cancellationToken);

        if (task is null)
        {
            return Results.NotFound(ApiErrorResponse.Create(
                code: "task.not_found",
                message: "Task was not found in the selected week.",
                requestId: httpContext.TraceIdentifier));
        }

        try
        {
            var sourceDayDate = task.DayDate;
            task.Update(
                weekStartDate,
                request.Title,
                request.DayDate,
                request.Notes,
                request.Status,
                request.ExecutionTime);
            if (sourceDayDate != task.DayDate)
            {
                await NormalizeLaneAsync(
                    dbContext,
                    task.WeekWorkspaceId,
                    sourceDayDate,
                    task.Id,
                    cancellationToken);
                task.SetOrderIndex(await GetNextOrderIndexAsync(
                    dbContext,
                    task.WeekWorkspaceId,
                    task.DayDate,
                    cancellationToken,
                    task.Id));
            }
            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.Ok(ApiSuccessResponse<TaskResponse>.Create(
                ToTaskResponse(task),
                httpContext.TraceIdentifier));
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(ApiErrorResponse.Create(
                code: "task.validation",
                message: exception.Message,
                requestId: httpContext.TraceIdentifier));
        }
    }

    public async Task<MoveTaskResponse> MoveTaskAsync(
        MoveTaskCommand command,
        TaskManagerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await MoveTaskAsync(command, null, null, false, dbContext, cancellationToken);
    }

    public async Task<IResult> MoveTaskEndpointAsync(
        Guid taskId,
        HttpContext httpContext,
        MoveTaskRequest request,
        TaskManagerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.SourceSnapshotVersion))
            {
                return Results.BadRequest(ApiErrorResponse.Create(
                    "task.move.validation",
                    "A source snapshot version is required.",
                    httpContext.TraceIdentifier));
            }

            var result = await MoveTaskAsync(
                new MoveTaskCommand(
                    taskId,
                    new TaskLanePosition(request.SourceWeekStartDate, request.SourceDayDate, request.SourceIndex),
                    new TaskLanePosition(request.DestinationWeekStartDate, request.DestinationDayDate, request.DestinationIndex)),
                request.SourceSnapshotVersion,
                request.DestinationSnapshotVersion,
                true,
                dbContext,
                cancellationToken);

            return Results.Ok(ApiSuccessResponse<MoveTaskResponse>.Create(result, httpContext.TraceIdentifier));
        }
        catch (MoveTaskConflictException exception)
        {
            return Results.Conflict(ApiErrorResponse.Create("task.move.conflict", exception.Message, httpContext.TraceIdentifier));
        }
        catch (ArgumentOutOfRangeException exception)
        {
            return Results.BadRequest(ApiErrorResponse.Create("task.move.invalid_position", exception.Message, httpContext.TraceIdentifier));
        }
        catch (InvalidOperationException exception)
        {
            var code = exception.Message.Contains("not found", StringComparison.OrdinalIgnoreCase)
                ? "task.not_found"
                : "task.move.invalid_position";
            return Results.BadRequest(ApiErrorResponse.Create(code, exception.Message, httpContext.TraceIdentifier));
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(ApiErrorResponse.Create("task.move.validation", exception.Message, httpContext.TraceIdentifier));
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            return Results.Json(
                ApiErrorResponse.Create("task.move.unexpected", "The task could not be moved. Please reload and try again.", httpContext.TraceIdentifier),
                statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    private async Task<MoveTaskResponse> MoveTaskAsync(
        MoveTaskCommand command,
        string? expectedSourceSnapshotVersion,
        string? expectedDestinationSnapshotVersion,
        bool validateVersions,
        TaskManagerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;

        var sourceWorkspace = await dbContext.WeekWorkspaces
            .SingleOrDefaultAsync(
                workspace => workspace.WeekStartDate == command.Source.WeekStartDate,
                cancellationToken)
            ?? throw new InvalidOperationException("The task source week was not found.");
        await ValidateSnapshotVersionAsync(dbContext, sourceWorkspace, expectedSourceSnapshotVersion, validateVersions, cancellationToken);
        var sourceLane = await GetOrderedLaneAsync(
            dbContext,
            sourceWorkspace.Id,
            command.Source.DayDate,
            cancellationToken);
        if (command.Source.Index >= sourceLane.Count
            || sourceLane[command.Source.Index].Id != command.TaskId)
        {
            throw new InvalidOperationException("The task is not at the requested source position.");
        }

        var task = sourceLane[command.Source.Index];
        var sameWeek = command.Destination.WeekStartDate == sourceWorkspace.WeekStartDate;
        var destinationWorkspace = sameWeek
            ? sourceWorkspace
            : await dbContext.WeekWorkspaces.SingleOrDefaultAsync(
                workspace => workspace.WeekStartDate == command.Destination.WeekStartDate,
                cancellationToken);
        if (destinationWorkspace is not null)
        {
            await ValidateSnapshotVersionAsync(
                dbContext,
                destinationWorkspace,
                expectedDestinationSnapshotVersion,
                validateVersions,
                cancellationToken);
        }
        else if (!string.IsNullOrWhiteSpace(expectedDestinationSnapshotVersion))
        {
            throw new MoveTaskConflictException("The destination week changed. Reload it and try again.");
        }
        var sameLane = sameWeek
            && command.Source.DayDate == command.Destination.DayDate;
        var destinationLane = sameLane
            ? sourceLane
            : destinationWorkspace is null
                ? []
                : await GetOrderedLaneAsync(
                    dbContext,
                    destinationWorkspace.Id,
                    command.Destination.DayDate,
                    cancellationToken);
        var destinationWithoutTask = sameLane
            ? sourceLane.Where(candidate => candidate.Id != task.Id).ToList()
            : destinationLane;

        if (command.Destination.Index > destinationWithoutTask.Count)
        {
            throw new ArgumentOutOfRangeException(
                nameof(command),
                "Destination index must identify a position in the destination lane.");
        }

        destinationWorkspace ??= await GetOrCreateWorkspaceAsync(
            dbContext,
            command.Destination.WeekStartDate,
            cancellationToken);

        var destinationOrderedTasks = destinationWithoutTask.ToList();
        destinationOrderedTasks.Insert(command.Destination.Index, task);
        var affectedTasks = sourceLane
            .Concat(sameLane ? [] : destinationLane)
            .DistinctBy(candidate => candidate.Id)
            .ToArray();
        var temporaryStart = (long)affectedTasks.Max(candidate => candidate.OrderIndex)
            + affectedTasks.Length + 1;
        if (temporaryStart + affectedTasks.Length - 1 > int.MaxValue)
        {
            throw new InvalidOperationException("The affected task lanes cannot be safely reindexed.");
        }

        for (var index = 0; index < affectedTasks.Length; index++)
        {
            affectedTasks[index].SetOrderIndex((int)(temporaryStart + index));
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        task.MoveTo(
            destinationWorkspace.Id,
            command.Destination.WeekStartDate,
            command.Destination.DayDate);
        if (sameLane)
        {
            SetLaneOrder(destinationOrderedTasks);
        }
        else
        {
            var sourceRemainingTasks = sourceLane.Where(candidate => candidate.Id != task.Id).ToList();
            SetLaneOrder(sourceRemainingTasks);
            SetLaneOrder(destinationOrderedTasks);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        var sourceSnapshot = await CreateWeekSnapshotAsync(dbContext, sourceWorkspace, cancellationToken);
        var destinationSnapshot = sameWeek
            ? sourceSnapshot
            : await CreateWeekSnapshotAsync(dbContext, destinationWorkspace, cancellationToken);
        return new MoveTaskResponse(task.Id, sourceSnapshot, destinationSnapshot);
    }

    public async Task<IResult> DeleteTaskAsync(
        Guid taskId,
        HttpContext httpContext,
        TaskManagerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var weekStartDate = ResolveWeekStartDate(httpContext, "weekStartDate");
        var workspace = await dbContext.WeekWorkspaces
            .SingleOrDefaultAsync(candidate => candidate.WeekStartDate == weekStartDate, cancellationToken);
        var task = workspace is null
            ? null
            : await dbContext.Tasks.SingleOrDefaultAsync(
                candidate => candidate.Id == taskId && candidate.WeekWorkspaceId == workspace.Id,
                cancellationToken);

        if (task is null)
        {
            return Results.NotFound(ApiErrorResponse.Create(
                code: "task.not_found",
                message: "Task was not found in the selected week.",
                requestId: httpContext.TraceIdentifier));
        }

        await NormalizeLaneAsync(
            dbContext,
            task.WeekWorkspaceId,
            task.DayDate,
            task.Id,
            cancellationToken);
        dbContext.Tasks.Remove(task);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<WeekWorkspace> GetOrCreateWorkspaceAsync(
        TaskManagerDbContext dbContext,
        DateOnly weekStartDate,
        CancellationToken cancellationToken)
    {
        var workspace = await dbContext.WeekWorkspaces
            .SingleOrDefaultAsync(candidate => candidate.WeekStartDate == weekStartDate, cancellationToken);
        if (workspace is not null)
        {
            return workspace;
        }

        workspace = WeekWorkspace.Create(weekStartDate);
        dbContext.WeekWorkspaces.Add(workspace);
        return workspace;
    }

    private static TaskResponse ToTaskResponse(TaskItem task)
    {
        return new TaskResponse(
            task.Id,
            task.WeekWorkspaceId,
            task.DayDate,
            task.Title,
            task.Notes,
            task.Status,
            task.ExecutionTime,
            task.OrderIndex,
            task.CreatedAtUtc,
            task.UpdatedAtUtc);
    }

    private static async Task<int> GetNextOrderIndexAsync(
        TaskManagerDbContext dbContext,
        Guid workspaceId,
        DateOnly? dayDate,
        CancellationToken cancellationToken,
        Guid? excludedTaskId = null)
    {
        var query = dbContext.Tasks
            .Where(task => task.WeekWorkspaceId == workspaceId && task.DayDate == dayDate);
        if (excludedTaskId is not null)
        {
            query = query.Where(task => task.Id != excludedTaskId.Value);
        }

        var maximumOrderIndex = await query
            .Select(task => (int?)task.OrderIndex)
            .MaxAsync(cancellationToken);
        return (maximumOrderIndex ?? -1) + 1;
    }

    private static async Task<List<TaskItem>> GetOrderedLaneAsync(
        TaskManagerDbContext dbContext,
        Guid workspaceId,
        DateOnly? dayDate,
        CancellationToken cancellationToken)
    {
        return await dbContext.Tasks
            .Where(task => task.WeekWorkspaceId == workspaceId && task.DayDate == dayDate)
            .OrderBy(task => task.OrderIndex)
            .ThenBy(task => task.Id)
            .ToListAsync(cancellationToken);
    }

    private static async Task ValidateSnapshotVersionAsync(
        TaskManagerDbContext dbContext,
        WeekWorkspace workspace,
        string? expectedSnapshotVersion,
        bool required,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(expectedSnapshotVersion))
        {
            if (!required)
            {
                return;
            }

            throw new ArgumentException("A source and destination snapshot version are required.");
        }

        var snapshot = await CreateWeekSnapshotAsync(dbContext, workspace, cancellationToken);
        if (!string.Equals(snapshot.SnapshotVersion, expectedSnapshotVersion, StringComparison.Ordinal))
        {
            throw new MoveTaskConflictException("The week changed while the request was being prepared. Reload and try again.");
        }
    }

    private static async Task<WeekTaskSnapshot> CreateWeekSnapshotAsync(
        TaskManagerDbContext dbContext,
        WeekWorkspace workspace,
        CancellationToken cancellationToken)
    {
        var tasks = await dbContext.Tasks
            .Where(task => task.WeekWorkspaceId == workspace.Id)
            .OrderBy(task => task.DayDate)
            .ThenBy(task => task.OrderIndex)
            .ThenBy(task => task.Id)
            .ToListAsync(cancellationToken);
        var taskResponses = tasks.Select(ToTaskResponse).ToArray();
        var snapshotContent = new StringBuilder(workspace.WeekStartDate.ToString("O"));
        foreach (var task in taskResponses)
        {
            snapshotContent.Append('|')
                .Append(task.Id)
                .Append('|').Append(task.DayDate?.ToString("O") ?? "shared")
                .Append('|').Append(task.OrderIndex)
                .Append('|').Append(task.Title)
                .Append('|').Append(task.Notes)
                .Append('|').Append(task.Status)
                .Append('|').Append(task.ExecutionTime)
                .Append('|').Append(task.UpdatedAtUtc.ToUniversalTime().Ticks);
        }

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(snapshotContent.ToString()));
        return new WeekTaskSnapshot(
            workspace.WeekStartDate,
            Convert.ToHexString(hash),
            taskResponses);
    }

    private static void SetLaneOrder(IReadOnlyList<TaskItem> tasks)
    {
        for (var index = 0; index < tasks.Count; index++)
        {
            tasks[index].SetOrderIndex(index);
        }
    }

    private static async Task NormalizeLaneAsync(
        TaskManagerDbContext dbContext,
        Guid workspaceId,
        DateOnly? dayDate,
        Guid excludedTaskId,
        CancellationToken cancellationToken)
    {
        var tasks = await dbContext.Tasks
            .Where(task => task.WeekWorkspaceId == workspaceId
                && task.DayDate == dayDate
                && task.Id != excludedTaskId)
            .OrderBy(task => task.OrderIndex)
            .ThenBy(task => task.CreatedAtUtc)
            .ThenBy(task => task.Id)
            .ToListAsync(cancellationToken);

        for (var index = 0; index < tasks.Count; index++)
        {
            tasks[index].SetOrderIndex(index);
        }
    }

    private static RecurringTasksResponse ToRecurringTasksResponse(
        IReadOnlyList<TaskItem> tasks,
        IEnumerable<DateOnly>? affectedWeekStartDates = null)
    {
        var weeks = (affectedWeekStartDates ?? tasks.Select(task => task.DayDate!.Value).Select(ToMonday))
            .Distinct()
            .OrderBy(date => date)
            .ToArray();
        return new RecurringTasksResponse(
            tasks.Count,
            tasks.Select(ToTaskResponse).ToArray(),
            weeks);
    }

    private static DateOnly ResolveWeekStartDate(HttpContext httpContext, string queryParameter = "week_start_date")
    {
        var queryValue = httpContext.Request.Query[queryParameter].ToString();

        if (DateOnly.TryParse(queryValue, out var parsedDate))
        {
            return ToMonday(parsedDate);
        }

        return ToMonday(DateOnly.FromDateTime(DateTime.UtcNow));
    }

    private static DateOnly ToMonday(DateOnly date)
    {
        while (date.DayOfWeek != DayOfWeek.Monday)
        {
            date = date.AddDays(-1);
        }

        return date;
    }

    private static JsonElement DeserializeLanes(string lanesJson)
    {
        try
        {
            var lanes = JsonSerializer.Deserialize<JsonElement>(lanesJson);
            if (lanes.ValueKind == JsonValueKind.Array)
            {
                return lanes;
            }
        }
        catch (JsonException)
        {
        }

        return JsonSerializer.Deserialize<JsonElement>("[]");
    }

    public IResult GetCurrentUser(HttpContext httpContext)
    {
        var username = httpContext.User.Identity?.Name
            ?? httpContext.User.FindFirst("unique_name")?.Value
            ?? "unknown";

        return Results.Ok(ApiSuccessResponse<object>.Create(new { username }, httpContext.TraceIdentifier));
    }

    private sealed class MoveTaskConflictException(string message) : Exception(message);
}