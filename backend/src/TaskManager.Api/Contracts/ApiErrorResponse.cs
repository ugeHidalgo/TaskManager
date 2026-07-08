namespace TaskManager.Api.Contracts;

public sealed record ApiErrorResponse(ApiError Error, ApiMeta Meta)
{
    public static ApiErrorResponse Create(string code, string message, string requestId)
    {
        return new ApiErrorResponse(new ApiError(code, message), new ApiMeta(requestId, DateTime.UtcNow));
    }
}

public sealed record ApiError(string Code, string Message);