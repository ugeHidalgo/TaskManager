using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
using TaskManager.Api.Contracts;
using TaskManager.Application.Auth;
using TaskManager.Infrastructure;
using TaskManager.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddInfrastructure(builder.Configuration);

var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
if (string.IsNullOrWhiteSpace(jwtOptions.Secret) || jwtOptions.Secret.Length < 32)
{
    throw new InvalidOperationException("JWT secret must be configured with at least 32 characters.");
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Secret)),
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var initializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
    await initializer.InitializeAsync(CancellationToken.None);
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(ApiSuccessResponse<object>.Create(new { status = "ok" }, "system")));

app.MapPost("/api/v1/auth/login", async (LoginRequest request, IAuthService authService, HttpContext httpContext, CancellationToken cancellationToken) =>
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
});

app.MapGet("/api/v1/board", [Authorize] (HttpContext httpContext) =>
{
    var payload = new
    {
        weekStartDate = DateOnly.FromDateTime(DateTime.UtcNow),
        lanes = Array.Empty<object>(),
    };

    return Results.Ok(ApiSuccessResponse<object>.Create(payload, httpContext.TraceIdentifier));
});

app.MapGet("/api/v1/auth/me", [Authorize] (HttpContext httpContext) =>
{
    var username = httpContext.User.Identity?.Name
        ?? httpContext.User.FindFirst("unique_name")?.Value
        ?? "unknown";

    return Results.Ok(ApiSuccessResponse<object>.Create(new { username }, httpContext.TraceIdentifier));
});

app.Run();
