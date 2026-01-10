using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.Mapping;

public class CompanyModelProfile : Profile
{
    public CompanyModelProfile()
    {
        CreateMap<CompanyViewModel, CompanyModel>()
            .ForMember(dest => dest.Image, opt => opt.MapFrom(src => src.ImageData));
        CreateMap<CompanyModel, CompanyViewModel>()
            .ForMember(dest => dest.ImageData, opt => opt.MapFrom(src => src.Image));
    }
}