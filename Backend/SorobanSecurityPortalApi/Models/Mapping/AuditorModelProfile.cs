using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.Mapping;

public class AuditorModelProfile : Profile
{
    public AuditorModelProfile()
    {
        CreateMap<AuditorViewModel, AuditorModel>()
            .ForMember(dest => dest.Image, opt => opt.MapFrom(src => src.ImageData));
        CreateMap<AuditorModel, AuditorViewModel>()
            .ForMember(dest => dest.ImageData, opt => opt.MapFrom(src => src.Image));
    }
}