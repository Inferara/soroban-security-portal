using System;
using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class MentionProcessor : IMentionProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;
        public MentionProcessor(IDbContextFactory<Db> dbFactory) => _dbFactory = dbFactory;

        public async Task<List<int>> ReplaceCommentMentions(int commentId, string content)
        {
            var tokens = MentionParser.Parse(content);
            await using var db = await _dbFactory.CreateDbContextAsync();

            // Replace strategy: clear this comment's existing mentions, then re-insert.
            var existing = await db.Mention.Where(m => m.CommentId == commentId).ToListAsync();
            if (existing.Count > 0) db.Mention.RemoveRange(existing);

            var mentionedIds = new List<int>();
            if (tokens.Count > 0)
            {
                var usernames = tokens.Select(t => t.Username).Distinct().ToList();
                var resolved = await db.Login.AsNoTracking()
                    .Where(l => usernames.Contains(l.Login))
                    .Select(l => new { l.LoginId, l.Login })
                    .ToListAsync();
                var idByName = resolved.ToDictionary(r => r.Login, r => r.LoginId);

                foreach (var t in tokens)
                {
                    if (!idByName.TryGetValue(t.Username, out var uid)) continue;
                    db.Mention.Add(new MentionModel
                    {
                        CommentId = commentId,
                        MentionedUserId = uid,
                        StartPos = t.StartPos,
                        EndPos = t.EndPos
                    });
                    if (!mentionedIds.Contains(uid)) mentionedIds.Add(uid);
                }
            }

            await db.SaveChangesAsync();
            return mentionedIds;
        }
    }

    public interface IMentionProcessor
    {
        // Re-parses the content, resolves @usernames against the Login table, replaces the
        // comment's mention rows, and returns the distinct mentioned user ids (for notifications).
        Task<List<int>> ReplaceCommentMentions(int commentId, string content);
    }
}
