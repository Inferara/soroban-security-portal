using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.DataParsers;
using SorobanSecurityPortalApi.Common.Extensions;
using Newtonsoft.Json;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class MessageDialogViewModel
    {
        public string? ConversationId { get; set; }
        public List<Message>? Messages { get; set; }
        public class Message
        {
            public string Sender { get; set; } = string.Empty;
            public string Text { get; set; } = string.Empty;
            [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
            public List<MessageSource>? Sources { get; set; }
            [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
            public List<UploadFile>? Files { get; set; }
            public bool HasFiles() => Files != null && Files.Count > 0;
            public string GetFileNames() => string.Join(", ", Files?.Select(f => f.Name) ?? Array.Empty<string>());
            public string GetFileContents() => string.Join('\n', Files?.Select(f => f.GetFileContent()) ?? Array.Empty<string>());
            public void AddFile(string name, string base64Data, int? size = null)
            {
                Files ??= new List<UploadFile>();
                Files.Add(new UploadFile { Name = name, Size = size ?? Convert.FromBase64String(base64Data).Length, Base64Data = base64Data });
            }
            [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
            public List<DebugMessage>? DebugMessages { get; set; }
            [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
            public Dictionary<string, TokensSpent>? SpentTokens { get; set; }
            [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
            public CallOptions[]? Options { get; set; }
            public string ChatItemId { get; set; } = string.Empty;
        }

        public class CallOptions
        {
            public CallOptionsType Type { get; set; } = CallOptionsType.AgentCall;
            public string Name { get; set; } = string.Empty;
            public Dictionary<string, string> Parameters { get; set; } = new();
            public enum CallOptionsType
            {
                AgentCall = 1,
                ClientHandle = 2,
            }
        }

        public class TokensSpent
        {
            public int Request { get; set; } = 0;
            public int Response { get; set; } = 0;
        }

        public class DebugMessage
        {
            public string Sender { get; set; } = string.Empty;
            public DateTime DateTime { get; set; } = DateTime.Now;
            public string Title { get; set; } = string.Empty;
            public string Details { get; set; } = string.Empty;
            public int Level { get; set; } = 0;
        }

        public class UploadFile
        {
            public string Name { get; set; } = string.Empty;
            public int Size { get; set; } = 0;
            public string Base64Data { get; set; } = string.Empty;

            private string? _fileContent;
            public string GetFileContent()
            {
                if (string.IsNullOrWhiteSpace(Base64Data))
                    return string.Empty;
                if (_fileContent == null)
                {
                    if (Name.EndsWith(".docx", StringComparison.OrdinalIgnoreCase))
                        _fileContent ??= DocxToMarkdownConverter.ConvertToMarkdown(Base64Data);
                    else if (Name.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
                        _fileContent ??= XlsxToMarkdownConverter.ConvertToMarkdown(Base64Data);
                    else if (Name.EndsWith(".pptx", StringComparison.OrdinalIgnoreCase))
                        _fileContent ??= PptxToMarkdownConverter.ConvertToMarkdown(Base64Data);
                    else if (Name.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                        _fileContent ??= PdfToMarkdownConverter.ConvertToMarkdown(Base64Data);
                    else
                        _fileContent ??= Base64ToTextConverter.ConvertToText(Base64Data);
                }
                return $"File: {Name}\nContent:\n{_fileContent}\n\n";
            } 
        }

        public class MessageSource
        {
            public string Name { get; set; } = string.Empty;
            public string? Url { get; set; } = string.Empty;

        }

        public string GetQuestion() => Messages!.Last().Text;
        public void ClearFilesContent()
        {
            // Clear files content to reduce the size of the response. Leave only the last message files.
            if (Messages == null || Messages.Count < 2)
                return;
            for (var i = 0; i < Messages.Count - 1; i++) {
                Messages[i].Files?.ForEach(f => f.Base64Data = string.Empty);
            }
        }

        public string GetHistory(int maxHistoryLength)
        {
            var from = Math.Max(0, Messages.Count - maxHistoryLength);
            var count = Math.Min(maxHistoryLength, Messages.Count - 1);
            var previousMessages = Messages
                .GetRange(from, count)
                .Select(message => new
                {
                    Text = message.Text,
                    Sender = message.Sender
                })
                .ToList();
            return previousMessages.ToJson() ?? "";
        }
    }
}
