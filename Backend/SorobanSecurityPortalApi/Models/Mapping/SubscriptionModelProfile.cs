using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.Mapping;

public class SubscriptionModelProfile : Profile
{
    public SubscriptionModelProfile()
    {
        CreateMap<SubscriptionViewModel, SubscriptionModel>();
        CreateMap<SubscriptionModel, SubscriptionViewModel>();
    }
}