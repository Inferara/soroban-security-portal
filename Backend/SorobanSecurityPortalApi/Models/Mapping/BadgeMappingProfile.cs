using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Models.Mapping
{
    public class BadgeMappingProfile : Profile
    {
        public BadgeMappingProfile()
        {
       
            CreateMap<UserBadgeModel, BadgeViewModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.BadgeId))
                .ForMember(dest => dest.Name, opt => opt.MapFrom(src => src.Badge.Name))
                .ForMember(dest => dest.Description, opt => opt.MapFrom(src => src.Badge.Description))
                .ForMember(dest => dest.Icon, opt => opt.MapFrom(src => src.Badge.Icon))
                .ForMember(dest => dest.Category, opt => opt.MapFrom(src => src.Badge.Category.ToString()))
                .ForMember(dest => dest.Criteria, opt => opt.MapFrom(src => src.Badge.Criteria));
        }
    }
}

