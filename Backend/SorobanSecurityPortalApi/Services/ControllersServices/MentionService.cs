using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using System.Text.RegularExpressions;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class MentionService : IMentionService
    {
        private readonly IMentionProcessor _mentionProcessor;
        private readonly ILoginProcessor _loginProcessor;
        private readonly INotificationProcessor _notificationProcessor;

        public MentionService(
            IMentionProcessor mentionProcessor,
            ILoginProcessor loginProcessor,
            INotificationProcessor notificationProcessor)
        {
            _mentionProcessor = mentionProcessor;
            _loginProcessor = loginProcessor;
            _notificationProcessor = notificationProcessor;
        }

        public async Task<List<MentionModel>> ParseAndCreateMentions(
            string content,
            string entityType,
            int entityId,
            int mentionedByUserId)
        {
            var mentions = ParseMentionsFromContent(content, entityType, entityId, mentionedByUserId);

            if (mentions.Any())
            {
                // Validate that mentioned users exist
                var usernames = mentions.Select(m => m.MentionedUsername).Distinct().ToList();
                var existingUsers = await _loginProcessor.SearchUsers(string.Join(" ", usernames), 100);

                // Filter mentions to only include existing users
                var validUsernames = existingUsers.Select(u => u.Login).ToHashSet();
                mentions = mentions.Where(m => validUsernames.Contains(m.MentionedUsername)).ToList();

                // Set the actual user IDs and create notifications
                var notifications = new List<NotificationModel>();
                foreach (var mention in mentions)
                {
                    var user = existingUsers.FirstOrDefault(u => u.Login == mention.MentionedUsername);
                    if (user != null)
                    {
                        mention.MentionedUserId = user.LoginId;

                        // Create notification for the mentioned user
                        var notification = new NotificationModel
                        {
                            RecipientUserId = user.LoginId,
                            SenderUserId = mentionedByUserId,
                            Type = "mention",
                            Title = "You were mentioned",
                            Message = $"You were mentioned in a {entityType}",
                            EntityType = entityType,
                            EntityId = entityId,
                            ActionUrl = $"/{entityType}/{entityId}",
                            CreatedAt = DateTime.UtcNow,
                            IsRead = false
                        };
                        notifications.Add(notification);
                    }
                }

                await _mentionProcessor.CreateMentions(mentions);

                // Create notifications
                if (notifications.Any())
                {
                    await _notificationProcessor.CreateNotifications(notifications);
                }
            }

            return mentions;
        }

        public async Task UpdateMentionsForEntity(
            string content,
            string entityType,
            int entityId,
            int mentionedByUserId)
        {
            // Delete existing mentions
            await _mentionProcessor.DeleteMentionsForEntity(entityType, entityId);

            // Create new mentions
            await ParseAndCreateMentions(content, entityType, entityId, mentionedByUserId);
        }

        private List<MentionModel> ParseMentionsFromContent(
            string content,
            string entityType,
            int entityId,
            int mentionedByUserId)
        {
            var mentions = new List<MentionModel>();
            var mentionRegex = new Regex(@"\B@(\w+)", RegexOptions.IgnoreCase);

            foreach (Match match in mentionRegex.Matches(content))
            {
                var username = match.Groups[1].Value;
                var startPosition = match.Index;
                var endPosition = match.Index + match.Length;

                mentions.Add(new MentionModel
                {
                    MentionedUsername = username,
                    MentionedUserId = 0, // Will be set after validation
                    MentionedByUserId = mentionedByUserId,
                    EntityType = entityType,
                    EntityId = entityId,
                    StartPosition = startPosition,
                    EndPosition = endPosition,
                    CreatedAt = DateTime.UtcNow
                });
            }

            return mentions;
        }

        public async Task<List<MentionModel>> GetMentionsForEntity(string entityType, int entityId)
        {
            return await _mentionProcessor.GetMentionsForEntity(entityType, entityId);
        }

        public async Task<List<MentionModel>> GetMentionsByUser(int userId)
        {
            return await _mentionProcessor.GetMentionsByUser(userId);
        }
    }

    public interface IMentionService
    {
        Task<List<MentionModel>> ParseAndCreateMentions(
            string content,
            string entityType,
            int entityId,
            int mentionedByUserId);
        Task UpdateMentionsForEntity(
            string content,
            string entityType,
            int entityId,
            int mentionedByUserId);
        Task<List<MentionModel>> GetMentionsForEntity(string entityType, int entityId);
        Task<List<MentionModel>> GetMentionsByUser(int userId);
    }
}