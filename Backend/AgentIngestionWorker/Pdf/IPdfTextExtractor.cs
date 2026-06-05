namespace AgentIngestionWorker.Pdf;

public interface IPdfTextExtractor
{
    string ExtractText(byte[] pdfBytes);
}
