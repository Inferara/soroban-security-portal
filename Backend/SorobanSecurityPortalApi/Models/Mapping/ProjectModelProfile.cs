using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.Mapping;

public class ProjectModelProfile : Profile
{
    public ProjectModelProfile()
    {
        CreateMap<ProjectViewModel, ProjectModel>();
        CreateMap<ProjectModel, ProjectViewModel>();
    }
}