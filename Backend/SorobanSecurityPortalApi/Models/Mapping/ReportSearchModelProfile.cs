using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;

namespace SorobanSecurityPortalApi.Models.Mapping;

public class ReportSearchModelProfile : Profile
{
    public ReportSearchModelProfile()
    {
        CreateMap<ReportSearchViewModel, ReportSearchModel>();
        CreateMap<ReportSearchModel, ReportSearchViewModel>();
    }
}