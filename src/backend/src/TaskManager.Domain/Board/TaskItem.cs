namespace TaskManager.Domain.Board;

public sealed class TaskItem
{
    private const string DefaultStatus = "Not Started";
    private static readonly string[] AllowedStatuses = ["Not Started", "In Progress", "Completed"];

    private TaskItem()
    {
    }

    public Guid Id { get; private set; }

    public Guid WeekWorkspaceId { get; private set; }

    public DateOnly? DayDate { get; private set; }

    public string Title { get; private set; } = string.Empty;

    public string? Notes { get; private set; }

    public string Status { get; private set; } = DefaultStatus;

    public DateTime CreatedAtUtc { get; private set; }

    public DateTime UpdatedAtUtc { get; private set; }

    public static TaskItem Create(
        Guid weekWorkspaceId,
        DateOnly weekStartDate,
        string title,
        DateOnly? dayDate = null,
        string? notes = null,
        string? status = null)
    {
        ValidateWorkspaceId(weekWorkspaceId);
        var normalizedWeekStartDate = NormalizeWeekStart(weekStartDate);
        var normalizedTitle = NormalizeTitle(title);
        var normalizedNotes = NormalizeNotes(notes);
        var normalizedStatus = NormalizeStatus(status);
        ValidateDayDate(normalizedWeekStartDate, dayDate);
        var now = DateTime.UtcNow;

        return new TaskItem
        {
            Id = Guid.NewGuid(),
            WeekWorkspaceId = weekWorkspaceId,
            DayDate = dayDate,
            Title = normalizedTitle,
            Notes = normalizedNotes,
            Status = normalizedStatus,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };
    }

    public void Update(
        DateOnly weekStartDate,
        string title,
        DateOnly? dayDate,
        string? notes,
        string? status)
    {
        var normalizedWeekStartDate = NormalizeWeekStart(weekStartDate);
        ValidateDayDate(normalizedWeekStartDate, dayDate);

        Title = NormalizeTitle(title);
        Notes = NormalizeNotes(notes);
        Status = NormalizeStatus(status);
        DayDate = dayDate;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    private static void ValidateWorkspaceId(Guid weekWorkspaceId)
    {
        if (weekWorkspaceId == Guid.Empty)
        {
            throw new ArgumentException("Week workspace is required.", nameof(weekWorkspaceId));
        }
    }

    private static string NormalizeTitle(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Task title is required.", nameof(title));
        }

        return title.Trim();
    }

    private static string? NormalizeNotes(string? notes)
    {
        return string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
    }

    private static string NormalizeStatus(string? status)
    {
        var normalizedStatus = string.IsNullOrWhiteSpace(status) ? DefaultStatus : status.Trim();
        if (!AllowedStatuses.Contains(normalizedStatus, StringComparer.Ordinal))
        {
            throw new ArgumentException("Task status is invalid.", nameof(status));
        }

        return normalizedStatus;
    }

    private static void ValidateDayDate(DateOnly weekStartDate, DateOnly? dayDate)
    {
        if (dayDate is null)
        {
            return;
        }

        var weekEndDate = weekStartDate.AddDays(6);
        if (dayDate.Value < weekStartDate || dayDate.Value > weekEndDate)
        {
            throw new ArgumentException("Task day must belong to the selected week.", nameof(dayDate));
        }
    }

    private static DateOnly NormalizeWeekStart(DateOnly date)
    {
        while (date.DayOfWeek != DayOfWeek.Monday)
        {
            date = date.AddDays(-1);
        }

        return date;
    }
}