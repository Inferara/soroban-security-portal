using System.Net;
using SorobanSecurityPortalApi.Common.Security;

namespace SorobanSecurityPortalApi.Tests.Common.Security;

/// <summary>
/// Table-driven tests for <see cref="UrlValidator"/> SSRF guard.
///
/// DNS-resolution is the only branch that makes a real network call; we skip it by
/// supplying raw IP-address literals as the host so the code hits IsInternalHostname /
/// IsPrivateOrReservedIP directly and never reaches Dns.GetHostAddresses.
/// </summary>
public class UrlValidatorTests
{
    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private static (bool ok, string? err) Check(string url, bool requireHttps = true)
    {
        var ok = UrlValidator.IsUrlSafeForFetch(url, out var err, requireHttps);
        return (ok, err);
    }

    // =========================================================================
    // NULL / EMPTY
    // =========================================================================

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void NullOrWhitespace_IsRejected(string? url)
    {
        var (ok, err) = Check(url!);
        ok.Should().BeFalse();
        err.Should().Be("URL cannot be empty.");
    }

    // =========================================================================
    // MALFORMED URL
    // =========================================================================

    [Theory]
    [InlineData("not a url")]
    [InlineData("://missing-scheme")]
    [InlineData("https://")]   // host is empty but still parses — keep as purely malformed test
    public void MalformedUrl_IsRejected(string url)
    {
        // Uri.TryCreate rejects these
        var (ok, _) = Check(url);
        ok.Should().BeFalse();
    }

    // =========================================================================
    // BLOCKED SCHEMES
    // =========================================================================

    [Theory]
    [InlineData("file:///etc/passwd")]
    [InlineData("ftp://example.com/file")]
    [InlineData("gopher://example.com")]
    [InlineData("ldap://example.com")]
    [InlineData("dict://example.com")]
    [InlineData("sftp://example.com")]
    [InlineData("data:text/html,<h1>hi</h1>")]
    [InlineData("javascript:alert(1)")]
    // Schemes are compared case-insensitively
    [InlineData("FILE:///etc/passwd")]
    [InlineData("FTP://example.com/file")]
    public void BlockedScheme_IsRejected(string url)
    {
        var (ok, err) = Check(url, requireHttps: false);
        ok.Should().BeFalse();
        err.Should().Be("URL scheme is not allowed.");
    }

    // =========================================================================
    // HTTP REJECTED WHEN requireHttps = true (default)
    // =========================================================================

    [Theory]
    [InlineData("http://example.com")]
    [InlineData("http://8.8.8.8")]
    public void Http_RejectedWhenHttpsRequired(string url)
    {
        // requireHttps defaults to true; http should be blocked at the scheme check
        // (after confirming it is not in BlockedSchemes, it fails the HTTPS-only check)
        var (ok, err) = Check(url, requireHttps: true);
        ok.Should().BeFalse();
        err.Should().Be("Only HTTPS URLs are allowed.");
    }

    // =========================================================================
    // INTERNAL HOSTNAMES — blocked by IsInternalHostname (no DNS needed)
    // =========================================================================

    [Theory]
    // Localhost variants
    [InlineData("https://localhost")]
    [InlineData("https://localhost/path")]
    [InlineData("https://127.0.0.1")]
    [InlineData("https://[::1]")]
    [InlineData("https://0.0.0.0")]
    // Cloud metadata
    [InlineData("https://169.254.169.254")]
    [InlineData("https://metadata.google.internal")]
    [InlineData("https://metadata")]
    // Suffix rules
    [InlineData("https://myservice.local")]
    [InlineData("https://api.internal")]
    [InlineData("https://db.localhost")]
    public void InternalHostname_IsRejected(string url)
    {
        var (ok, err) = Check(url);
        ok.Should().BeFalse();
        err.Should().Be("URL points to an internal address.");
    }

    // =========================================================================
    // PRIVATE / RESERVED IPv4 — supplied as raw IP literals, bypassing DNS
    // =========================================================================

    [Theory]
    // 0.0.0.0/8 — current network
    [InlineData("https://0.1.2.3")]
    // 10.0.0.0/8 — Class A private
    [InlineData("https://10.0.0.1")]
    [InlineData("https://10.255.255.255")]
    // 100.64.0.0/10 — carrier-grade NAT
    [InlineData("https://100.64.0.0")]
    [InlineData("https://100.127.255.255")]
    // 127.0.0.0/8 — loopback (not caught by IsInternalHostname for non-.1 addresses)
    [InlineData("https://127.0.0.2")]
    [InlineData("https://127.255.255.255")]
    // 169.254.0.0/16 — link-local
    [InlineData("https://169.254.0.1")]
    [InlineData("https://169.254.255.255")]
    // 172.16.0.0/12 — Class B private
    [InlineData("https://172.16.0.1")]
    [InlineData("https://172.31.255.255")]
    // 192.0.0.0/24 — IETF protocol assignments
    [InlineData("https://192.0.0.1")]
    // 192.0.2.0/24 — TEST-NET-1 (documentation)
    [InlineData("https://192.0.2.1")]
    // 192.168.0.0/16 — Class C private
    [InlineData("https://192.168.0.1")]
    [InlineData("https://192.168.255.255")]
    // 198.18.0.0/15 — benchmark testing
    [InlineData("https://198.18.0.1")]
    [InlineData("https://198.19.255.255")]
    // 198.51.100.0/24 — TEST-NET-2
    [InlineData("https://198.51.100.1")]
    // 203.0.113.0/24 — TEST-NET-3
    [InlineData("https://203.0.113.1")]
    // 224.0.0.0/4 — multicast
    [InlineData("https://224.0.0.1")]
    [InlineData("https://239.255.255.255")]
    // 240.0.0.0/4 — reserved future use
    [InlineData("https://240.0.0.1")]
    [InlineData("https://255.255.255.255")]
    public void PrivateOrReservedIPv4_IsRejected(string url)
    {
        var (ok, err) = Check(url);
        ok.Should().BeFalse();
        err.Should().Be("URL resolves to an internal or reserved address.");
    }

