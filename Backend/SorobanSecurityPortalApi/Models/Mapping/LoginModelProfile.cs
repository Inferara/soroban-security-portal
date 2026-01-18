using SorobanSecurityPortalApi.Common.Extensions;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;

namespace SorobanSecurityPortalApi.Models.Mapping;

public class LoginModelProfile : Profile
{
    public LoginModelProfile()
    {
        CreateMap<ConnectedAccountModel, ConnectedAccountViewModel>();
        CreateMap<ConnectedAccountViewModel, ConnectedAccountModel>();

        CreateMap<LoginViewModel, LoginModel>()
            .ForMember(
                dst => dst.Role,
                opt => opt.MapFrom(e => e.Role))
            .ForMember(
                dst => dst.LoginType,
                opt => opt.MapFrom(e => e.LoginType))
            .ForMember(
                dst => dst.ConnectedAccounts,
                opt => opt.MapFrom(e => e.ConnectedAccounts));

        CreateMap<LoginModel, LoginViewModel>()
            .ForMember(
                dst => dst.Role,
                opt => opt.MapFrom(e => e.Role))
            .ForMember(
                dst => dst.LoginType,
                opt => opt.MapFrom(e => e.LoginType))
            .ForMember(
                dst => dst.ConnectedAccounts,
                opt => opt.MapFrom(e => e.ConnectedAccounts)); ;

        CreateMap<LoginSummaryViewModel, LoginModel>()
            .ForMember(
                dst => dst.Role,
                opt => opt.MapFrom(e => e.Role))
            .ForMember(
                dst => dst.LoginType,
                opt => opt.MapFrom(e => e.LoginType))
            .ForMember(
                dst => dst.ConnectedAccounts,
                opt => opt.MapFrom(e => e.ConnectedAccounts))
            .ForMember(
                dst => dst.PasswordHash,
                opt => opt.MapFrom(e => e.Password != null ? e.Password.GetHash() : null));

        CreateMap<LoginModel, LoginSummaryViewModel>()
            .ForMember(
                dst => dst.Role,
                opt => opt.MapFrom(e => e.Role))
            .ForMember(
                dst => dst.LoginType,
                opt => opt.MapFrom(e => e.LoginType))
            .ForMember(
                dst => dst.ConnectedAccounts,
                opt => opt.MapFrom(e => e.ConnectedAccounts));

        CreateMap<LoginSelfUpdateViewModel, LoginModel>()
            .ForMember(
                dst => dst.ConnectedAccounts,
                opt => opt.MapFrom(e => e.ConnectedAccounts))
            .ForMember(
                dst => dst.PasswordHash,
                opt => opt.Ignore());

        CreateMap<LoginModel, LoginSelfUpdateViewModel>()
            .ForMember(
                dst => dst.ConnectedAccounts,
                opt => opt.MapFrom(e => e.ConnectedAccounts))
            .ForMember(
                dst => dst.FullName,
                opt => opt.MapFrom(e => e.FullName))
            .ForMember(
                dst => dst.PersonalInfo,
                opt => opt.MapFrom(e => e.PersonalInfo))
            .ForMember(
                dst => dst.Image,
                opt => opt.MapFrom(e => e.Image));
    }
}