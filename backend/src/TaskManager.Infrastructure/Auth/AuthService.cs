using Microsoft.EntityFrameworkCore;
using TaskManager.Application.Auth;
using TaskManager.Infrastructure.Persistence;

namespace TaskManager.Infrastructure.Auth;

public sealed class AuthService(TaskManagerDbContext dbContext, IPasswordHasher passwordHasher, IJwtTokenService jwtTokenService) : IAuthService
{
    public async Task<AuthToken?> LoginAsync(string username, string password, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            return null;
        }

        var normalizedUsername = username.Trim().ToLowerInvariant();

        var user = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Username == normalizedUsername, cancellationToken);

        if (user is null)
        {
            return null;
        }

        var isValidPassword = passwordHasher.Verify(password, user.PasswordHash);
        if (!isValidPassword)
        {
            return null;
        }

        return jwtTokenService.CreateToken(user.Id, user.Username);
    }
}