using SorobanSecurityPortalApi.Common.Extensions;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;

namespace SorobanSecurityPortalApi.Models.Mapping;

public class LoginModelProfile : Profile
{
    public LoginModelProfile()
    {
        CreateMap<LoginViewModel, LoginModel>()
            .ForMember(
                dst => dst.Role,
                opt => opt.MapFrom(e => e.Role))
            .ForMember(
                dst => dst.LoginType,
                opt => opt.MapFrom(e => e.LoginType));

        CreateMap<LoginModel, LoginViewModel>()
            .ForMember(
                dst => dst.Role,
                opt => opt.MapFrom(e => e.Role))
            .ForMember(
                dst => dst.LoginType,
                opt => opt.MapFrom(e => e.LoginType));

        CreateMap<LoginSummaryViewModel, LoginModel>()
            .ForMember(
                dst => dst.Role,
                opt => opt.MapFrom(e => e.Role))
            .ForMember(
                dst => dst.LoginType,
                opt => opt.MapFrom(e => e.LoginType))
            .ForMember(
                dst => dst.PasswordHash,
                opt => opt.MapFrom(e => e.Password.GetHash()));

        CreateMap<LoginModel, LoginSummaryViewModel>()
            .ForMember(
                dst => dst.Role,
                opt => opt.MapFrom(e => e.Role))
            .ForMember(
                dst => dst.LoginType,
                opt => opt.MapFrom(e => e.LoginType));

        CreateMap<EditLoginViewModel, LoginModel>()
         .ForMember(
             dst => dst.Role,
             opt => opt.MapFrom(e => e.Role));

        CreateMap<LoginModel, EditLoginViewModel>()
            .ForMember(
                dst => dst.Role,
                opt => opt.MapFrom(e => e.Role));

        CreateMap<LoginSummaryViewModel, LoginWithSpentModel>()
            .ForMember(
                dst => dst.Role,
                opt => opt.MapFrom(e => e.Role))
            .ForMember(
                dst => dst.LoginType,
                opt => opt.MapFrom(e => e.LoginType));

        CreateMap<LoginWithSpentModel, LoginSummaryViewModel>()
            .ForMember(
                dst => dst.Role,
                opt => opt.MapFrom(e => e.Role))
            .ForMember(
                dst => dst.LoginType,
                opt => opt.MapFrom(e => e.LoginType));
    }
}