using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using TaskManager.Api.Contracts;
using TaskManager.Application.Auth;
using TaskManager.Domain.Board;
using TaskManager.Infrastructure.Persistence;

namespace TaskManager.Api.Facades;

public sealed class TaskManagerFacade
{
    public IResult GetHealth()
    {
        return Results.Ok(ApiSuccessResponse<object>.Create(new { status = "ok" }, "system"));
    }

    public async Task<IResult> LoginAsync(
        LoginRequest request,
        IAuthService authService,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return Results.BadRequest(ApiErrorResponse.Create(
                code: "auth.validation",
                message: "Username and password are required.",
                requestId: httpContext.TraceIdentifier));
        }

        var token = await authService.LoginAsync(request.Username, request.Password, cancellationToken);
        if (token is null)
        {
            return Results.Json(
                ApiErrorResponse.Create(
                    code: "auth.invalid_credentials",
                    message: "Invalid username or password.",
                    requestId: httpContext.TraceIdentifier),
                statusCode: StatusCodes.Status401Unauthorized);
        }

        return Results.Ok(ApiSuccessResponse<AuthToken>.Create(token, httpContext.TraceIdentifier));
    }

    public async Task<IResult> GetBoardAsync(
        HttpContext httpContext,
        TaskManagerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var requestedWeekStartDate = ResolveWeekStartDate(httpContext);

        var workspace = await dbContext.WeekWorkspaces
            .SingleOrDefaultAsync(w => w.WeekStartDate == requestedWeekStartDate, cancellationToken);

        if (workspace is null)
        {
            workspace = WeekWorkspace.Create(requestedWeekStartDate);
            dbContext.WeekWorkspaces.Add(workspace);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var lanes = DeserializeLanes(workspace.LanesJson);

        var payload = new
        {
            weekStartDate = requestedWeekStartDate,
            lanes,
        };

        return Results.Ok(ApiSuccessResponse<object>.Create(payload, httpContext.TraceIdentifier));
    }

    public async Task<IResult> SaveBoardAsync(
        HttpContext httpContext,
        SaveBoardRequest request,
        TaskManagerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (request.Lanes.ValueKind != JsonValueKind.Array)
        {
            return Results.BadRequest(ApiErrorResponse.Create(
                code: "board.validation",
                message: "Lanes must be a JSON array.",
                requestId: httpContext.TraceIdentifier));
        }

        var weekStartDate = ToMonday(request.WeekStartDate);
        var workspace = await dbContext.WeekWorkspaces
            .SingleOrDefaultAsync(w => w.WeekStartDate == weekStartDate, cancellationToken);

        if (workspace is null)
        {
            workspace = WeekWorkspace.Create(weekStartDate);
            dbContext.WeekWorkspaces.Add(workspace);
        }

        workspace.UpdateLanes(request.Lanes.GetRawText());
        await dbContext.SaveChangesAsync(cancellationToken);

        var payload = new
        {
            weekStartDate,
            lanes = DeserializeLanes(workspace.LanesJson),
        };

        return Results.Ok(ApiSuccessResponse<object>.Create(payload, httpContext.TraceIdentifier));
    }

    public async Task<IResult> GetTasksAsync(
        HttpContext httpContext,
        TaskManagerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var weekStartDate = ResolveWeekStartDate(httpContext, "weekStartDate");
        var workspace = await dbContext.WeekWorkspaces
            .SingleOrDefaultAsync(candidate => candidate.WeekStartDate == weekStartDate, cancellationToken);

        var tasks = workspace is null
            ? []
            : await dbContext.Tasks
                .Where(task => task.WeekWorkspaceId == workspace.Id)
                .OrderBy(task => task.CreatedAtUtc)
                .Select(task => ToTaskResponse(task))
                .ToListAsync(cancellationToken);

        return Results.Ok(ApiSuccessResponse<IReadOnlyList<TaskResponse>>.Create(
            tasks,
            httpContext.TraceIdentifier));
    }

    public async Task<IResult> CreateTaskAsync(
        HttpContext httpContext,
        CreateTaskRequest request,
        TaskManagerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        try
        {
            var weekStartDate = ToMonday(request.WeekStartDate);
            var workspace = await GetOrCreateWorkspaceAsync(dbContext, weekStartDate, cancellationToken);
            var task = TaskItem.Create(
                workspace.Id,
                weekStartDate,
                request.Title,
                request.DayDate,
                request.Notes,
                request.Status);

            dbContext.Tasks.Add(task);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.Created(
                $"/api/v1/tasks/{task.Id}",
                ApiSuccessResponse<TaskResponse>.Create(ToTaskResponse(task), httpContext.TraceIdentifier));
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(ApiErrorResponse.Create(
                code: "task.validation",
                message: exception.Message,
                requestId: httpContext.TraceIdentifier));
        }
    }

    public async Task<IResult> UpdateTaskAsync(
        Guid taskId,
        HttpContext httpContext,
        UpdateTaskRequest request,
        TaskManagerDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var weekStartDate = ToMonday(request.WeekStartDate);
        var workspace = await dbContext.WeekWorkspaces
            .SingleOrDefaultAsync(candidate => candidate.WeekStartDate == weekStartDate, cancellationToken);
        var task = workspace is null
            ? null
            : await dbContext.Tasks.SingleOrDefaultAsync(
                candidate => candidate.Id == taskId && candidate.WeekWorkspaceId == workspace.Id,
                cancellationToken);

        if (task is null)
        {
            return Results.NotFound(ApiErrorResponse.Create(
                code: "task.not_found",
                message: "Task was not found in the selected week.",
                requestId: httpContext.TraceIdentifier));
        }

        try
        {
            task.Update(
                weekStartDate,
                request.Title,
                request.DayDate,
                request.Notes,
                request.Status);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.Ok(ApiSuccessResponse<TaskResponse>.Create(
                ToTaskResponse(task),
                httpContext.TraceIdentifier));
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(ApiErrorResponse.Create(
                code: "task.validation",
                message: exception.Message,
                requestId: httpContext.TraceIdentifier));
        }
    }

    private static async Task<WeekWorkspace> GetOrCreateWorkspaceAsync(
        TaskManagerDbContext dbContext,
        DateOnly weekStartDate,
        CancellationToken cancellationToken)
    {
        var workspace = await dbContext.WeekWorkspaces
            .SingleOrDefaultAsync(candidate => candidate.WeekStartDate == weekStartDate, cancellationToken);
        if (workspace is not null)
        {
            return workspace;
        }

        workspace = WeekWorkspace.Create(weekStartDate);
        dbContext.WeekWorkspaces.Add(workspace);
        return workspace;
    }

    private static TaskResponse ToTaskResponse(TaskItem task)
    {
        return new TaskResponse(
            task.Id,
            task.WeekWorkspaceId,
            task.DayDate,
            task.Title,
            task.Notes,
            task.Status,
            task.CreatedAtUtc,
            task.UpdatedAtUtc);
    }

    private static DateOnly ResolveWeekStartDate(HttpContext httpContext, string queryParameter = "week_start_date")
    {
        var queryValue = httpContext.Request.Query[queryParameter].ToString();

        if (DateOnly.TryParse(queryValue, out var parsedDate))
        {
            return ToMonday(parsedDate);
        }

        return ToMonday(DateOnly.FromDateTime(DateTime.UtcNow));
    }

    private static DateOnly ToMonday(DateOnly date)
    {
        while (date.DayOfWeek != DayOfWeek.Monday)
        {
            date = date.AddDays(-1);
        }

        return date;
    }

    private static JsonElement DeserializeLanes(string lanesJson)
    {
        try
        {
            var lanes = JsonSerializer.Deserialize<JsonElement>(lanesJson);
            if (lanes.ValueKind == JsonValueKind.Array)
            {
                return lanes;
            }
        }
        catch (JsonException)
        {
        }

        return JsonSerializer.Deserialize<JsonElement>("[]");
    }

    public IResult GetCurrentUser(HttpContext httpContext)
    {
        var username = httpContext.User.Identity?.Name
            ?? httpContext.User.FindFirst("unique_name")?.Value
            ?? "unknown";

        return Results.Ok(ApiSuccessResponse<object>.Create(new { username }, httpContext.TraceIdentifier));
    }
}