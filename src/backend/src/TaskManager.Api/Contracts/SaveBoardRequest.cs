using System.Text.Json;

namespace TaskManager.Api.Contracts;

public sealed record SaveBoardRequest(DateOnly WeekStartDate, JsonElement Lanes);