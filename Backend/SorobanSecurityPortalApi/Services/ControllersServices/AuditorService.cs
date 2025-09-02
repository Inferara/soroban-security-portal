using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Common;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class AuditorService : IAuditorService
    {
        private readonly IMapper _mapper;
        private readonly IAuditorProcessor _auditorProcessor;
        private readonly UserContextAccessor _userContextAccessor;

        public AuditorService(
            IMapper mapper,
            IAuditorProcessor auditorProcessor,
            UserContextAccessor userContextAccessor)
        {
            _mapper = mapper;
            _auditorProcessor = auditorProcessor;
            _userContextAccessor = userContextAccessor;
        }

        public async Task<AuditorViewModel> Add(AuditorViewModel auditorViewModel)
        {
            var auditorModel = _mapper.Map<AuditorModel>(auditorViewModel);
            auditorModel.CreatedBy = await _userContextAccessor.GetLoginNameAsync();
            auditorModel.Date = DateTime.UtcNow;
            auditorModel = await _auditorProcessor.Add(auditorModel);
            return _mapper.Map<AuditorViewModel>(auditorModel);
        }

        public async Task<List<AuditorViewModel>> List()
        {
            var auditors = await _auditorProcessor.List();
            return _mapper.Map<List<AuditorViewModel>>(auditors);
        }

        public async Task Delete(int id)
        {
            await _auditorProcessor.Delete(id);
        }

        public async Task<Result<AuditorViewModel, string>> Update(AuditorViewModel auditorViewModel)
        {
            var auditorModel = _mapper.Map<AuditorModel>(auditorViewModel);
            var loginName = await _userContextAccessor.GetLoginNameAsync();
            if (!await CanUpdateAuditor(auditorModel, loginName))
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

        private async Task<bool> CanUpdateAuditor(AuditorModel auditorModel, string login)
        {
            if (auditorModel.CreatedBy == login || await _userContextAccessor.IsLoginAdmin(login))
            {
                return true;
            }
            else
            {
                if (await _userContextAccessor.IsLoginAdmin(auditorModel.CreatedBy))
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
        Task Delete(int id);
        Task<Result<AuditorViewModel, string>> Update(AuditorViewModel auditorViewModel);
        Task<AuditorStatisticsChangesViewModel> GetStatisticsChanges();
    }
}