    // =========================================================================
    // PRIVATE / RESERVED IPv6 — supplied as raw IP literals, bypassing DNS
    // =========================================================================

    [Theory]
    // Link-local fe80::/10
    [InlineData("https://[fe80::1]")]
    [InlineData("https://[fe80::abcd:ef01]")]
    // Unique-local fc00::/7  (fc__ and fd__)
    [InlineData("https://[fc00::1]")]
    [InlineData("https://[fd00::1]")]
    [InlineData("https://[fd12:3456:789a::1]")]
    // IPv4-mapped ::ffff:x.x.x.x  — private IPv4 inside IPv6
    [InlineData("https://[::ffff:10.0.0.1]")]
    [InlineData("https://[::ffff:192.168.1.1]")]
    [InlineData("https://[::ffff:172.16.0.1]")]
    public void PrivateOrReservedIPv6_IsRejected(string url)
    {
        var (ok, err) = Check(url);
        ok.Should().BeFalse();
        err.Should().Be("URL resolves to an internal or reserved address.");
    }

    // =========================================================================
    // BOUNDARY: addresses that are just OUTSIDE private ranges (should not be
    // blocked by the range checks — but they WILL trigger a DNS lookup because
    // they are public IPs the code hasn't seen before).  We test them with
    // requireHttps=true so we can observe the outcome without needing real DNS.
    //
    // NOTE: because these reach Dns.GetHostAddresses, we do NOT include them in
    // the "accepted" happy-path table.  They are documented here for clarity.
    // =========================================================================

    // (Intentionally left empty — any IP that exits the private-range checks goes
    //  to DNS; in a unit-test context we cannot control DNS.  Happy-path uses
    //  publicly-resolvable domain names instead — see next section.)

    // =========================================================================
    // HAPPY PATH — public HTTPS URLs accepted
    // =========================================================================

    [Theory]
    [InlineData("https://example.com")]
    [InlineData("https://example.com/path?q=1#frag")]
    [InlineData("https://api.github.com/repos")]
    [InlineData("https://stellar.org")]
    [InlineData("https://communityfund.stellar.org/projects")]
    public void PublicHttpsUrl_IsAccepted(string url)
    {
        var (ok, err) = Check(url);
        ok.Should().BeTrue();
        err.Should().BeNull();
    }

    // =========================================================================
    // requireHttps = false  — HTTP to a public host is accepted
    // =========================================================================

    [Theory]
    [InlineData("http://example.com")]
    [InlineData("http://example.com/resource")]
    public void Http_AcceptedWhenHttpsNotRequired(string url)
    {
        var (ok, err) = Check(url, requireHttps: false);
        ok.Should().BeTrue();
        err.Should().BeNull();
    }

    // =========================================================================
    // BOUNDARY CHECKS — ensure the edges of private ranges are correctly placed
    // =========================================================================

    // 172.15.255.255 is just below 172.16/12 — public, goes to DNS (skip)
    // 172.32.0.0 is just above 172.16/12 — public, goes to DNS (skip)
    // 100.63.255.255 is just below CG-NAT range — would go to DNS (skip)
    // 100.128.0.0 is just above CG-NAT range — would go to DNS (skip)

    [Theory]
    // 172.16 is the FIRST address in 172.16.0.0/12 — must be blocked
    [InlineData("https://172.16.0.0")]
    // 172.31.255.255 is the LAST address in 172.16.0.0/12 — must be blocked
    [InlineData("https://172.31.255.255")]
    // 100.64.0.0 is the first CG-NAT address — must be blocked
    [InlineData("https://100.64.0.0")]
    // 100.127.255.255 is the last CG-NAT address — must be blocked
    [InlineData("https://100.127.255.255")]
    // 198.18.0.0 is the first benchmark address — must be blocked
    [InlineData("https://198.18.0.0")]
    // 198.19.255.255 is the last benchmark address — must be blocked
    [InlineData("https://198.19.255.255")]
    public void EdgeOfPrivateRange_IsRejected(string url)
    {
        var (ok, err) = Check(url);
        ok.Should().BeFalse();
        err.Should().Be("URL resolves to an internal or reserved address.");
    }

    // =========================================================================
    // IPv4-MAPPED IPv6 that wraps public IP is NOT blocked by IP checks
    // (it will proceed to DNS; just verify no false-positive rejection here)
    // =========================================================================

    [Fact]
    public void IPv4MappedIPv6_WithPublicAddress_IsNotRejectedByRangeCheck()
    {
        // ::ffff:8.8.8.8 maps to Google DNS — public, should not be blocked by
        // the private-IP check.  It will reach Dns.GetHostAddresses for the
        // IPv6 literal, but the IP check must not block it.
        //
        // We parse the address directly and test IsPrivateOrReservedIP indirectly
        // via IsUrlSafeForFetch: the outcome here is "accepted by range checks"
        // meaning the method will proceed (and may attempt DNS).  We assert only
        // that the rejection reason — if any — is NOT the range-check message.
        var (_, err) = Check("https://[::ffff:8.8.8.8]");
        err.Should().NotBe("URL resolves to an internal or reserved address.");
    }
}
