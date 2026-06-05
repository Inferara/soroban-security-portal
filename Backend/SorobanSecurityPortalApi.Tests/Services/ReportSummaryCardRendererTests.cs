using FluentAssertions;
using SkiaSharp;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.Rendering;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class ReportSummaryCardRendererTests
    {
        private static ReportSummaryStats Stats(string name = "Acme Audit", string? auditor = "Runtime Verification",
            int total = 48, int fixedC = 42, int notFixed = 6, int rate = 88) =>
            new(name, auditor, total, fixedC, notFixed, rate, "sig123");

        [Fact]
        public void Render_ProducesValidPng_1200x630()
        {
            var bytes = new ReportSummaryCardRenderer().Render(Stats());

            bytes.Should().NotBeNullOrEmpty();
            using var bmp = SKBitmap.Decode(bytes);
            bmp.Should().NotBeNull();
            bmp.Width.Should().Be(1200);
            bmp.Height.Should().Be(630);
        }

        [Fact]
        public void Render_IsDeterministic_ForSameStats()
        {
            var r = new ReportSummaryCardRenderer();
            r.Render(Stats()).Should().Equal(r.Render(Stats()));
        }

        [Fact]
        public void Render_HandlesNoAuditor_AndLongName_AndZeroVulns()
        {
            var r = new ReportSummaryCardRenderer();
            var longName = new string('X', 200);
            var act = () => r.Render(Stats(name: longName, auditor: null, total: 0, fixedC: 0, notFixed: 0, rate: 0));
            act.Should().NotThrow();
            r.Render(Stats(auditor: null)).Should().NotBeNullOrEmpty();
        }
    }
}
