namespace TaskManager.Infrastructure.Persistence;

public sealed class BootstrapUserOptions
{
    public const string SectionName = "BootstrapUser";

    /// <summary>
    /// Enable bootstrap user creation. Only applies in Development environment.
    /// </summary>
    public bool Enabled { get; set; } = false;

    public string Username { get; set; } = "admin";

    public string Password { get; set; } = string.Empty;
}