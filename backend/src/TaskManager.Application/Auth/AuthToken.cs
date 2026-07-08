namespace TaskManager.Application.Auth;

public sealed record AuthToken(string Token, DateTime ExpiresAtUtc, string Username);