namespace TaskManager.Application.Auth;

public interface IAuthService
{
    Task<AuthToken?> LoginAsync(string username, string password, CancellationToken cancellationToken);
}