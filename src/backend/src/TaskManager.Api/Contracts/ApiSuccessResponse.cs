namespace TaskManager.Api.Contracts;

public sealed record ApiSuccessResponse<T>(T Data, ApiMeta Meta)
{
    public static ApiSuccessResponse<T> Create(T data, string requestId)
    {
        return new ApiSuccessResponse<T>(
            data,
            new ApiMeta(requestId, DateTime.UtcNow));
    }
}

public sealed record ApiMeta(string RequestId, DateTime TimestampUtc);