using AutoMapper;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using System.Text.RegularExpressions;
using Markdig; 

namespace SorobanSecurityPortalApi.Services.ProcessingServices
{
    public class CommentService : ICommentService
    {
        private readonly ICommentProcessor _processor;
        private readonly IMapper _mapper;
        private readonly MarkdownPipeline _pipeline;

        public CommentService(ICommentProcessor processor, IMapper mapper)
        {
            _processor = processor;
            _mapper = mapper;
            _pipeline = new MarkdownPipelineBuilder().UseAdvancedExtensions().Build();
        }

        private static readonly Regex MentionRegex = new Regex(
            @"@(\w+)", 
            RegexOptions.Compiled | RegexOptions.IgnoreCase
        );

        public async Task<List<CommentViewModel>> GetThreadedComments(string entityType, int entityId)
        {
            var rawComments = await _processor.GetCommentsForEntity(entityType, entityId);
            var viewModels = _mapper.Map<List<CommentViewModel>>(rawComments);

            var commentLookup = viewModels.ToDictionary(c => c.Id);
            var rootNodes = new List<CommentViewModel>();

            foreach (var comment in viewModels)
            {
                if (comment.ParentCommentId.HasValue && commentLookup.ContainsKey(comment.ParentCommentId.Value))
                {
                    commentLookup[comment.ParentCommentId.Value].Replies.Add(comment);
                }
                else
                {
                    rootNodes.Add(comment);
                }
            }

            return rootNodes;
        }

        public async Task<CommentViewModel> PostComment(int authorId, string entityType, int entityId, string content, int? parentId = null)
        {
            var comment = new CommentModel
            {
                AuthorId = authorId,
                EntityType = entityType,
                EntityId = entityId,
                Content = content,
                ParentCommentId = parentId,
                ContentHtml = Markdown.ToHtml(content, _pipeline),
                Status = CommentStatus.Active
            };

            comment.Mentions = ParseMentions(content);

            var savedComment = await _processor.AddComment(comment);
            
            var fullComment = await _processor.GetCommentById(savedComment.Id);
            return _mapper.Map<CommentViewModel>(fullComment);
        }

        private List<MentionModel> ParseMentions(string content)
        {
            var mentions = new List<MentionModel>();
            if (string.IsNullOrWhiteSpace(content)) return mentions;

            var matches = MentionRegex.Matches(content);

            foreach (Match match in matches)
            {
                mentions.Add(new MentionModel
                {
                    StartIndex = match.Index,
                    Length = match.Length
                });
            }

            return mentions;
        }

        public async Task<bool> DeleteComment(int commentId, int userId)
        {
            var comment = await _processor.GetCommentById(commentId);

            if (comment == null)
            {
                return false;
            }

            if (comment.AuthorId != userId)
            {
                return false; 
            }

            return await _processor.SoftDeleteComment(commentId);
        }

        public async Task<bool> ToggleVote(int commentId, int userId, bool isUpvote)
        {
            return await _processor.UpdateVoteCounts(commentId, isUpvote ? 1 : 0, isUpvote ? 0 : 1);
        }
    }
}