using Microsoft.AspNetCore.Http;
using TaskManager.Api.Contracts;
using TaskManager.Application.Auth;

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

    public IResult GetBoard(HttpContext httpContext)
    {
        var requestedWeekStartDate = ResolveWeekStartDate(httpContext);

        var payload = new
        {
            weekStartDate = requestedWeekStartDate,
            lanes = Array.Empty<object>(),
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

    public IResult GetCurrentUser(HttpContext httpContext)
    {
        var username = httpContext.User.Identity?.Name
            ?? httpContext.User.FindFirst("unique_name")?.Value
            ?? "unknown";

        return Results.Ok(ApiSuccessResponse<object>.Create(new { username }, httpContext.TraceIdentifier));
    }
}