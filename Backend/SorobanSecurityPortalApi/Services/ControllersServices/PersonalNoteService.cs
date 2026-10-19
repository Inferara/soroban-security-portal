using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class PersonalNoteService : IPersonalNoteService
    {
        public const int MaxNoteLength = 10000;

        private readonly IPersonalNoteProcessor _personalNoteProcessor;
        private readonly IUserContextAccessor _userContextAccessor;

        public PersonalNoteService(
            IUserContextAccessor userContextAccessor,
            IPersonalNoteProcessor personalNoteProcessor)
        {
            _userContextAccessor = userContextAccessor;
            _personalNoteProcessor = personalNoteProcessor;
        }

        public async Task<List<PersonalNoteViewModel>> List()
        {
            var userId = await GetAuthenticatedUserIdAsync();
            return await _personalNoteProcessor.List(userId);
        }

        public async Task<PersonalNoteViewModel?> GetByVulnerability(int vulnerabilityId)
        {
            if (vulnerabilityId <= 0)
            {
                throw new ArgumentException("VulnerabilityId must be a positive integer.", nameof(vulnerabilityId));
            }

            var userId = await GetAuthenticatedUserIdAsync();
            return await _personalNoteProcessor.GetByVulnerability(vulnerabilityId, userId);
        }

        public async Task<PersonalNoteViewModel> Save(int vulnerabilityId, string content)
        {
            if (vulnerabilityId <= 0)
            {
                throw new ArgumentException("VulnerabilityId must be a positive integer.", nameof(vulnerabilityId));
            }

            var trimmed = content?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(trimmed))
            {
                throw new ArgumentException("Note content cannot be empty.", nameof(content));
            }

            if (trimmed.Length > MaxNoteLength)
            {
                throw new ArgumentException($"Note content must not exceed {MaxNoteLength} characters.", nameof(content));
            }

            var userId = await GetAuthenticatedUserIdAsync();
            return await _personalNoteProcessor.Upsert(vulnerabilityId, userId, trimmed);
        }

        public async Task Delete(int id)
        {
            if (id <= 0)
            {
                throw new ArgumentException("Note ID must be a positive integer.", nameof(id));
            }

            var userId = await GetAuthenticatedUserIdAsync();
            await _personalNoteProcessor.Delete(id, userId);
        }

        public async Task DeleteByVulnerability(int vulnerabilityId)
        {
            if (vulnerabilityId <= 0)
            {
                throw new ArgumentException("VulnerabilityId must be a positive integer.", nameof(vulnerabilityId));
            }

            var userId = await GetAuthenticatedUserIdAsync();
            await _personalNoteProcessor.DeleteByVulnerability(vulnerabilityId, userId);
        }

        private async Task<int> GetAuthenticatedUserIdAsync()
        {
            var userId = await _userContextAccessor.GetLoginIdAsync();
            if (userId <= 0)
            {
                throw new UnauthorizedAccessException("User is not authenticated.");
            }
            return userId;
        }
    }

    public interface IPersonalNoteService
    {
        Task<List<PersonalNoteViewModel>> List();
        Task<PersonalNoteViewModel?> GetByVulnerability(int vulnerabilityId);
        Task<PersonalNoteViewModel> Save(int vulnerabilityId, string content);
        Task Delete(int id);
        Task DeleteByVulnerability(int vulnerabilityId);
    }
}
