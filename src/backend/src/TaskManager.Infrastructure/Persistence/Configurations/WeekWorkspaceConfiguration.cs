using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManager.Domain.Board;

namespace TaskManager.Infrastructure.Persistence.Configurations;

public sealed class WeekWorkspaceConfiguration : IEntityTypeConfiguration<WeekWorkspace>
{
    public void Configure(EntityTypeBuilder<WeekWorkspace> builder)
    {
        builder.ToTable("week_workspaces");

        builder.HasKey(w => w.Id);
        builder.Property(w => w.Id)
            .HasColumnName("id");

        builder.Property(w => w.WeekStartDate)
            .HasColumnName("week_start_date")
            .IsRequired();

        builder.Property(w => w.LanesJson)
            .HasColumnName("lanes_json")
            .HasColumnType("jsonb")
            .IsRequired();

        builder.Property(w => w.CreatedAtUtc)
            .HasColumnName("created_at_utc")
            .IsRequired();

        builder.Property(w => w.UpdatedAtUtc)
            .HasColumnName("updated_at_utc")
            .IsRequired();

        builder.HasIndex(w => w.WeekStartDate)
            .IsUnique();
    }
}