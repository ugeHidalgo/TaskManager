namespace TaskManager.Api.Contracts;

public sealed record CreateTaskRequest(
    DateOnly WeekStartDate,
    string Title,
    DateOnly? DayDate,
    string? Notes,
    string? Status,
    string ExecutionTime);

public sealed record CreateRecurringTasksRequest(
    DateOnly StartDate,
    DateOnly EndDate,
    string Title,
    string? Notes,
    string? Status,
    string ExecutionTime);

public sealed record RecurringTasksResponse(
    int CreatedCount,
    IReadOnlyList<TaskResponse> Tasks,
    IReadOnlyList<DateOnly> AffectedWeekStartDates);

public sealed record UpdateTaskRequest(
    DateOnly WeekStartDate,
    string Title,
    DateOnly? DayDate,
    string? Notes,
    string? Status,
    string ExecutionTime);

public sealed record ReorderTasksRequest(
    DateOnly WeekStartDate,
    DateOnly? DayDate,
    IReadOnlyList<Guid> TaskIds,
    string? SnapshotVersion = null);

public sealed record ReorderedTaskLaneResponse(
    DateOnly WeekStartDate,
    DateOnly? DayDate,
    IReadOnlyList<TaskResponse> Tasks);

public sealed record MoveTaskRequest(
    DateOnly SourceWeekStartDate,
    DateOnly? SourceDayDate,
    int SourceIndex,
    DateOnly DestinationWeekStartDate,
    DateOnly? DestinationDayDate,
    int DestinationIndex,
    string SourceSnapshotVersion,
    string? DestinationSnapshotVersion);

public sealed record MoveTaskResponse(
    Guid TaskId,
    WeekTaskSnapshot Source,
    WeekTaskSnapshot Destination);

public sealed record WeekTaskSnapshot(
    DateOnly WeekStartDate,
    string SnapshotVersion,
    IReadOnlyList<TaskResponse> Tasks);

public sealed record TaskResponse(
    Guid Id,
    Guid WeekWorkspaceId,
    DateOnly? DayDate,
    string Title,
    string? Notes,
    string Status,
    string ExecutionTime,
    int OrderIndex,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);
