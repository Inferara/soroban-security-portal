using FluentAssertions;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Services.Moderation;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class ModerationParsingTests
    {
        [Fact]
        public void TryContentType_Parses_Comment()
        {
            ModerationParsing.TryContentType("comment", out var t).Should().BeTrue();
            t.Should().Be(ModeratedContentType.Comment);
        }

        [Fact]
        public void ContentTypeString_RoundTrips_Comment()
        {
            ModerationParsing.ContentTypeString(ModeratedContentType.Comment).Should().Be("comment");
        }
    }
}
