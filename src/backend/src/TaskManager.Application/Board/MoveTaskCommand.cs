namespace TaskManager.Application.Board;

public sealed record TaskLanePosition
{
    public TaskLanePosition(DateOnly weekStartDate, DateOnly? dayDate, int index)
    {
        if (index < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(index), "Task lane index cannot be negative.");
        }

        WeekStartDate = ToMonday(weekStartDate);
        if (dayDate is not null
            && (dayDate.Value < WeekStartDate || dayDate.Value > WeekStartDate.AddDays(6)))
        {
            throw new ArgumentOutOfRangeException(nameof(dayDate), "Task day must belong to the selected week.");
        }

        DayDate = dayDate;
        Index = index;
    }

    public DateOnly WeekStartDate { get; }

    public DateOnly? DayDate { get; }

    public int Index { get; }

    private static DateOnly ToMonday(DateOnly date)
    {
        while (date.DayOfWeek != DayOfWeek.Monday)
        {
            date = date.AddDays(-1);
        }

        return date;
    }
}

public sealed record MoveTaskCommand
{
    public MoveTaskCommand(Guid taskId, TaskLanePosition source, TaskLanePosition destination)
    {
        if (taskId == Guid.Empty)
        {
            throw new ArgumentException("Task id is required.", nameof(taskId));
        }

        TaskId = taskId;
        Source = source ?? throw new ArgumentNullException(nameof(source));
        Destination = destination ?? throw new ArgumentNullException(nameof(destination));
    }

    public Guid TaskId { get; }

    public TaskLanePosition Source { get; }

    public TaskLanePosition Destination { get; }
}
