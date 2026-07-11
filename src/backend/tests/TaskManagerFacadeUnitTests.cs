using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using TaskManager.Api.Facades;
using TaskManager.Application.Auth;
using Xunit;

namespace TaskManager.Facaded.Tests;

public sealed class TaskManagerFacadeUnitTests
{
    private readonly TaskManagerFacade _facade = new();

    [Fact]
    public void GetHealth_ReturnsOkEnvelope()
    {
        var result = _facade.GetHealth();
        var response = ToResponse(result);

        Assert.Equal(StatusCodes.Status200OK, response.StatusCode);
        Assert.Equal("ok", response.Body.RootElement.GetProperty("Data").GetProperty("status").GetString());
    }

    [Fact]
    public async Task LoginAsync_ReturnsBadRequest_WhenCredentialsMissing()
    {
        var context = CreateContext();
        var authService = new FakeAuthService();
        var request = new LoginRequest("", "");

        var result = await _facade.LoginAsync(request, authService, context, CancellationToken.None);
        var response = ToResponse(result);

        Assert.Equal(StatusCodes.Status400BadRequest, response.StatusCode);
        Assert.Equal("auth.validation", response.Body.RootElement.GetProperty("Error").GetProperty("Code").GetString());
    }

    [Fact]
    public async Task LoginAsync_ReturnsUnauthorized_WhenCredentialsInvalid()
    {
        var context = CreateContext();
        var authService = new FakeAuthService();
        var request = new LoginRequest("admin", "wrong");

        var result = await _facade.LoginAsync(request, authService, context, CancellationToken.None);
        var response = ToResponse(result);

        Assert.Equal(StatusCodes.Status401Unauthorized, response.StatusCode);
        Assert.Equal("auth.invalid_credentials", response.Body.RootElement.GetProperty("Error").GetProperty("Code").GetString());
    }

    [Fact]
    public async Task LoginAsync_ReturnsOk_WhenCredentialsValid()
    {
        var context = CreateContext();
        var authService = new FakeAuthService
        {
            LoginResult = new AuthToken("jwt-token", DateTime.UtcNow.AddMinutes(5), "admin"),
        };

        var request = new LoginRequest("admin", "Admin123!");

        var result = await _facade.LoginAsync(request, authService, context, CancellationToken.None);
        var response = ToResponse(result);

        Assert.Equal(StatusCodes.Status200OK, response.StatusCode);
        Assert.Equal("admin", response.Body.RootElement.GetProperty("Data").GetProperty("Username").GetString());
        Assert.Equal("jwt-token", response.Body.RootElement.GetProperty("Data").GetProperty("Token").GetString());
    }

    [Fact]
    public void GetBoard_ReturnsBoardEnvelope()
    {
        var context = CreateContext();

        var result = _facade.GetBoard(context);
        var response = ToResponse(result);

        Assert.Equal(StatusCodes.Status200OK, response.StatusCode);
        Assert.True(response.Body.RootElement.GetProperty("Data").TryGetProperty("weekStartDate", out _));
        Assert.True(response.Body.RootElement.GetProperty("Data").TryGetProperty("lanes", out _));
    }

    [Fact]
    public void GetCurrentUser_ReturnsUsernameFromClaim()
    {
        var context = CreateContext();
        context.User = new ClaimsPrincipal(
            new ClaimsIdentity([
                new Claim("unique_name", "admin")
            ], "Bearer"));

        var result = _facade.GetCurrentUser(context);
        var response = ToResponse(result);

        Assert.Equal(StatusCodes.Status200OK, response.StatusCode);
        Assert.Equal("admin", response.Body.RootElement.GetProperty("Data").GetProperty("username").GetString());
    }

    private static DefaultHttpContext CreateContext()
    {
        return new DefaultHttpContext
        {
            TraceIdentifier = "test-request-id"
        };
    }

    private static (int StatusCode, JsonDocument Body) ToResponse(IResult result)
    {
        var statusCode = (result as IStatusCodeHttpResult)?.StatusCode ?? StatusCodes.Status200OK;
        var value = (result as IValueHttpResult)?.Value;
        Assert.NotNull(value);
        var responseBody = JsonSerializer.Serialize(value);

        return (statusCode, JsonDocument.Parse(responseBody));
    }

    private sealed class FakeAuthService : IAuthService
    {
        public AuthToken? LoginResult { get; init; }

        public Task<AuthToken?> LoginAsync(string username, string password, CancellationToken cancellationToken)
        {
            return Task.FromResult(LoginResult);
        }
    }
}
