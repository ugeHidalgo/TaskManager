using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using TaskManager.Api.Contracts;
using TaskManager.Api.Facades;
using TaskManager.Application.Auth;
using TaskManager.Infrastructure;
using TaskManager.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddScoped<TaskManagerFacade>();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
if (allowedOrigins == null)
{
    allowedOrigins = new[] { "http://localhost:5173", "http://127.0.0.1:5173" };
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendCors", policy =>
    {
        policy
            .WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var jwtSection = builder.Configuration.GetSection(JwtOptions.SectionName);
var jwtOptions = jwtSection.Get<JwtOptions>();
if (jwtOptions == null)
{
    jwtOptions = new JwtOptions();
}

// Validate JWT secret hardening: reject placeholders and weak secrets
var trimmedSecret = string.Empty;
if (jwtOptions.Secret != null)
{
    trimmedSecret = jwtOptions.Secret.Trim();
}

var unsafeSecrets = new string[] { "change-me", "default", "test", "password", "secret", "key" };
var isUnsafe = false;
foreach (var unsafeSecret in unsafeSecrets)
{
    if (trimmedSecret.Contains(unsafeSecret, StringComparison.OrdinalIgnoreCase))
    {
        isUnsafe = true;
        break;
    }
}

if (string.IsNullOrWhiteSpace(trimmedSecret) || trimmedSecret.Length < 32 || isUnsafe)
{
    throw new InvalidOperationException(
        "JWT secret must be configured with at least 32 characters and must not contain placeholder values like 'change-me', 'default', 'test', etc. " +
        "Generate a secure random secret for production use.");
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

        options.Events = new JwtBearerEvents
        {
            OnChallenge = async context =>
            {
                if (context.Response.HasStarted)
                {
                    return;
                }

                context.HandleResponse();
                var requestId = context.HttpContext.TraceIdentifier;
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/json";

                var payload = ApiErrorResponse.Create(
                    code: "auth.unauthorized",
                    message: "Authentication is required.",
                    requestId: requestId);

                await context.Response.WriteAsJsonAsync(payload, context.HttpContext.RequestAborted);
            },
            OnForbidden = async context =>
            {
                if (context.Response.HasStarted)
                {
                    return;
                }

                var requestId = context.HttpContext.TraceIdentifier;
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                context.Response.ContentType = "application/json";

                var payload = ApiErrorResponse.Create(
                    code: "auth.forbidden",
                    message: "You do not have access to this resource.",
                    requestId: requestId);

                await context.Response.WriteAsJsonAsync(payload, context.HttpContext.RequestAborted);
            },
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

// Initialize database with security-hardened bootstrap
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
    var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
    var bootstrapUserOptions = scope.ServiceProvider.GetRequiredService<IOptions<BootstrapUserOptions>>();
    var isDevelopment = app.Environment.IsDevelopment();
    
    var initializer = new DatabaseInitializer(dbContext, passwordHasher, bootstrapUserOptions, isDevelopment);
    await initializer.InitializeAsync(CancellationToken.None);
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("FrontendCors");
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", (TaskManagerFacade facade) => facade.GetHealth());

app.MapPost("/api/v1/auth/login", (LoginRequest request, IAuthService authService, HttpContext httpContext, CancellationToken cancellationToken, TaskManagerFacade facade) =>
    facade.LoginAsync(request, authService, httpContext, cancellationToken));

app.MapGet("/api/v1/board", [Authorize] (
    HttpContext httpContext,
    TaskManagerFacade facade,
    TaskManagerDbContext dbContext,
    CancellationToken cancellationToken) =>
    facade.GetBoardAsync(httpContext, dbContext, cancellationToken));

app.MapPut("/api/v1/board", [Authorize] (
    SaveBoardRequest request,
    HttpContext httpContext,
    TaskManagerFacade facade,
    TaskManagerDbContext dbContext,
    CancellationToken cancellationToken) =>
    facade.SaveBoardAsync(httpContext, request, dbContext, cancellationToken));

app.Run();
