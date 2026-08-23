namespace TaskManager.Domain.Board;

public sealed class WeekWorkspace
{
    private WeekWorkspace()
    {
    }

    public Guid Id { get; private set; }

    public DateOnly WeekStartDate { get; private set; }

    public string LanesJson { get; private set; } = "[]";

    public DateTime CreatedAtUtc { get; private set; }

    public DateTime UpdatedAtUtc { get; private set; }

    public static WeekWorkspace Create(DateOnly weekStartDate)
    {
        var normalizedWeekStartDate = ToMonday(weekStartDate);
        var now = DateTime.UtcNow;

        return new WeekWorkspace
        {
            Id = Guid.NewGuid(),
            WeekStartDate = normalizedWeekStartDate,
            LanesJson = "[]",
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };
    }

    public void UpdateLanes(string lanesJson)
    {
        LanesJson = string.IsNullOrWhiteSpace(lanesJson) ? "[]" : lanesJson;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    private static DateOnly ToMonday(DateOnly date)
    {
        while (date.DayOfWeek != DayOfWeek.Monday)
        {
            date = date.AddDays(-1);
        }

        return date;
    }
}