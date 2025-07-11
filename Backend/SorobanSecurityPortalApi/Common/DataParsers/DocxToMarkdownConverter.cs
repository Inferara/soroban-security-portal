using System.Text;
using SorobanSecurityPortalApi.Common.Extensions;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using DocumentFormat.OpenXml;

namespace SorobanSecurityPortalApi.Common.DataParsers
{ 
    public class DocxToMarkdownConverter
    {
        public static string ConvertToMarkdown(string base64File)
        {
            try
            {
                var markdown = new StringBuilder();
                var byteArray = Convert.FromBase64String(base64File.StripBase64());
                using var memoryStream = new MemoryStream(byteArray);
                using var wordDoc = WordprocessingDocument.Open(memoryStream, false);
                var body = wordDoc.MainDocumentPart.Document.Body;
                foreach (var element in body.Elements())
                {
                    ProcessElement(element, markdown);
                }
                return markdown.ToString();
            }
            catch (Exception ex)
            {
                return ex.Message;
            }
        }

        private static void ProcessElement(OpenXmlElement element, StringBuilder markdown)
        {
            switch (element)
            {
                case Paragraph paragraph:
                    ProcessParagraph(paragraph, markdown);
                    break;
                case Table table:
                    ProcessTable(table, markdown);
                    break;
                default:
                    // Handle other element types if needed
                    break;
            }
        }

        private static void ProcessParagraph(Paragraph paragraph, StringBuilder markdown)
        {
            var paragraphText = GetParagraphText(paragraph);
            if (string.IsNullOrWhiteSpace(paragraphText))
                return;

            var properties = paragraph.ParagraphProperties;
            if (properties != null && properties.ParagraphStyleId != null)
            {
                var style = properties.ParagraphStyleId.Val.Value;
                switch (style)
                {
                    case "Heading1":
                        markdown.AppendLine("# " + paragraphText);
                        break;
                    case "Heading2":
                        markdown.AppendLine("## " + paragraphText);
                        break;
                    case "Heading3":
                        markdown.AppendLine("### " + paragraphText);
                        break;
                    case "Heading4":
                        markdown.AppendLine("#### " + paragraphText);
                        break;
                    case "Heading5":
                        markdown.AppendLine("##### " + paragraphText);
                        break;
                    default:
                        markdown.AppendLine(paragraphText);
                        break;
                }
            }
            else
            {
                markdown.AppendLine(paragraphText);
            }
        }

        private static string GetParagraphText(Paragraph paragraph)
        {
            var paragraphText = new StringBuilder();
            foreach (var run in paragraph.Elements<Run>())
            {
                var runProperties = run.RunProperties;
                var text = run.InnerText;
                if (runProperties != null)
                {
                    if (runProperties.Bold != null)
                        text = "**" + text + "**";
                    if (runProperties.Italic != null)
                        text = "_" + text + "_";
                }
                paragraphText.Append(text);
            }
            return paragraphText.ToString();
        }

        private static void ProcessTable(Table table, StringBuilder markdown)
        {
            foreach (var row in table.Elements<TableRow>())
            {
                foreach (var cell in row.Elements<TableCell>())
                {
                    var cellText = cell.InnerText.Trim();
                    markdown.Append("| " + cellText + " ");
                }
                markdown.AppendLine("|");
            }
            markdown.AppendLine();
        }
    }
}