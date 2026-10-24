using TaskManager.Domain.Board;
using Xunit;

namespace TaskManager.Tests;

public sealed class TaskConversionDomainTests
{
    [Fact]
    public void Conversion_AssignBatchId_ReplacesOnlyBatchAndPreservesIdentity()
    {
        var week = new DateOnly(2026, 8, 17);
        var task = TaskItem.Create(Guid.NewGuid(), week, "Original", week, "Notes", "Completed", "09:00", "old");
        var id = task.Id;
        var createdAt = task.CreatedAtUtc;

        task.AssignBatchId(" new ");

        Assert.Equal("new", task.BatchId);
        Assert.Equal(id, task.Id);
        Assert.Equal(createdAt, task.CreatedAtUtc);
        Assert.Equal(week, task.DayDate);
        Assert.Equal("Original", task.Title);
        Assert.Equal("09:00", task.ExecutionTime);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("too-long")]
    public void Conversion_AssignBatchId_InvalidKeyDoesNotMutate(string? key)
    {
        var task = TaskItem.Create(Guid.NewGuid(), new DateOnly(2026, 8, 17), "Original", batchId: "old");
        var updatedAt = task.UpdatedAtUtc;

        Assert.Throws<ArgumentException>(() => task.AssignBatchId(key == "too-long" ? new string('x', 101) : key!));

        Assert.Equal("old", task.BatchId);
        Assert.Equal(updatedAt, task.UpdatedAtUtc);
    }
}