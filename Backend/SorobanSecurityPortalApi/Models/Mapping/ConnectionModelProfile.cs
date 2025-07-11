using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;

namespace SorobanSecurityPortalApi.Models.Mapping
{
    public class ConnectionModelProfile : Profile
    {
        public ConnectionModelProfile()
        {
            CreateMap<ConnectionViewModel, ConnectionModel>();
            CreateMap<ConnectionModel, ConnectionViewModel>();
        }
    }
}