namespace TaskManager.Application.Auth;

public interface IJwtTokenService
{
    AuthToken CreateToken(Guid userId, string username);
}