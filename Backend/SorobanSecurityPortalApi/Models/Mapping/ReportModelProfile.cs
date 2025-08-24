using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.Mapping;

public class ReportModelProfile : Profile
{
    public ReportModelProfile()
    {
        CreateMap<ReportViewModel, ReportModel>()
            .ForMember(
                dst => dst.AuditorId,
                opt => opt.MapFrom(r => r.AuditorId))
            .ForMember(
                dst => dst.ProtocolId,
                opt => opt.MapFrom(r => r.ProtocolId));
        CreateMap<ReportModel, ReportViewModel>()
            .ForMember(
                dst => dst.AuditorName,
                opt => opt.MapFrom(r => r.Auditor.Name))
            .ForMember(
                dst => dst.CompanyName,
                opt => opt.MapFrom(r => r.Protocol.Company.Name))
            .ForMember(
                dst => dst.ProtocolName,
                opt => opt.MapFrom(r => r.Protocol.Name));
    }
}