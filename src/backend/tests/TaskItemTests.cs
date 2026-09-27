using TaskManager.Domain.Board;
using Xunit;

namespace TaskManager.Tests;

public sealed class TaskItemTests
{
    private static readonly DateOnly WeekStart = new(2026, 8, 17);
    private static readonly Guid WorkspaceId = Guid.NewGuid();

    [Fact]
    public void Create_UsesDefaultStatus_AndAllowsSharedWeekPlacement()
    {
        var task = TaskItem.Create(WorkspaceId, WeekStart, "Plan sprint");

        Assert.NotEqual(Guid.Empty, task.Id);
        Assert.Equal(WorkspaceId, task.WeekWorkspaceId);
        Assert.Null(task.DayDate);
        Assert.Equal("Plan sprint", task.Title);
        Assert.Null(task.Notes);
        Assert.Equal("Not Started", task.Status);
        Assert.Equal(string.Empty, task.ExecutionTime);
    }

    [Theory]
    [InlineData("")]
    [InlineData("00:00")]
    [InlineData("09:30")]
    [InlineData("23:59")]
    public void Create_PreservesValidExecutionTime(string executionTime)
    {
        var task = TaskItem.Create(WorkspaceId, WeekStart, "Plan sprint", executionTime: executionTime);

        Assert.Equal(executionTime, task.ExecutionTime);
    }

    [Theory]
    [InlineData("9:30")]
    [InlineData("09:60")]
    [InlineData("24:00")]
    [InlineData("24:01")]
    [InlineData("25:00")]
    [InlineData(" 09:30")]
    public void Create_RejectsMalformedExecutionTime(string executionTime)
    {
        var exception = Assert.Throws<ArgumentException>(() =>
            TaskItem.Create(WorkspaceId, WeekStart, "Plan sprint", executionTime: executionTime));

        Assert.Equal("executionTime", exception.ParamName);
    }

    [Fact]
    public void Create_AllowsDayPlacementWithinSelectedWeek()
    {
        var task = TaskItem.Create(
            WorkspaceId,
            new DateOnly(2026, 8, 19),
            "Review pull request",
            new DateOnly(2026, 8, 21),
            "Check the API contract");

        Assert.Equal(new DateOnly(2026, 8, 21), task.DayDate);
        Assert.Equal("Check the API contract", task.Notes);
        Assert.Equal("Not Started", task.Status);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_RejectsMissingTitle(string title)
    {
        var exception = Assert.Throws<ArgumentException>(() =>
            TaskItem.Create(WorkspaceId, WeekStart, title));

        Assert.Equal("title", exception.ParamName);
    }

    [Fact]
    public void Create_RejectsDayOutsideSelectedWeek()
    {
        var exception = Assert.Throws<ArgumentException>(() =>
            TaskItem.Create(WorkspaceId, WeekStart, "Plan sprint", new DateOnly(2026, 8, 24)));

        Assert.Equal("dayDate", exception.ParamName);
    }

    [Fact]
    public void Create_RejectsUnknownStatus()
    {
        var exception = Assert.Throws<ArgumentException>(() =>
            TaskItem.Create(WorkspaceId, WeekStart, "Plan sprint", status: "Blocked"));

        Assert.Equal("status", exception.ParamName);
    }

    [Fact]
    public void Update_ChangesPlacementAndNormalizesValues()
    {
        var task = TaskItem.Create(WorkspaceId, WeekStart, "Draft notes");

        task.Update(
            WeekStart,
            "  Finalize notes  ",
            new DateOnly(2026, 8, 18),
            "  Ready for review  ",
            "In Progress");

        Assert.Equal("Finalize notes", task.Title);
        Assert.Equal("Ready for review", task.Notes);
        Assert.Equal("In Progress", task.Status);
        Assert.Equal(new DateOnly(2026, 8, 18), task.DayDate);
    }

    [Fact]
    public void Update_RejectsMalformedExecutionTimeWithoutChangingPriorValues()
    {
        var task = TaskItem.Create(
            WorkspaceId,
            WeekStart,
            "Existing title",
            notes: "Existing notes",
            status: "Not Started",
            executionTime: "09:30");

        var exception = Assert.Throws<ArgumentException>(() =>
            task.Update(
                WeekStart,
                "Changed title",
                new DateOnly(2026, 8, 18),
                "Changed notes",
                "In Progress",
                executionTime: "24:00"));

        Assert.Equal("executionTime", exception.ParamName);
            Assert.StartsWith("Execution time must be empty or within the range 00:00 - 23:59.", exception.Message);
        Assert.Equal("Existing title", task.Title);
        Assert.Equal("Existing notes", task.Notes);
        Assert.Equal("Not Started", task.Status);
        Assert.Null(task.DayDate);
        Assert.Equal("09:30", task.ExecutionTime);
    }

    [Fact]
    public void Update_AllowsClearingExecutionTime()
    {
        var task = TaskItem.Create(WorkspaceId, WeekStart, "Plan sprint", executionTime: "09:30");

        task.Update(WeekStart, "Plan sprint", null, null, null, executionTime: string.Empty);

        Assert.Equal(string.Empty, task.ExecutionTime);
    }
}
