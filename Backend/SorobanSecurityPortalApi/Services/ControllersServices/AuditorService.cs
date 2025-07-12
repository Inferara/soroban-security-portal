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

        public async Task<AuditorViewModel> Update(AuditorViewModel auditorViewModel)
        {
            var auditorModel = _mapper.Map<AuditorModel>(auditorViewModel);
            auditorModel = await _auditorProcessor.Update(auditorModel);
            return _mapper.Map<AuditorViewModel>(auditorModel);
        }
    }

    public interface IAuditorService
    {
        Task<AuditorViewModel> Add(AuditorViewModel auditorViewModel);
        Task<List<AuditorViewModel>> List();
        Task Delete(int id);
        Task<AuditorViewModel> Update(AuditorViewModel auditorViewModel);
    }
}
