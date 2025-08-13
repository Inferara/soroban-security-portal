using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.Mapping;

public class VulnerabilitiesStatisticsModelProfile : Profile
{
    public VulnerabilitiesStatisticsModelProfile()
    {
        CreateMap<VulnerabilitiesStatisticsViewModel, VulnerabilitiesStatisticsModel>();
        CreateMap<VulnerabilitiesStatisticsModel, VulnerabilitiesStatisticsViewModel>();
    }
}
