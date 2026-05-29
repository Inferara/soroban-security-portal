using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Models.Mapping;

public class AgentRunModelProfile : Profile
{
    public AgentRunModelProfile()
    {
        CreateMap<AgentRunModel, AgentRunListItemViewModel>();
        CreateMap<AgentRunModel, AgentRunViewModel>()
            .ForMember(dst => dst.Findings, opt => opt.Ignore());
    }
}
