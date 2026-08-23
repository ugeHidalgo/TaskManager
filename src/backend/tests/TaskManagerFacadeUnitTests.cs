using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using TaskManager.Api.Facades;
using TaskManager.Api.Contracts;
using TaskManager.Application.Auth;
using TaskManager.Domain.Board;
using TaskManager.Infrastructure.Persistence;
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
    public async Task GetBoardAsync_CreatesDeterministicEmptyWorkspace_WhenMissing()
    {
        var context = CreateContext();
        context.Request.QueryString = new QueryString("?week_start_date=2026-08-19");
        await using var dbContext = CreateDbContext();

        var result = await _facade.GetBoardAsync(context, dbContext, CancellationToken.None);
        var response = ToResponse(result);

        Assert.Equal(StatusCodes.Status200OK, response.StatusCode);
        Assert.Equal("2026-08-17", response.Body.RootElement.GetProperty("Data").GetProperty("weekStartDate").GetString());
        Assert.Equal(JsonValueKind.Array, response.Body.RootElement.GetProperty("Data").GetProperty("lanes").ValueKind);
        Assert.Empty(response.Body.RootElement.GetProperty("Data").GetProperty("lanes").EnumerateArray());

        var storedWorkspace = await dbContext.WeekWorkspaces.SingleAsync();
        Assert.Equal(new DateOnly(2026, 8, 17), storedWorkspace.WeekStartDate);
    }

    [Fact]
    public async Task SaveBoardAsync_PersistsWorkspace_AndSubsequentLoadReturnsStoredLanes()
    {
        var context = CreateContext();
        await using var dbContext = CreateDbContext();
        var lanes = JsonDocument.Parse("[{\"id\":\"lane-1\",\"title\":\"Monday\"}]").RootElement;
        var request = new SaveBoardRequest(new DateOnly(2026, 8, 19), lanes);

        var saveResult = await _facade.SaveBoardAsync(context, request, dbContext, CancellationToken.None);
        var saveResponse = ToResponse(saveResult);

        Assert.Equal(StatusCodes.Status200OK, saveResponse.StatusCode);
        Assert.Equal("2026-08-17", saveResponse.Body.RootElement.GetProperty("Data").GetProperty("weekStartDate").GetString());

        context.Request.QueryString = new QueryString("?week_start_date=2026-08-21");
        var loadResult = await _facade.GetBoardAsync(context, dbContext, CancellationToken.None);
        var loadResponse = ToResponse(loadResult);

        Assert.Equal(StatusCodes.Status200OK, loadResponse.StatusCode);
        Assert.Single(loadResponse.Body.RootElement.GetProperty("Data").GetProperty("lanes").EnumerateArray());
    }

    [Fact]
    public async Task SaveBoardAsync_ReturnsBadRequest_WhenLanesIsNotArray()
    {
        var context = CreateContext();
        await using var dbContext = CreateDbContext();
        var lanes = JsonDocument.Parse("{\"id\":\"lane-1\"}").RootElement;
        var request = new SaveBoardRequest(new DateOnly(2026, 8, 18), lanes);

        var result = await _facade.SaveBoardAsync(context, request, dbContext, CancellationToken.None);
        var response = ToResponse(result);

        Assert.Equal(StatusCodes.Status400BadRequest, response.StatusCode);
        Assert.Equal("board.validation", response.Body.RootElement.GetProperty("Error").GetProperty("Code").GetString());
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

    private static TaskManagerDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<TaskManagerDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new TaskManagerDbContext(options);
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
