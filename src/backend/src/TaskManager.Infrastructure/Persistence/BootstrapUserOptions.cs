namespace TaskManager.Infrastructure.Persistence;

public sealed class BootstrapUserOptions
{
    public const string SectionName = "BootstrapUser";

    public string Username { get; set; } = "admin";

    public string Password { get; set; } = "Admin123!";
}