using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.Mapping;

public class ProtocolModelProfile : Profile
{
    public ProtocolModelProfile()
    {
        CreateMap<ProtocolViewModel, ProtocolModel>()
            .ForMember(dest => dest.Image, opt => opt.MapFrom(src => src.ImageData));
        CreateMap<ProtocolModel, ProtocolViewModel>()
            .ForMember(dest => dest.ImageData, opt => opt.MapFrom(src => src.Image));
    }
}