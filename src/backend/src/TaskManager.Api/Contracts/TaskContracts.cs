namespace TaskManager.Api.Contracts;

public sealed record CreateTaskRequest(
    DateOnly WeekStartDate,
    string Title,
    DateOnly? DayDate,
    string? Notes,
    string? Status);

public sealed record UpdateTaskRequest(
    DateOnly WeekStartDate,
    string Title,
    DateOnly? DayDate,
    string? Notes,
    string? Status);

public sealed record TaskResponse(
    Guid Id,
    Guid WeekWorkspaceId,
    DateOnly? DayDate,
    string Title,
    string? Notes,
    string Status,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);
