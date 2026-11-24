using System.Net;

namespace SorobanSecurityPortalApi.Common.Security;

/// <summary>
/// Resolves a hostname to its IP addresses for the SSRF check in <see cref="UrlValidator"/>.
/// Abstracted so the check can run without real DNS (e.g. in unit tests).
/// </summary>
public interface IHostResolver
{
    /// <summary>
    /// Returns the addresses the host resolves to. Throws
    /// <see cref="System.Net.Sockets.SocketException"/> when the host cannot be resolved.
    /// </summary>
    IPAddress[] GetHostAddresses(string host);
}

/// <summary>Default resolver: the system DNS.</summary>
public sealed class DnsHostResolver : IHostResolver
{
    public static readonly DnsHostResolver Instance = new();

    public IPAddress[] GetHostAddresses(string host) => Dns.GetHostAddresses(host);
}
