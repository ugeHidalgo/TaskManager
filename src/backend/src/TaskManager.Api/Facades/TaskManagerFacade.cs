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

    private static DateOnly ResolveWeekStartDate(HttpContext httpContext)
    {
        var queryValue = httpContext.Request.Query["week_start_date"].ToString();

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