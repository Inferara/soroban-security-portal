using FluentAssertions;
using SorobanSecurityPortalApi.Common.Security;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Common.Security
{
    // UrlValidator is the SSRF guard for every server-side fetch (report URL ingestion, agent runs).
    // These tests pin its pure, deterministic logic only. Every host below is either a reserved
    // hostname (rejected before any lookup) or an IP literal: Dns.GetHostAddresses returns a literal
    // as-is without touching the network, so the suite is stable offline and under split-horizon DNS.
    public class UrlValidatorTests
    {
        private const string SchemeNotAllowed = "URL scheme is not allowed.";
        private const string HttpsRequired = "Only HTTPS URLs are allowed.";
        private const string InternalHostname = "URL points to an internal address.";
        private const string InternalAddress = "URL resolves to an internal or reserved address.";

        private static (bool Ok, string? Error) Check(string url, bool requireHttps = true)
        {
            var ok = UrlValidator.IsUrlSafeForFetch(url, out var error, requireHttps);
            return (ok, error);
        }

        // ---------------------------------------------------------------- malformed input

        [Theory]
        [InlineData(null, "URL cannot be empty.")]
        [InlineData("", "URL cannot be empty.")]
        [InlineData("   ", "URL cannot be empty.")]
        [InlineData("not a url", "Invalid URL format.")]
        [InlineData("relative/path", "Invalid URL format.")]
        [InlineData("example.com/report.pdf", "Invalid URL format.")]
        public void Rejects_Empty_Or_Malformed_Input(string? url, string expectedError)
        {
            var (ok, err) = Check(url!);
            ok.Should().BeFalse();
            err.Should().Be(expectedError);
        }

        // ---------------------------------------------------------------- schemes

        [Theory]
        [InlineData("file:///etc/passwd")]
        [InlineData("ftp://8.8.8.8/report.pdf")]
        [InlineData("sftp://8.8.8.8/report.pdf")]
        [InlineData("gopher://8.8.8.8/")]
        [InlineData("ldap://8.8.8.8/")]
        [InlineData("dict://8.8.8.8/")]
        [InlineData("data:text/plain;base64,SGVsbG8=")]
        [InlineData("javascript:alert(1)")]
        [InlineData("FILE:///C:/Windows/win.ini")] // scheme match is case-insensitive
        public void Rejects_Dangerous_Schemes_Regardless_Of_Https_Setting(string url)
        {
            Check(url).Should().Be((false, SchemeNotAllowed));
            Check(url, requireHttps: false).Should().Be((false, SchemeNotAllowed));
        }

        [Theory]
        [InlineData("http://8.8.8.8/report.pdf")]
        [InlineData("HTTP://8.8.8.8/report.pdf")]
        public void Rejects_Plain_Http_When_Https_Is_Required(string url)
        {
            Check(url).Should().Be((false, HttpsRequired));
        }

        [Fact]
        public void Accepts_Plain_Http_To_Public_Address_When_Https_Not_Required()
        {
            Check("http://8.8.8.8/report.pdf", requireHttps: false).Should().Be((true, null));
        }

        [Fact]
        public void Still_Blocks_Internal_Address_Over_Http_When_Https_Not_Required()
        {
            Check("http://10.0.0.1/admin", requireHttps: false).Should().Be((false, InternalAddress));
        }

        [Theory]
        [InlineData("mailto:someone@example.com")]
        [InlineData("tel:+123456789")]
        public void Rejects_Unlisted_Non_Http_Schemes_Via_Https_Requirement(string url)
        {
            // Not on the explicit block list, but still not HTTPS.
            Check(url).Should().Be((false, HttpsRequired));
        }

        // ---------------------------------------------------------------- reserved hostnames

        [Theory]
        [InlineData("https://localhost/")]
        [InlineData("https://LOCALHOST/")]
        [InlineData("https://localhost:8443/api")]
        [InlineData("https://127.0.0.1/")]
        [InlineData("https://0.0.0.0/")]
        [InlineData("https://[::1]/")]
        [InlineData("https://metadata.google.internal/computeMetadata/v1/")]
        [InlineData("https://metadata/")]
        [InlineData("https://169.254.169.254/latest/meta-data/")]
        [InlineData("https://printer.local/")]
        [InlineData("https://db.internal/")]
        [InlineData("https://app.localhost/")]
        [InlineData("https://Service.Corp.INTERNAL/")]
        public void Rejects_Localhost_Metadata_And_Internal_Hostnames(string url)
        {
            Check(url).Should().Be((false, InternalHostname));
        }

        // ---------------------------------------------------------------- IPv4 reserved ranges

        [Theory]
        // 0.0.0.0/8 current network
        [InlineData("0.1.2.3")]
        [InlineData("0.255.255.255")]
        // 10.0.0.0/8 private
        [InlineData("10.0.0.0")]
        [InlineData("10.1.2.3")]
        [InlineData("10.255.255.255")]
        // 100.64.0.0/10 carrier-grade NAT
        [InlineData("100.64.0.0")]
        [InlineData("100.100.1.1")]
        [InlineData("100.127.255.255")]
        // 127.0.0.0/8 loopback (not just 127.0.0.1)
        [InlineData("127.0.0.0")]
        [InlineData("127.0.0.2")]
        [InlineData("127.255.255.255")]
        // 169.254.0.0/16 link-local
        [InlineData("169.254.0.0")]
        [InlineData("169.254.0.1")]
        [InlineData("169.254.255.255")]
        // 172.16.0.0/12 private
        [InlineData("172.16.0.0")]
        [InlineData("172.20.1.1")]
        [InlineData("172.31.255.255")]
        // 192.0.0.0/24 IETF protocol assignments
        [InlineData("192.0.0.0")]
        [InlineData("192.0.0.1")]
        [InlineData("192.0.0.255")]
        // 192.0.2.0/24 TEST-NET-1
        [InlineData("192.0.2.0")]
        [InlineData("192.0.2.1")]
        [InlineData("192.0.2.255")]
        // 192.168.0.0/16 private
        [InlineData("192.168.0.0")]
        [InlineData("192.168.1.1")]
        [InlineData("192.168.255.255")]
        // 198.18.0.0/15 benchmarking
        [InlineData("198.18.0.0")]
        [InlineData("198.18.0.1")]
        [InlineData("198.19.255.255")]
        // 198.51.100.0/24 TEST-NET-2
        [InlineData("198.51.100.0")]
        [InlineData("198.51.100.1")]
        [InlineData("198.51.100.255")]
        // 203.0.113.0/24 TEST-NET-3
        [InlineData("203.0.113.0")]
        [InlineData("203.0.113.1")]
        [InlineData("203.0.113.255")]
        // 224.0.0.0/4 multicast
        [InlineData("224.0.0.0")]
        [InlineData("224.0.0.1")]
        [InlineData("239.255.255.255")]
        // 240.0.0.0/4 reserved, incl. broadcast
        [InlineData("240.0.0.0")]
        [InlineData("240.0.0.1")]
        [InlineData("255.255.255.255")]
        public void Rejects_Private_And_Reserved_Ipv4_Addresses(string ip)
        {
            Check($"https://{ip}/").Should().Be((false, InternalAddress));
        }

        [Theory]
        // first public address just outside each blocked range (and the last one before it)
        [InlineData("1.0.0.0")]           // after 0.0.0.0/8
        [InlineData("9.255.255.255")]     // before 10/8
        [InlineData("11.0.0.0")]          // after 10/8
        [InlineData("100.63.255.255")]    // before 100.64/10
        [InlineData("100.128.0.0")]       // after 100.64/10
        [InlineData("126.255.255.255")]   // before 127/8
        [InlineData("128.0.0.0")]         // after 127/8
        [InlineData("169.253.255.255")]   // before 169.254/16
        [InlineData("169.255.0.0")]       // after 169.254/16
        [InlineData("172.15.255.255")]    // before 172.16/12
        [InlineData("172.32.0.0")]        // after 172.16/12
        [InlineData("192.0.1.1")]         // between 192.0.0/24 and 192.0.2/24
        [InlineData("192.0.3.1")]         // after 192.0.2/24
        [InlineData("192.167.255.255")]   // before 192.168/16
        [InlineData("192.169.0.0")]       // after 192.168/16
        [InlineData("198.17.255.255")]    // before 198.18/15
        [InlineData("198.20.0.0")]        // after 198.18/15
        [InlineData("198.51.99.255")]     // before 198.51.100/24
        [InlineData("198.51.101.0")]      // after 198.51.100/24
        [InlineData("203.0.112.255")]     // before 203.0.113/24
        [InlineData("203.0.114.0")]       // after 203.0.113/24
        [InlineData("223.255.255.255")]   // before 224/4
        // well-known public addresses
        [InlineData("8.8.8.8")]
        [InlineData("1.1.1.1")]
        [InlineData("104.16.0.1")]
        public void Accepts_Public_Ipv4_Addresses(string ip)
        {
            Check($"https://{ip}/report.pdf").Should().Be((true, null));
        }

        // ---------------------------------------------------------------- IPv6

        [Theory]
        [InlineData("[fe80::1]")]                       // link-local fe80::/10
        [InlineData("[febf::1]")]
        [InlineData("[fec0::1]")]                       // site-local fec0::/10 (deprecated)
        [InlineData("[fc00::1]")]                       // unique local fc00::/7
        [InlineData("[fd12:3456:789a::1]")]
        [InlineData("[fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff]")]
        [InlineData("[::ffff:10.0.0.1]")]               // IPv4-mapped private
        [InlineData("[::ffff:127.0.0.1]")]              // IPv4-mapped loopback
        [InlineData("[::ffff:169.254.169.254]")]        // IPv4-mapped metadata endpoint
        [InlineData("[::ffff:192.168.1.1]")]
        [InlineData("[::ffff:172.16.0.1]")]
        public void Rejects_Private_And_Reserved_Ipv6_Addresses(string host)
        {
            Check($"https://{host}/").Should().Be((false, InternalAddress));
        }

        [Theory]
        [InlineData("[2001:4860:4860::8888]")]          // Google DNS
        [InlineData("[2606:4700:4700::1111]")]          // Cloudflare DNS
        [InlineData("[fbff::1]")]                       // just below fc00::/7
        [InlineData("[fe00::1]")]                       // just above fc00::/7, below fe80::/10
        [InlineData("[fe7f::1]")]                       // just below fe80::/10
        [InlineData("[ff00::1]")]                       // just above fec0::/10
        [InlineData("[::ffff:8.8.8.8]")]                // IPv4-mapped public
        [InlineData("[::ffff:11.0.0.0]")]               // IPv4-mapped, just outside 10/8
        public void Accepts_Public_Ipv6_Addresses(string host)
        {
            Check($"https://{host}/report.pdf").Should().Be((true, null));
        }

        // ---------------------------------------------------------------- error contract

        [Fact]
        public void Success_Leaves_Error_Message_Null()
        {
            UrlValidator.IsUrlSafeForFetch("https://8.8.8.8/", out var error).Should().BeTrue();
            error.Should().BeNull();
        }

        [Fact]
        public void Userinfo_Credentials_Do_Not_Bypass_Host_Checks()
        {
            // "https://8.8.8.8@10.0.0.1/" has host 10.0.0.1, not 8.8.8.8.
            Check("https://8.8.8.8@10.0.0.1/").Should().Be((false, InternalAddress));
            Check("https://user:pass@localhost/").Should().Be((false, InternalHostname));
        }
    }
}
