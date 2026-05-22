using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Services.Moderation
{
    public class ModerationTargetRegistry : IModerationTargetRegistry
    {
        private readonly Dictionary<ModeratedContentType, IModerationTarget> _targets;

        public ModerationTargetRegistry(IEnumerable<IModerationTarget> targets)
            => _targets = targets.ToDictionary(t => t.ContentType);

        public IModerationTarget Get(ModeratedContentType type) => _targets[type];

        public bool TryGet(ModeratedContentType type, out IModerationTarget target)
            => _targets.TryGetValue(type, out target!);
    }
}
