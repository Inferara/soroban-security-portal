using System.Linq;
using FluentAssertions;
using SorobanSecurityPortalApi.Common;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Common
{
    public class MentionParserTests
    {
        [Fact]
        public void Parses_Single_Mention_With_Position()
        {
            var tokens = MentionParser.Parse("hello @alice!");
            tokens.Should().ContainSingle();
            tokens[0].Username.Should().Be("alice");
            tokens[0].StartPos.Should().Be(6);      // index of '@'
            tokens[0].EndPos.Should().Be(12);        // exclusive end of "@alice"
        }

        [Fact]
        public void Parses_Multiple_And_Mention_At_Start()
        {
            var tokens = MentionParser.Parse("@bob and @carol-1 too");
            tokens.Select(t => t.Username).Should().Equal("bob", "carol-1");
        }

        [Fact]
        public void Ignores_Email_Like_Text()
        {
            // '@' preceded by a non-space char is not a mention.
            MentionParser.Parse("mail me at foo@bar.com").Should().BeEmpty();
        }

        [Fact]
        public void Matches_Mention_After_Newline()
        {
            MentionParser.Parse("line1\n@dave").Select(t => t.Username).Should().Equal("dave");
        }

        [Fact]
        public void Empty_Or_Null_Yields_None()
        {
            MentionParser.Parse("").Should().BeEmpty();
            MentionParser.Parse(null!).Should().BeEmpty();
        }
    }
}
