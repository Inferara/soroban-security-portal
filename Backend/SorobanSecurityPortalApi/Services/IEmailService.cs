using Microsoft.Extensions.Logging;

namespace SorobanSecurityPortalApi.Services
{
    public interface IEmailService
    {
        Task SendEmailAsync(string to, string subject, string htmlBody);
    }

    public class ConsoleEmailService : IEmailService
    {
        private readonly ILogger<ConsoleEmailService> _logger;

        public ConsoleEmailService(ILogger<ConsoleEmailService> logger)
        {
            _logger = logger;
        }

        public Task SendEmailAsync(string to, string subject, string htmlBody)
        {
            _logger.LogInformation("--------------------------------------------------");
            _logger.LogInformation($"[Email Mock] Sending to: {to}");
            _logger.LogInformation($"[Subject]: {subject}");

            if (string.IsNullOrEmpty(htmlBody))
            {
                _logger.LogInformation("[Body Snippet]: <empty>");
            }
            else
            {
                // Safely grab the first 150 chars
                int length = Math.Min(htmlBody.Length, 150);
                _logger.LogInformation($"[Body Snippet]: {htmlBody.Substring(0, length)}...");
            }
            
            _logger.LogInformation("--------------------------------------------------");
            return Task.CompletedTask;
        }
    }
}