using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace TaskManager.Infrastructure.Persistence;

public sealed class TaskManagerDbContextFactory : IDesignTimeDbContextFactory<TaskManagerDbContext>
{
    public TaskManagerDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<TaskManagerDbContext>();

        var connectionString = Environment.GetEnvironmentVariable("CONNECTIONSTRINGS__DEFAULTCONNECTION")
            ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? "Host=localhost;Port=5432;Database=taskmanager;Username=taskmanager;Password=taskmanager";

        optionsBuilder.UseNpgsql(connectionString);
        return new TaskManagerDbContext(optionsBuilder.Options);
    }
}