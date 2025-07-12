using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Common;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class ProjectService : IProjectService
    {
        private readonly IMapper _mapper;
        private readonly IProjectProcessor _projectProcessor;
        private readonly UserContextAccessor _userContextAccessor;

        public ProjectService(
            IMapper mapper,
            IProjectProcessor projectProcessor,
            UserContextAccessor userContextAccessor)
        {
            _mapper = mapper;
            _projectProcessor = projectProcessor;
            _userContextAccessor = userContextAccessor;
        }

        public async Task<ProjectViewModel> Add(ProjectViewModel projectViewModel)
        {
            var projectModel = _mapper.Map<ProjectModel>(projectViewModel);
            projectModel.CreatedBy = await _userContextAccessor.GetLoginNameAsync();
            projectModel.Date = DateTime.UtcNow;
            projectModel = await _projectProcessor.Add(projectModel);
            return _mapper.Map<ProjectViewModel>(projectModel);
        }

        public async Task<List<ProjectViewModel>> List()
        {
            var projects = await _projectProcessor.List();
            return _mapper.Map<List<ProjectViewModel>>(projects);
        }

        public async Task Delete(int id)
        {
            await _projectProcessor.Delete(id);
        }

        public async Task<ProjectViewModel> Update(ProjectViewModel projectViewModel)
        {
            var projectModel = _mapper.Map<ProjectModel>(projectViewModel);
            projectModel = await _projectProcessor.Update(projectModel);
            return _mapper.Map<ProjectViewModel>(projectModel);
        }
    }

    public interface IProjectService
    {
        Task<ProjectViewModel> Add(ProjectViewModel projectViewModel);
        Task<List<ProjectViewModel>> List();
        Task Delete(int id);
        Task<ProjectViewModel> Update(ProjectViewModel projectViewModel);
    }
}
