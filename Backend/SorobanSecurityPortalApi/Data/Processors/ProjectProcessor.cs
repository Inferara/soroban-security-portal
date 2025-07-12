using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class ProjectProcessor : IProjectProcessor
    {
        private readonly Db _db;

        public ProjectProcessor(Db db)
        {
            _db = db;
        }

        public async Task<ProjectModel> Add(ProjectModel projectModel)
        {
            if (projectModel == null)
            {
                throw new ArgumentNullException(nameof(projectModel), "Project model cannot be null");
            }
            projectModel.Date = DateTime.UtcNow;
            _db.Project.Add(projectModel);
            await _db.SaveChangesAsync();
            return projectModel;
        }

        public async Task<ProjectModel> Update(ProjectModel projectModel)
        {
            if (projectModel == null)
            {
                throw new ArgumentNullException(nameof(projectModel), "Project model cannot be null");
            }
            var existingProject = await _db.Project.FindAsync(projectModel.Id);
            if (existingProject == null)
            {
                throw new KeyNotFoundException($"Project with ID {projectModel.Id} not found");
            }
            existingProject.Name = projectModel.Name;
            existingProject.Url = projectModel.Url;
            await _db.SaveChangesAsync();
            return existingProject;
        }

        public async Task Delete(int projectModelId)
        {
            var project = await _db.Project.FindAsync(projectModelId);
            if (project == null)
            {
                throw new KeyNotFoundException($"Project with ID {projectModelId} not found");
            }
            _db.Project.Remove(project);
            await _db.SaveChangesAsync();
        }

        public async Task<List<ProjectModel>> List()
        {
            return await _db.Project.OrderByDescending(x => x.Id).ToListAsync();
        }
    }

    public interface IProjectProcessor
    {
        Task<ProjectModel> Add(ProjectModel projectModel);
        Task<ProjectModel> Update(ProjectModel projectModel);
        Task Delete(int projectModelId);
        Task<List<ProjectModel>> List();
    }
}