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

public sealed record TaskResponse(
    Guid Id,
    Guid WeekWorkspaceId,
    DateOnly? DayDate,
    string Title,
    string? Notes,
    string Status,
    string ExecutionTime,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);
