using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Caching;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class AuditorService : IAuditorService
    {
        private readonly IMapper _mapper;
        private readonly IAuditorProcessor _auditorProcessor;
        private readonly UserContextAccessor _userContextAccessor;
        private readonly ILookupCache _lookupCache;

        public AuditorService(
            IMapper mapper,
            IAuditorProcessor auditorProcessor,
            UserContextAccessor userContextAccessor,
            ILookupCache lookupCache)
        {
            _mapper = mapper;
            _auditorProcessor = auditorProcessor;
            _userContextAccessor = userContextAccessor;
            _lookupCache = lookupCache;
        }

        public async Task<AuditorViewModel> Add(AuditorViewModel auditorViewModel)
        {
            _lookupCache.Remove(LookupCacheKeys.Auditors);
            var auditorModel = _mapper.Map<AuditorModel>(auditorViewModel);
            auditorModel.CreatedBy = await _userContextAccessor.GetLoginIdAsync();
            auditorModel.Date = DateTime.UtcNow;
            auditorModel = await _auditorProcessor.Add(auditorModel);
            return _mapper.Map<AuditorViewModel>(auditorModel);
        }

        // Returns a shared cached instance — callers must treat the result as read-only (do not mutate items).
        public async Task<List<AuditorViewModel>> List()
        {
            return await _lookupCache.GetOrCreateAsync(LookupCacheKeys.Auditors, async () =>
            {
                var auditors = await _auditorProcessor.List();
                var result = _mapper.Map<List<AuditorViewModel>>(auditors);
                // Image bytes are served by /auditors/{id}/image.png; do not inline them in the bulk list.
                foreach (var a in result) a.ImageData = null;
                return result;
            });
        }

        public async Task<AuditorModel?> GetById(int id)
        {
            return await _auditorProcessor.GetById(id);
        }

        public async Task Delete(int id)
        {
            _lookupCache.Remove(LookupCacheKeys.Auditors);
            await _auditorProcessor.Delete(id);
        }

        public async Task<Result<AuditorViewModel, string>> Update(AuditorViewModel auditorViewModel)
        {
            _lookupCache.Remove(LookupCacheKeys.Auditors);
            var auditorModel = _mapper.Map<AuditorModel>(auditorViewModel);
            var loginId = await _userContextAccessor.GetLoginIdAsync();
            if (!await CanUpdateAuditor(auditorModel, loginId))
            {
                return new Result<AuditorViewModel, string>.Err("You cannot update this auditor.");
            }

            auditorModel = await _auditorProcessor.Update(auditorModel);
            return new Result<AuditorViewModel, string>.Ok(_mapper.Map<AuditorViewModel>(auditorModel));
        }

        public async Task<AuditorStatisticsChangesViewModel> GetStatisticsChanges()
        {
            var statsChange = await _auditorProcessor.GetStatisticsChanges();
            return _mapper.Map<AuditorStatisticsChangesViewModel>(statsChange);
        }

        private async Task<bool> CanUpdateAuditor(AuditorModel auditorModel, int loginId)
        {
            if (auditorModel.CreatedBy == loginId || await _userContextAccessor.IsLoginIdAdmin(loginId))
            {
                return true;
            }
            else
            {
                if (await _userContextAccessor.IsLoginIdAdmin(auditorModel.CreatedBy))
                {
                    return false;
                }
                return true;
            }
        }
    }

    public interface IAuditorService
    {
        Task<AuditorViewModel> Add(AuditorViewModel auditorViewModel);
        Task<List<AuditorViewModel>> List();
        Task<AuditorModel?> GetById(int id);
        Task Delete(int id);
        Task<Result<AuditorViewModel, string>> Update(AuditorViewModel auditorViewModel);
        Task<AuditorStatisticsChangesViewModel> GetStatisticsChanges();
    }
}
