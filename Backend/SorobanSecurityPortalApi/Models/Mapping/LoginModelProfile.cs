using SorobanSecurityPortalApi.Common.Extensions;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using Microsoft.Extensions.Azure;

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
                opt => opt.MapFrom(e => e.Password.GetHash()));

        CreateMap<LoginModel, LoginSummaryViewModel>()
            .ForMember(
                dst => dst.Role,
                opt => opt.MapFrom(e => e.Role))
            .ForMember(
                dst => dst.LoginType,
                opt => opt.MapFrom(e => e.LoginType))
            .ForMember(
                dst => dst.ConnectedAccounts,
                opt => opt.MapFrom(e => e.ConnectedAccounts)); ;


    }
}