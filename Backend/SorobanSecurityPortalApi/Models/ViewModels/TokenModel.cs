using Newtonsoft.Json;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class TokenModel
    {
        [JsonProperty("access_token")]
        public string AccessToken { get; set; } = string.Empty;
        [JsonProperty("refresh_token", NullValueHandling = NullValueHandling.Ignore)]
        public string? RefreshToken { get; set; }
        [JsonProperty("token_type")]
        public string TokenType { get; set; } = "Bearer";
        [JsonProperty("expires_in")]
        public int ExpiresIn { get; set; }
        [JsonProperty("scope")]
        public string Scope { get; set; } = string.Empty;
        [JsonProperty("id_token", NullValueHandling = NullValueHandling.Ignore)]
        public string? IdToken { get; set; }
    }

    public class ExtendedTokenModel : TokenModel
    {
        public string Email { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Ip { get; set; } = string.Empty;
        public string Picture { get; set; } = string.Empty;
        public StellarDevelopersGuildMember? GuildMemberInfo { get; set; } = null;
    }

    public class StellarDevelopersGuildMember
    {
        public const string GuildId = "897514728459468821";

        public string Nick { get; set; } = default!;
        public List<string> Roles { get; set; } = new();
        public string JoinedAt { get; set; } = default!;
        public bool Deaf { get; set; }
        public bool Mute { get; set; }
        public bool Pending { get; set; }
        public bool IsSuspended() => this.Pending || this.Deaf || this.Mute;
        public bool IsActive() => !this.IsSuspended();
        // Tier 3 (top)
        public bool IsPilot() => this.IsActive() && this.Roles.Contains("1082331251899379762");
        // Tier 2
        public bool IsNavigator() => this.IsActive() && this.Roles.Contains("1082353855041392731");
        // Tier 1
        public bool IsPathfinder() => this.IsActive() && this.Roles.Contains("1082357854926807111");
        public StellarDevelopersGuildRole GetRole()
        {
            if (this.IsPilot()) return StellarDevelopersGuildRole.Pilot;
            if (this.IsNavigator()) return StellarDevelopersGuildRole.Navigator;
            if (this.IsPathfinder()) return StellarDevelopersGuildRole.Pathfinder;
            return StellarDevelopersGuildRole.None; // Default role
        }
    }

    public enum StellarDevelopersGuildRole
    {
        None = 0,
        Pilot = 1,
        Navigator = 2,
        Pathfinder = 3
    }
}
