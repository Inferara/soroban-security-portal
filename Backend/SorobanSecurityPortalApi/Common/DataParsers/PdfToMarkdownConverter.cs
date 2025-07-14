using System.Text;
using SorobanSecurityPortalApi.Common.Extensions;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;

namespace SorobanSecurityPortalApi.Common.DataParsers
{ 
    public class PdfToMarkdownConverter
    {
        public static string ConvertToMarkdown(string base64File)
        {
            var byteArray = Convert.FromBase64String(base64File.StripBase64());
            return ConvertToMarkdown(byteArray);
        }

        public static string ConvertToMarkdown(byte[] byteArray)
        {
            try
            {
                var markdown = new StringBuilder();
                using (var pdfDocument = PdfDocument.Open(byteArray))
                {
                    foreach (var page in pdfDocument.GetPages())
                    {
                        ConvertPageToMarkdown(page, markdown);
                    }
                }
                return markdown.ToString().Replace("\0", "");
            }
            catch (Exception ex)
            {
                return ex.Message;
            }
        }

        static void ConvertPageToMarkdown(Page page, StringBuilder markdownBuilder)
        {
            var newLineYThreshold = 10;
            var headerFontSizeThreshold = 1.2;
            var letters = page.Letters;
            var words = page.GetWords();
            var averageFontSize = letters.Average(l => l.FontSize);
            var previousY = double.MaxValue;
            var boldPhraseBuilder = new StringBuilder();
            var isBoldPhrase = false;
            foreach (var word in words)
            {
                var wordText = word.Text;
                var fontSize = word.Letters[0].FontSize;
                var isBold = word.Letters[0].Font.IsBold;
                var currentY = word.BoundingBox.Bottom;

                if (Math.Abs(currentY - previousY) > newLineYThreshold)
                {
                    // Detect new line
                    CloseBoldPhrase(markdownBuilder, boldPhraseBuilder, ref isBoldPhrase);
                    markdownBuilder.AppendLine();
                }
                if (fontSize > averageFontSize * headerFontSizeThreshold)
                {
                    // Header detection
                    CloseBoldPhrase(markdownBuilder, boldPhraseBuilder, ref isBoldPhrase);
                    markdownBuilder.AppendLine($"# {wordText}");
                }
                else if (isBold)
                {
                    // Bold text detection
                    isBoldPhrase = true;
                    boldPhraseBuilder.Append($"{wordText} ");
                }
                else
                {
                    // Regular text
                    CloseBoldPhrase(markdownBuilder, boldPhraseBuilder, ref isBoldPhrase);
                    markdownBuilder.Append($"{wordText} ");
                }
                previousY = currentY;
            }
            CloseBoldPhrase(markdownBuilder, boldPhraseBuilder, ref isBoldPhrase);
            // Add line break after each page
            markdownBuilder.AppendLine("\n");
        }

        static void CloseBoldPhrase(StringBuilder markdownBuilder, StringBuilder boldPhraseBuilder, ref bool isBoldPhrase)
        {
            if (isBoldPhrase)
            {
                markdownBuilder.Append($"**{boldPhraseBuilder}** ");
                boldPhraseBuilder.Clear();
                isBoldPhrase = false;
            }
        }

    }
}