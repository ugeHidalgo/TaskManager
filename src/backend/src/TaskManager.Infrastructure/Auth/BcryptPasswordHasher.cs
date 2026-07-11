using TaskManager.Application.Auth;

namespace TaskManager.Infrastructure.Auth;

public sealed class BcryptPasswordHasher : IPasswordHasher
{
    public string Hash(string plainTextPassword)
    {
        return BCrypt.Net.BCrypt.HashPassword(plainTextPassword);
    }

    public bool Verify(string plainTextPassword, string hashedPassword)
    {
        return BCrypt.Net.BCrypt.Verify(plainTextPassword, hashedPassword);
    }
}