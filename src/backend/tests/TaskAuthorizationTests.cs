using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace TaskManager.Tests;

public sealed class TaskAuthorizationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> factory;

    public TaskAuthorizationTests(WebApplicationFactory<Program> factory)
    {
        this.factory = factory.WithWebHostBuilder(builder =>
            builder
                .UseEnvironment("Development")
                .UseSetting("Jwt:Secret", "zQ7mR4vN8xK2pL6sW9cF3hJ5dG1bY0uA")
                .ConfigureAppConfiguration((_, configuration) =>
                    configuration.AddInMemoryCollection(new Dictionary<string, string?>
                    {
                        ["Jwt:Secret"] = "zQ7mR4vN8xK2pL6sW9cF3hJ5dG1bY0uA",
                    })));
    }

    [Fact]
    public async Task GetTasks_ReturnsUnauthorizedEnvelopeWithoutToken()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/v1/tasks?weekStartDate=2026-08-24");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(
            "auth.unauthorized",
            body.RootElement.GetProperty("error").GetProperty("code").GetString());
    }
}