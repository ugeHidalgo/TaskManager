using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManager.Domain.Board;

namespace TaskManager.Infrastructure.Persistence.Configurations;

public sealed class TaskItemConfiguration : IEntityTypeConfiguration<TaskItem>
{
    public void Configure(EntityTypeBuilder<TaskItem> builder)
    {
        builder.ToTable("tasks");

        builder.HasKey(task => task.Id);
        builder.Property(task => task.Id)
            .HasColumnName("id");

        builder.Property(task => task.WeekWorkspaceId)
            .HasColumnName("week_workspace_id")
            .IsRequired();

        builder.Property(task => task.DayDate)
            .HasColumnName("day_date");

        builder.Property(task => task.Title)
            .HasColumnName("title")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(task => task.Notes)
            .HasColumnName("notes")
            .HasMaxLength(4000);

        builder.Property(task => task.Status)
            .HasColumnName("status")
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(task => task.CreatedAtUtc)
            .HasColumnName("created_at_utc")
            .IsRequired();

        builder.Property(task => task.UpdatedAtUtc)
            .HasColumnName("updated_at_utc")
            .IsRequired();

        builder.HasOne<WeekWorkspace>()
            .WithMany()
            .HasForeignKey(task => task.WeekWorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(task => new { task.WeekWorkspaceId, task.DayDate });
    }
}