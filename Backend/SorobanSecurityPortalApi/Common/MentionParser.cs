using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace SorobanSecurityPortalApi.Common
{
    public record MentionToken(string Username, int StartPos, int EndPos);

    public static class MentionParser
    {
        // @username, where '@' is at the start of the string or preceded by whitespace
        // (so emails like foo@bar are not matched). Username = letters/digits/_/./-.
        private static readonly Regex Rx = new(@"(?<=^|\s)@([A-Za-z0-9_.\-]+)", RegexOptions.Compiled);

        public static List<MentionToken> Parse(string content)
        {
            if (string.IsNullOrEmpty(content)) return new List<MentionToken>();
            return Rx.Matches(content)
                .Select(m => new MentionToken(m.Groups[1].Value, m.Index, m.Index + m.Length))
                .ToList();
        }
    }
}
