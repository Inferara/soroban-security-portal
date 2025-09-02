using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Common;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class ProtocolService : IProtocolService
    {
        private readonly IMapper _mapper;
        private readonly IProtocolProcessor _protocolProcessor;
        private readonly UserContextAccessor _userContextAccessor;

        public ProtocolService(
            IMapper mapper,
            IProtocolProcessor protocolProcessor,
            UserContextAccessor userContextAccessor)
        {
            _mapper = mapper;
            _protocolProcessor = protocolProcessor;
            _userContextAccessor = userContextAccessor;
        }

        public async Task<ProtocolViewModel> Add(ProtocolViewModel protocolViewModel)
        {
            var protocolModel = _mapper.Map<ProtocolModel>(protocolViewModel);
            protocolModel.CreatedBy = await _userContextAccessor.GetLoginNameAsync();
            protocolModel.Date = DateTime.UtcNow;
            protocolModel = await _protocolProcessor.Add(protocolModel);
            return _mapper.Map<ProtocolViewModel>(protocolModel);
        }

        public async Task<List<ProtocolViewModel>> List()
        {
            var protocols = await _protocolProcessor.List();
            return _mapper.Map<List<ProtocolViewModel>>(protocols);
        }

        public async Task Delete(int id)
        {
            await _protocolProcessor.Delete(id);
        }

        public async Task<Result<ProtocolViewModel, string>> Update(ProtocolViewModel protocolViewModel)
        {
            var protocolModel = _mapper.Map<ProtocolModel>(protocolViewModel);
            var loginName = await _userContextAccessor.GetLoginNameAsync();
            if (! await CanUpdateProtocol(protocolModel, loginName))
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

        private async Task<bool> CanUpdateProtocol(ProtocolModel protocolModel, string login)
        {
            if (protocolModel.CreatedBy == login || await _userContextAccessor.IsLoginAdmin(login))
            {
                return true;
            }
            else
            {
                if (await _userContextAccessor.IsLoginAdmin(protocolModel.CreatedBy))
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
        Task Delete(int id);
        Task<Result<ProtocolViewModel, string>> Update(ProtocolViewModel protocolViewModel);
        Task<ProtocolStatisticsChangesViewModel> GetStatisticsChanges();
    }
}
