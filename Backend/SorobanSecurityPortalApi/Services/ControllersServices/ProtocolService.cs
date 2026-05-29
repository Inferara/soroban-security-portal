using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Caching;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class ProtocolService : IProtocolService
    {
        private readonly IMapper _mapper;
        private readonly IProtocolProcessor _protocolProcessor;
        private readonly UserContextAccessor _userContextAccessor;
        private readonly ILookupCache _lookupCache;

        public ProtocolService(
            IMapper mapper,
            IProtocolProcessor protocolProcessor,
            UserContextAccessor userContextAccessor,
            ILookupCache lookupCache)
        {
            _mapper = mapper;
            _protocolProcessor = protocolProcessor;
            _userContextAccessor = userContextAccessor;
            _lookupCache = lookupCache;
        }

        public async Task<ProtocolViewModel> Add(ProtocolViewModel protocolViewModel)
        {
            _lookupCache.Remove(LookupCacheKeys.Protocols);
            var protocolModel = _mapper.Map<ProtocolModel>(protocolViewModel);
            protocolModel.CreatedBy = await _userContextAccessor.GetLoginIdAsync();
            protocolModel.Date = DateTime.UtcNow;
            protocolModel = await _protocolProcessor.Add(protocolModel);
            return _mapper.Map<ProtocolViewModel>(protocolModel);
        }

        // Returns a shared cached instance — callers must treat the result as read-only (do not mutate items).
        public async Task<List<ProtocolViewModel>> List()
        {
            return await _lookupCache.GetOrCreateAsync(LookupCacheKeys.Protocols, async () =>
            {
                var protocols = await _protocolProcessor.List();
                var result = _mapper.Map<List<ProtocolViewModel>>(protocols);
                // Image bytes are served by /protocols/{id}/image.png; do not inline them in the bulk list.
                foreach (var p in result) p.ImageData = null;
                return result;
            });
        }

        public async Task<ProtocolModel?> GetById(int id)
        {
            return await _protocolProcessor.GetById(id);
        }

        public async Task Delete(int id)
        {
            _lookupCache.Remove(LookupCacheKeys.Protocols);
            await _protocolProcessor.Delete(id);
        }

        public async Task<Result<ProtocolViewModel, string>> Update(ProtocolViewModel protocolViewModel)
        {
            _lookupCache.Remove(LookupCacheKeys.Protocols);
            var protocolModel = _mapper.Map<ProtocolModel>(protocolViewModel);
            var loginId = await _userContextAccessor.GetLoginIdAsync();
            if (! await CanUpdateProtocol(protocolModel, loginId))
            {
                return new Result<ProtocolViewModel, string>.Err("You cannot update this protocol.");
            }
            protocolModel = await _protocolProcessor.Update(protocolModel);
            return new Result<ProtocolViewModel, string>.Ok(_mapper.Map<ProtocolViewModel>(protocolModel));
        }

        public async Task<ProtocolStatisticsChangesViewModel> GetStatisticsChanges()
        {
            var statsChange = await _protocolProcessor.GetStatisticsChanges();
            return _mapper.Map<ProtocolStatisticsChangesViewModel>(statsChange);
        }

        private async Task<bool> CanUpdateProtocol(ProtocolModel protocolModel, int loginId)
        {
            if (protocolModel.CreatedBy == loginId || await _userContextAccessor.IsLoginIdAdmin(loginId))
            {
                return true;
            }
            else
            {
                if (await _userContextAccessor.IsLoginIdAdmin(protocolModel.CreatedBy))
                {
                    return false;
                }
                return true;
            }
        }
    }

    public interface IProtocolService
    {
        Task<ProtocolViewModel> Add(ProtocolViewModel protocolViewModel);
        Task<List<ProtocolViewModel>> List();
        Task<ProtocolModel?> GetById(int id);
        Task Delete(int id);
        Task<Result<ProtocolViewModel, string>> Update(ProtocolViewModel protocolViewModel);
        Task<ProtocolStatisticsChangesViewModel> GetStatisticsChanges();
    }
}
