using System.Net;
using System.Net.Sockets;

namespace SorobanSecurityPortalApi.Common.Security;

/// <summary>
/// Provides URL validation for SSRF (Server-Side Request Forgery) protection.
/// </summary>
public static class UrlValidator
{
    // Blocked URL schemes that could be dangerous
    private static readonly HashSet<string> BlockedSchemes = new(StringComparer.OrdinalIgnoreCase)
    {
        "file", "ftp", "gopher", "ldap", "dict", "sftp", "data", "javascript"
    };

    /// <summary>
    /// Validates whether a URL is safe for server-side fetching.
    /// Prevents SSRF attacks by blocking internal addresses and dangerous schemes.
    /// </summary>
    /// <param name="url">The URL to validate.</param>
    /// <param name="errorMessage">Error message if validation fails.</param>
    /// <param name="requireHttps">Whether to require HTTPS (default: true).</param>
    /// <returns>True if the URL is safe to fetch; otherwise, false.</returns>
    public static bool IsUrlSafeForFetch(string url, out string? errorMessage, bool requireHttps = true)
    {
        errorMessage = null;

        // Validate URL format
        if (string.IsNullOrWhiteSpace(url))
        {
            errorMessage = "URL cannot be empty.";
            return false;
        }

        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            errorMessage = "Invalid URL format.";
            return false;
        }

        // Block dangerous schemes
        if (BlockedSchemes.Contains(uri.Scheme))
        {
            errorMessage = "URL scheme is not allowed.";
            return false;
        }

        // Enforce HTTPS if required
        if (requireHttps && uri.Scheme != Uri.UriSchemeHttps)
        {
            errorMessage = "Only HTTPS URLs are allowed.";
            return false;
        }

        // For HTTP/HTTPS, validate the host doesn't resolve to internal IPs
        if (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
        {
            // Block localhost and common internal hostnames
            if (IsInternalHostname(uri.Host))
            {
                errorMessage = "URL points to an internal address.";
                return false;
            }

            // Resolve hostname and check for internal IPs
            try
            {
                var addresses = Dns.GetHostAddresses(uri.Host);
                foreach (var addr in addresses)
                {
                    if (IsPrivateOrReservedIP(addr))
                    {
                        errorMessage = "URL resolves to an internal or reserved address.";
                        return false;
                    }
                }
            }
            catch (SocketException)
            {
                errorMessage = "Could not resolve hostname.";
                return false;
            }
        }

        return true;
    }

    /// <summary>
    /// Checks if a hostname is a known internal/local hostname.
    /// </summary>
    private static bool IsInternalHostname(string host)
    {
        var lowerHost = host.ToLowerInvariant();

        // Block localhost variants
        if (lowerHost == "localhost" ||
            lowerHost == "127.0.0.1" ||
            lowerHost == "::1" ||
            lowerHost == "[::1]" ||
            lowerHost == "0.0.0.0")
        {
            return true;
        }

        // Block common cloud metadata endpoints
        if (lowerHost == "metadata.google.internal" ||
            lowerHost == "metadata" ||
            lowerHost == "169.254.169.254")
        {
            return true;
        }

        // Block .local and .internal domains
        if (lowerHost.EndsWith(".local") ||
            lowerHost.EndsWith(".internal") ||
            lowerHost.EndsWith(".localhost"))
        {
            return true;
        }

        return false;
    }

    /// <summary>
    /// Checks if an IP address is private, reserved, or otherwise not suitable for external requests.
    /// </summary>
    private static bool IsPrivateOrReservedIP(IPAddress address)
    {
        // Handle IPv4
        if (address.AddressFamily == AddressFamily.InterNetwork)
        {
            byte[] bytes = address.GetAddressBytes();

            // 0.0.0.0/8 - Current network
            if (bytes[0] == 0)
                return true;

            // 10.0.0.0/8 - Private network (Class A)
            if (bytes[0] == 10)
                return true;

            // 100.64.0.0/10 - Carrier-grade NAT
            if (bytes[0] == 100 && bytes[1] >= 64 && bytes[1] <= 127)
                return true;

            // 127.0.0.0/8 - Loopback
            if (bytes[0] == 127)
                return true;

            // 169.254.0.0/16 - Link-local (includes cloud metadata endpoints!)
            if (bytes[0] == 169 && bytes[1] == 254)
                return true;

            // 172.16.0.0/12 - Private network (Class B)
            if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31)
                return true;

            // 192.0.0.0/24 - IETF Protocol Assignments
            if (bytes[0] == 192 && bytes[1] == 0 && bytes[2] == 0)
                return true;

            // 192.0.2.0/24 - Documentation (TEST-NET-1)
            if (bytes[0] == 192 && bytes[1] == 0 && bytes[2] == 2)
                return true;

            // 192.168.0.0/16 - Private network (Class C)
            if (bytes[0] == 192 && bytes[1] == 168)
                return true;

            // 198.18.0.0/15 - Benchmark testing
            if (bytes[0] == 198 && (bytes[1] == 18 || bytes[1] == 19))
                return true;

            // 198.51.100.0/24 - Documentation (TEST-NET-2)
            if (bytes[0] == 198 && bytes[1] == 51 && bytes[2] == 100)
                return true;

            // 203.0.113.0/24 - Documentation (TEST-NET-3)
            if (bytes[0] == 203 && bytes[1] == 0 && bytes[2] == 113)
                return true;

            // 224.0.0.0/4 - Multicast
            if (bytes[0] >= 224 && bytes[0] <= 239)
                return true;

            // 240.0.0.0/4 - Reserved for future use
            if (bytes[0] >= 240)
                return true;
        }
        // Handle IPv6
        else if (address.AddressFamily == AddressFamily.InterNetworkV6)
        {
            // Loopback (::1)
            if (IPAddress.IsLoopback(address))
                return true;

            // Link-local (fe80::/10)
            if (address.IsIPv6LinkLocal)
                return true;

            // Site-local (fec0::/10) - deprecated but still block
            if (address.IsIPv6SiteLocal)
                return true;

            // Unique local addresses (fc00::/7)
            byte[] bytes = address.GetAddressBytes();
            if ((bytes[0] & 0xFE) == 0xFC)
                return true;

            // IPv4-mapped IPv6 addresses (::ffff:0:0/96)
            if (address.IsIPv4MappedToIPv6)
            {
                // Extract the IPv4 part and check it
                var ipv4 = address.MapToIPv4();
                return IsPrivateOrReservedIP(ipv4);
            }
        }

        return false;
    }
}
