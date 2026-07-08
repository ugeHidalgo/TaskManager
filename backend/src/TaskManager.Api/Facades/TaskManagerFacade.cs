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
        var payload = new
        {
            weekStartDate = DateOnly.FromDateTime(DateTime.UtcNow),
            lanes = Array.Empty<object>(),
        };

        return Results.Ok(ApiSuccessResponse<object>.Create(payload, httpContext.TraceIdentifier));
    }

    public IResult GetCurrentUser(HttpContext httpContext)
    {
        var username = httpContext.User.Identity?.Name
            ?? httpContext.User.FindFirst("unique_name")?.Value
            ?? "unknown";

        return Results.Ok(ApiSuccessResponse<object>.Create(new { username }, httpContext.TraceIdentifier));
    }
}