namespace TaskManager.Application.Auth;

public interface IPasswordHasher
{
    string Hash(string plainTextPassword);

    bool Verify(string plainTextPassword, string hashedPassword);
}