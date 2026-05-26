using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Models.Mapping
{
    public class NotificationModelProfile : Profile
    {
        public NotificationModelProfile() => CreateMap<NotificationModel, NotificationViewModel>();
    }
}
