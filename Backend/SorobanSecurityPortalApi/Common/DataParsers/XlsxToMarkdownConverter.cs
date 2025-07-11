using System.Text;
using SorobanSecurityPortalApi.Common.Extensions;
using ClosedXML.Excel;

namespace SorobanSecurityPortalApi.Common.DataParsers
{
    public class XlsxToMarkdownConverter
    {
        public static string ConvertToMarkdown(string base64File)
        {
            try
            {
                var byteArray = Convert.FromBase64String(base64File.StripBase64());
                using var stream = new MemoryStream(byteArray);
                using var workbook = new XLWorkbook(stream);
                var markdown = new StringBuilder();
                foreach (var worksheet in workbook.Worksheets)
                {
                    markdown.AppendLine($"## {worksheet.Name}");
                    markdown.AppendLine();

                    var isFirstRow = true;
                    var columnsCount = worksheet.FirstRowUsed()?.Cells().Count() ?? 0; // Get the number of columns from the first row

                    foreach (var row in worksheet.RowsUsed())
                    {
                        var rowContent = new StringBuilder("|");

                        for (var i = 1; i <= columnsCount; i++)
                        {
                            var cellValue = row.Cell(i).GetValue<string>();
                            rowContent.Append($" {cellValue} |");
                        }

                        markdown.AppendLine(rowContent.ToString());

                        if (isFirstRow)
                        {
                            markdown.Append("|");
                            for (var i = 0; i < columnsCount; i++)
                                markdown.Append("-|");
                            markdown.AppendLine();
                            isFirstRow = false;
                        }
                    }
                    markdown.AppendLine();
                }
                return markdown.ToString();
            }
            catch (Exception ex)
            {
                return ex.Message;
            }
        }
    }
}