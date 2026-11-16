using System.Text.RegularExpressions;

namespace SorobanSecurityPortalApi.Common
{
    public static class MarkdownPlainText
    {
        public static string StripMarkdown(string? markdown)
        {
            if (string.IsNullOrWhiteSpace(markdown))
                return string.Empty;

            var s = markdown;

            // Remove fenced code block lines
            s = Regex.Replace(s, @"^```[^\r\n]*$", " ", RegexOptions.Multiline);
            // Inline code `code` -> code
            s = Regex.Replace(s, @"`([^`]+)`", "$1");
            // Images ![alt](url) -> alt
            s = Regex.Replace(s, @"!\[([^\]]*)\]\([^\)]*\)", "$1");
            // Links [text](url) -> text
            s = Regex.Replace(s, @"\[([^\]]+)\]\([^\)]*\)", "$1");
            // Headings ### Heading -> Heading
            s = Regex.Replace(s, @"^\s*#{1,6}\s+", "", RegexOptions.Multiline);
            // Blockquotes > quote -> quote
            s = Regex.Replace(s, @"^\s*>+\s?", "", RegexOptions.Multiline);
            // Bold/italic/strikethrough markers
            s = Regex.Replace(s, @"(\*\*|__|~~)(.*?)\1", "$2");
            s = Regex.Replace(s, @"(\*|_)(.*?)\1", "$2");
            // Unordered list markers at line start
            s = Regex.Replace(s, @"^\s*[-*+]\s+", "", RegexOptions.Multiline);
            // Collapse all whitespace and newlines into single spaces
            s = Regex.Replace(s, @"\s+", " ").Trim();

            return s;
        }
    }
}
