using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.Moderation;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public interface IContentFlagService
    {
        Task<Result<bool, string>> Flag(FlagContentRequest request);
    }

    public class ContentFlagService : IContentFlagService
    {
        private readonly IContentFlagProcessor _flags;
        private readonly IModerationTargetRegistry _registry;
        private readonly IUserContextAccessor _userContext;

        public ContentFlagService(
            IContentFlagProcessor flags,
            IModerationTargetRegistry registry,
            IUserContextAccessor userContext)
        {
            _flags = flags;
            _registry = registry;
            _userContext = userContext;
        }

        public async Task<Result<bool, string>> Flag(FlagContentRequest request)
        {
            if (!ModerationParsing.TryContentType(request.ContentType, out var type))
                return new Result<bool, string>.Err("Invalid content type");

            if (!ModerationParsing.TryReason(request.Reason, out var reason))
                return new Result<bool, string>.Err("Invalid reason");

            if (!_registry.TryGet(type, out var target))
                return new Result<bool, string>.Err("Invalid content type");

            var info = await target.Get(request.ContentId);
            if (info == null)
                return new Result<bool, string>.Err("Content not found");

            var userId = await _userContext.GetLoginIdAsync();

            if (await _flags.Exists(type, request.ContentId, userId))
                return new Result<bool, string>.Err("Already flagged");

            await _flags.Add(new ContentFlagModel
            {
                ContentType = type,
                ContentId = request.ContentId,
                FlaggedByUserId = userId,
                Reason = reason,
                Comment = request.Comment,
                CreatedAt = DateTime.UtcNow
            });

            return new Result<bool, string>.Ok(true);
        }
    }
}
