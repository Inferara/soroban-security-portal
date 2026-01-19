namespace SorobanSecurityPortalApi.Services.AgentServices.Types;

/// <summary>
/// Defines the type of agent in the vulnerability extraction pipeline.
/// Each agent has a specific role in the multi-agent architecture.
/// </summary>
public enum AgentType
{
    /// <summary>
    /// Analyzes report structure and identifies vulnerability sections.
    /// </summary>
    Parser,

    /// <summary>
    /// Extracts detailed vulnerability data from identified sections.
    /// </summary>
    Extractor,

    /// <summary>
    /// Assigns severity, tags, and category based on examples.
    /// </summary>
    Classifier,
}
