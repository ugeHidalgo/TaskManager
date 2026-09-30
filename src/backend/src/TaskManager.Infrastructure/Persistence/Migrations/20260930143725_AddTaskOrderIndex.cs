using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManager.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskOrderIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "order_index",
                table: "tasks",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql("""
                WITH ranked_tasks AS (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY week_workspace_id, day_date
                               ORDER BY created_at_utc, id) - 1 AS normalized_order_index
                    FROM tasks
                )
                UPDATE tasks
                SET order_index = ranked_tasks.normalized_order_index
                FROM ranked_tasks
                WHERE tasks.id = ranked_tasks.id;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_tasks_week_workspace_id_day_date_order_index",
                table: "tasks",
                columns: new[] { "week_workspace_id", "day_date", "order_index" });

            migrationBuilder.Sql("""
                CREATE UNIQUE INDEX "IX_tasks_lane_order_unique"
                ON tasks (week_workspace_id, (COALESCE(day_date, DATE '0001-01-01')), order_index);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_tasks_week_workspace_id_day_date_order_index",
                table: "tasks");

            migrationBuilder.Sql("DROP INDEX IF EXISTS \"IX_tasks_lane_order_unique\";");

            migrationBuilder.DropColumn(
                name: "order_index",
                table: "tasks");
        }
    }
}
