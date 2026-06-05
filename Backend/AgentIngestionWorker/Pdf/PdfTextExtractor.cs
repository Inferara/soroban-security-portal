using System.Text;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;

namespace AgentIngestionWorker.Pdf;

public sealed class PdfTextExtractor : IPdfTextExtractor
{
    /// <summary>
    /// Extracts text from PDF bytes using PdfPig, mirroring PdfToMarkdownConverter's
    /// page-by-page approach (headers, bold phrases, regular text).
    /// Returns "" for empty, null, or unreadable input.
    /// </summary>
    public string ExtractText(byte[] pdfBytes)
    {
        if (pdfBytes is not { Length: > 0 })
            return "";

        try
        {
            var markdown = new StringBuilder();
            using var pdfDocument = PdfDocument.Open(pdfBytes);
            foreach (var page in pdfDocument.GetPages())
            {
                ConvertPageToMarkdown(page, markdown);
            }
            return markdown.ToString().Replace("\0", "");
        }
        catch
        {
            return "";
        }
    }

    private static void ConvertPageToMarkdown(Page page, StringBuilder markdownBuilder)
    {
        const double newLineYThreshold = 10;
        const double headerFontSizeThreshold = 1.2;

        var letters = page.Letters;
        var words = page.GetWords();
        var averageFontSize = letters.Count > 0 ? letters.Average(l => l.FontSize) : 8;

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
                CloseBoldPhrase(markdownBuilder, boldPhraseBuilder, ref isBoldPhrase);
                markdownBuilder.AppendLine();
            }

            if (fontSize > averageFontSize * headerFontSizeThreshold)
            {
                CloseBoldPhrase(markdownBuilder, boldPhraseBuilder, ref isBoldPhrase);
                markdownBuilder.AppendLine($"# {wordText}");
            }
            else if (isBold)
            {
                isBoldPhrase = true;
                boldPhraseBuilder.Append($"{wordText} ");
            }
            else
            {
                CloseBoldPhrase(markdownBuilder, boldPhraseBuilder, ref isBoldPhrase);
                markdownBuilder.Append($"{wordText} ");
            }

            previousY = currentY;
        }

        CloseBoldPhrase(markdownBuilder, boldPhraseBuilder, ref isBoldPhrase);
        markdownBuilder.AppendLine("\n");
    }

    private static void CloseBoldPhrase(StringBuilder markdownBuilder, StringBuilder boldPhraseBuilder, ref bool isBoldPhrase)
    {
        if (isBoldPhrase)
        {
            markdownBuilder.Append($"**{boldPhraseBuilder}** ");
            boldPhraseBuilder.Clear();
            isBoldPhrase = false;
        }
    }
}
