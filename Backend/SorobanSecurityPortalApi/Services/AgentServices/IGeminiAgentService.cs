using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Services.AgentServices.Types;

namespace SorobanSecurityPortalApi.Services.AgentServices;

/// <summary>
/// Interface for the Gemini Agent Service that handles AI-powered agent calls.
/// </summary>
public interface IGeminiAgentService
{
    /// <summary>
    /// Calls a specific agent type with the given user prompt.
    /// </summary>
    /// <param name="agentType">The type of agent to invoke.</param>
    /// <param name="userPrompt">The user prompt containing the data to process.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>A Result containing the JSON response string or an error message.</returns>
    Task<Result<string, string>> CallAgentAsync(
        AgentType agentType,
        string userPrompt,
        CancellationToken ct = default);
}
