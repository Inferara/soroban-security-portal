using System.Text;
using System.Text.Json;

namespace AgentIngestionWorker.OpenCode;

public static class OpenCodeTranscriptFormatter
{
    // Appends a human-readable, markdown-formatted rendering of one opencode --format json line.
    public static void Append(StringBuilder sb, string jsonLine)
    {
        if (string.IsNullOrWhiteSpace(jsonLine)) return;
        JsonElement root;
        try { using var doc = JsonDocument.Parse(jsonLine); root = doc.RootElement.Clone(); }
        catch (JsonException) { return; } // opencode also prints non-JSON log lines — skip them
        if (!root.TryGetProperty("part", out var part) || part.ValueKind != JsonValueKind.Object) return;
        var pt = part.TryGetProperty("type", out var ptp) ? ptp.GetString() : null;
        switch (pt)
        {
            case "text":
                if (part.TryGetProperty("text", out var tx) && tx.ValueKind == JsonValueKind.String)
                    sb.Append(tx.GetString());
                break;
            case "reasoning":
                if (part.TryGetProperty("text", out var rx) && rx.ValueKind == JsonValueKind.String)
                {
                    var t = (rx.GetString() ?? "").Trim();
                    if (t.Length > 0) sb.Append("\n\n> 💭 ").Append(t.Replace("\n", "\n> ")).Append('\n');
                }
                break;
            case "tool":
            {
                var tool = part.TryGetProperty("tool", out var tl) && tl.ValueKind == JsonValueKind.String ? tl.GetString() : "tool";
                sb.Append("\n\n**🔧 ").Append(tool).Append("**");
                if (part.TryGetProperty("state", out var st) && st.ValueKind == JsonValueKind.Object
                    && st.TryGetProperty("input", out var inp))
                {
                    var s = inp.ToString();
                    if (s.Length > 200) s = s.Substring(0, 200) + "…";
                    sb.Append(" — `").Append(s.Replace("`", "'")).Append('`');
                }
                sb.Append('\n');
                break;
            }
            case "step-finish":
                if (part.TryGetProperty("tokens", out var tok) && tok.TryGetProperty("total", out var tt))
                    sb.Append("\n\n_— step complete (").Append(tt.GetRawText()).Append(" tokens) —_\n");
                break;
            default:
                break;
        }
    }
}
