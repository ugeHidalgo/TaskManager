using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using TaskManager.Domain.Board;
using TaskManager.Infrastructure.Persistence;
using Xunit;

namespace TaskManager.Tests;

public sealed class TaskItemPersistenceTests
{
    [Fact]
    public void ExecutionTime_IsRequiredAndHasEmptyDatabaseDefault()
    {
        var options = new DbContextOptionsBuilder<TaskManagerDbContext>()
            .UseNpgsql("Host=localhost;Database=TaskManagerTests;Username=test;Password=test")
            .Options;
        using var dbContext = new TaskManagerDbContext(options);

        var property = dbContext.Model
            .FindEntityType(typeof(TaskItem))!
            .FindProperty(nameof(TaskItem.ExecutionTime))!;

        Assert.False(property.IsNullable);
        Assert.Equal(string.Empty, property.GetDefaultValue());
        Assert.Equal(
            "execution_time",
            property.GetColumnName(StoreObjectIdentifier.Table("tasks", schema: null)));
    }
}