using DocumentFormat.OpenXml.Packaging;
using System.Text;
using Html2Markdown;

namespace SorobanSecurityPortalApi.Common.DataParsers
{
    public class PptxToMarkdownConverter
    {
        public static string ConvertToMarkdown(string base64File)
        {
            try
            {
                var byteArray = Convert.FromBase64String(base64File.StartsWith("data:")
                    ? base64File.Split(';')[1].Remove(0, 7)
                    : base64File);
                var tempFilePath = Path.GetTempFileName();
                File.WriteAllBytes(tempFilePath, byteArray);

                var markdownBuilder = new StringBuilder();

                using (var presentationDocument = PresentationDocument.Open(tempFilePath, false))
                {
                    var slideIdList = presentationDocument.PresentationPart?.Presentation?.SlideIdList;
                    if (slideIdList != null)
                    {
                        foreach (var slideId in slideIdList.Elements<DocumentFormat.OpenXml.Presentation.SlideId>())
                        {
                            var slidePart = (SlidePart)presentationDocument.PresentationPart.GetPartById(slideId.RelationshipId);
                            var titleShape = slidePart.Slide.Descendants<DocumentFormat.OpenXml.Presentation.Shape>()
                                .FirstOrDefault(shape => 
                                    shape.NonVisualShapeProperties?.ApplicationNonVisualDrawingProperties?.PlaceholderShape?.Type?.Value == DocumentFormat.OpenXml.Presentation.PlaceholderValues.Title);

                            if (titleShape != null)
                            {
                                var titleText = GetShapeText(titleShape);
                                markdownBuilder.AppendLine($"# {titleText}");
                            }

                            foreach (var shape in slidePart.Slide.Descendants<DocumentFormat.OpenXml.Presentation.Shape>())
                            {
                                if (shape != titleShape)
                                {
                                    var shapeText = GetShapeText(shape);
                                    if (!string.IsNullOrEmpty(shapeText))
                                    {
                                        markdownBuilder.AppendLine($"- {shapeText}");
                                    }
                                }
                            }
                            foreach (var chartPart in slidePart.ChartParts)
                            {
                                markdownBuilder.AppendLine("### Chart");
                                markdownBuilder.AppendLine(ParseChartData(chartPart));
                            }
                            markdownBuilder.AppendLine(); 
                        }
                    }
                }

                File.Delete(tempFilePath);

                var converter = new Converter();
                var markdown = converter.Convert(markdownBuilder.ToString());

                return markdown; 
            }
            catch (Exception ex)
            {
                return ex.Message;
            }
        }

        private static string GetShapeText(DocumentFormat.OpenXml.Presentation.Shape shape)
        {
            var textBuilder = new StringBuilder();
            foreach (var paragraph in shape.TextBody?.Descendants<DocumentFormat.OpenXml.Drawing.Paragraph>() ?? Enumerable.Empty<DocumentFormat.OpenXml.Drawing.Paragraph>())
            {
                foreach (var text in paragraph.Descendants<DocumentFormat.OpenXml.Drawing.Text>())
                {
                    textBuilder.Append(text.Text);
                }
                textBuilder.AppendLine();
            }
            return textBuilder.ToString().Trim();
        }

        private static string ParseChartData(ChartPart chartPart)
        {
            var chartMarkdown = new StringBuilder();
            var chartTitle = chartPart.ChartSpace.Descendants<DocumentFormat.OpenXml.Drawing.Charts.Title>().FirstOrDefault();
            if (chartTitle != null)
            {
                var titleText = chartTitle.Descendants<DocumentFormat.OpenXml.Drawing.Text>().FirstOrDefault()?.Text;
                chartMarkdown.AppendLine($"### {titleText}");
            }

            foreach (var chartSeries in chartPart.ChartSpace.Descendants<DocumentFormat.OpenXml.Drawing.Charts.BarChartSeries>())
            {
                var seriesName = chartSeries.Descendants<DocumentFormat.OpenXml.Drawing.Charts.SeriesText>().FirstOrDefault()?.InnerText;
                if(!string.IsNullOrEmpty(seriesName))
                    chartMarkdown.AppendLine($"**Series**: {seriesName}");

                var categoryValues = chartSeries.Descendants<DocumentFormat.OpenXml.Drawing.Charts.CategoryAxisData>().FirstOrDefault();
                var numericValues = chartSeries.Descendants<DocumentFormat.OpenXml.Drawing.Charts.Values>().FirstOrDefault();
                if (categoryValues != null && numericValues != null)
                {
                    var categories = categoryValues.Descendants<DocumentFormat.OpenXml.Drawing.Charts.StringPoint>()
                        .Select(sp => sp.Descendants<DocumentFormat.OpenXml.Drawing.Charts.NumericValue>().FirstOrDefault()?.Text)
                        .ToList();

                    var values = numericValues.Descendants<DocumentFormat.OpenXml.Drawing.Charts.NumericPoint>()
                        .Select(np => np.Descendants<DocumentFormat.OpenXml.Drawing.Charts.NumericValue>().FirstOrDefault()?.Text)
                        .ToList();

                    for (var i = 0; i < categories.Count; i++)
                    {
                        var category = categories[i];
                        var value = i < values.Count ? values[i] : "[No Value]";
                        chartMarkdown.AppendLine($"- {category}: {value}");
                    }
                }
                chartMarkdown.AppendLine();
            }
            return chartMarkdown.ToString();
        }
    }
}