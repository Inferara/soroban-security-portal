using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.Mapping;

public class ProtocolModelProfile : Profile
{
    public ProtocolModelProfile()
    {
        CreateMap<ProtocolViewModel, ProtocolModel>();
        CreateMap<ProtocolModel, ProtocolViewModel>();
    }
}