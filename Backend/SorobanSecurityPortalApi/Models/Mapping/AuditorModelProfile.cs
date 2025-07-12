using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.Mapping;

public class AuditorModelProfile : Profile
{
    public AuditorModelProfile()
    {
        CreateMap<AuditorViewModel, AuditorModel>();
        CreateMap<AuditorModel, AuditorViewModel>();
    }
}