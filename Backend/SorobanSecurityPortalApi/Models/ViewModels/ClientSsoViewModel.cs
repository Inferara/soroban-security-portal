namespace SorobanSecurityPortalApi.Models.ViewModels;

public class ClientSsoViewModel
{
    public int ClientSsoId { get; set; } = 0;
    public string Name { get; set; } = string.Empty;
    public string LoginType { get; set; } = string.Empty;
    public Dictionary<string, string> Settings { get; set; } = new();
    public DateTime Created { get; set; } = DateTime.UtcNow;
    public string CreatedBy { get; set; } = string.Empty;
}
