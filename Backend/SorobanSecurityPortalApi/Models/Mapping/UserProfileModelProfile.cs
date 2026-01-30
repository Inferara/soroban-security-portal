using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Models.Mapping
{
    public class UserProfileModelProfile : Profile
    {
        public UserProfileModelProfile()
        {
            CreateMap<UserProfileModel, UserProfileViewModel>()
                .ForMember(dest => dest.FullName,
                    opt => opt.MapFrom(src => src.Login.FullName))
                .ForMember(dest => dest.Email,
                    opt => opt.MapFrom(src => src.Login.Email))
                .ForMember(dest => dest.ConnectedAccounts,
                    opt => opt.MapFrom(src => src.Login.ConnectedAccounts));

            CreateMap<UpdateUserProfileViewModel, UserProfileModel>()
                .ForAllMembers(opts => opts.Condition((src, dest, srcMember) => srcMember != null));
        }
    }
}