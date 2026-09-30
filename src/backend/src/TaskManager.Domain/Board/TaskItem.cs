namespace TaskManager.Domain.Board;

public sealed class TaskItem
{
    private const string DefaultStatus = "Not Started";
    private const string InvalidExecutionTimeMessage = "Execution time must be empty or within the range 00:00 - 23:59.";
    private static readonly string[] AllowedStatuses = ["Not Started", "In Progress", "Completed"];

    private TaskItem()
    {
    }

    public Guid Id { get; private set; }

    public Guid WeekWorkspaceId { get; private set; }

    public string? BatchId { get; private set; }

    public DateOnly? DayDate { get; private set; }

    public string Title { get; private set; } = string.Empty;

    public string? Notes { get; private set; }

    public string Status { get; private set; } = DefaultStatus;

    public string ExecutionTime { get; private set; } = string.Empty;

    public int OrderIndex { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    public DateTime UpdatedAtUtc { get; private set; }

    public static TaskItem Create(
        Guid weekWorkspaceId,
        DateOnly weekStartDate,
        string title,
        DateOnly? dayDate = null,
        string? notes = null,
        string? status = null,
        string executionTime = "",
        string? batchId = null)
    {
        ValidateWorkspaceId(weekWorkspaceId);
        var normalizedWeekStartDate = NormalizeWeekStart(weekStartDate);
        var normalizedTitle = NormalizeTitle(title);
        var normalizedNotes = NormalizeNotes(notes);
        var normalizedStatus = NormalizeStatus(status);
        ValidateDayDate(normalizedWeekStartDate, dayDate);
        var normalizedExecutionTime = dayDate is null ? string.Empty : NormalizeExecutionTime(executionTime);
        var now = DateTime.UtcNow;

        return new TaskItem
        {
            Id = Guid.NewGuid(),
            WeekWorkspaceId = weekWorkspaceId,
            BatchId = NormalizeBatchId(batchId),
            DayDate = dayDate,
            Title = normalizedTitle,
            Notes = normalizedNotes,
            Status = normalizedStatus,
            ExecutionTime = normalizedExecutionTime,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };
    }

    public void Update(
        DateOnly weekStartDate,
        string title,
        DateOnly? dayDate,
        string? notes,
        string? status,
        string executionTime = "")
    {
        var normalizedWeekStartDate = NormalizeWeekStart(weekStartDate);
        ValidateDayDate(normalizedWeekStartDate, dayDate);
        var normalizedTitle = NormalizeTitle(title);
        var normalizedNotes = NormalizeNotes(notes);
        var normalizedStatus = NormalizeStatus(status);
        var normalizedExecutionTime = dayDate is null ? string.Empty : NormalizeExecutionTime(executionTime);

        Title = normalizedTitle;
        Notes = normalizedNotes;
        Status = normalizedStatus;
        ExecutionTime = normalizedExecutionTime;
        DayDate = dayDate;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SetOrderIndex(int orderIndex)
    {
        if (orderIndex < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(orderIndex), "Task order cannot be negative.");
        }

        OrderIndex = orderIndex;
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

    private static string? NormalizeBatchId(string? batchId)
    {
        if (string.IsNullOrWhiteSpace(batchId))
        {
            return null;
        }

        var normalizedBatchId = batchId.Trim();
        if (normalizedBatchId.Length > 100)
        {
            throw new ArgumentException("Batch id is invalid.", nameof(batchId));
        }

        return normalizedBatchId;
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

    private static string NormalizeExecutionTime(string executionTime)
    {
        if (executionTime is null)
        {
            throw new ArgumentException(InvalidExecutionTimeMessage, nameof(executionTime));
        }

        if (executionTime.Length == 0)
        {
            return string.Empty;
        }

        if (executionTime.Length != 5
            || executionTime[2] != ':'
            || !char.IsAsciiDigit(executionTime[0])
            || !char.IsAsciiDigit(executionTime[1])
            || !char.IsAsciiDigit(executionTime[3])
            || !char.IsAsciiDigit(executionTime[4]))
        {
            throw new ArgumentException(InvalidExecutionTimeMessage, nameof(executionTime));
        }

        var hour = ((executionTime[0] - '0') * 10) + (executionTime[1] - '0');
        var minute = ((executionTime[3] - '0') * 10) + (executionTime[4] - '0');
        if (hour > 23 || minute > 59)
        {
            throw new ArgumentException(InvalidExecutionTimeMessage, nameof(executionTime));
        }

        return executionTime;
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