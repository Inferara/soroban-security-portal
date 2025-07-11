using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.Mapping;

public class ReportModelProfile : Profile
{
    public ReportModelProfile()
    {
        CreateMap<ReportViewModel, ReportModel>();
        CreateMap<ReportModel, ReportViewModel>();
    }
}