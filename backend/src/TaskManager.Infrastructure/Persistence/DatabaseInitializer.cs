using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TaskManager.Application.Auth;
using TaskManager.Domain.Users;

namespace TaskManager.Infrastructure.Persistence;

public sealed class DatabaseInitializer(
    TaskManagerDbContext dbContext,
    IPasswordHasher passwordHasher,
    IOptions<BootstrapUserOptions> bootstrapUserOptions)
{
    public async Task InitializeAsync(CancellationToken cancellationToken)
    {
        await dbContext.Database.MigrateAsync(cancellationToken);

        if (await dbContext.Users.AnyAsync(cancellationToken))
        {
            return;
        }

        var username = bootstrapUserOptions.Value.Username.Trim().ToLowerInvariant();
        var password = bootstrapUserOptions.Value.Password;

        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            return;
        }

        var user = User.Create(username, passwordHasher.Hash(password));
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}