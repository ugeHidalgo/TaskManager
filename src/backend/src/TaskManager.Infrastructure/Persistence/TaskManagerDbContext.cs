using Microsoft.EntityFrameworkCore;
using TaskManager.Domain.Board;
using TaskManager.Domain.Users;

namespace TaskManager.Infrastructure.Persistence;

public sealed class TaskManagerDbContext(DbContextOptions<TaskManagerDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<WeekWorkspace> WeekWorkspaces => Set<WeekWorkspace>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(TaskManagerDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}