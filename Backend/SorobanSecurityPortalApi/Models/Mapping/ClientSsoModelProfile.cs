using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;

namespace SorobanSecurityPortalApi.Models.Mapping
{
    public class ClientSsoModelProfile : Profile
    {
        public ClientSsoModelProfile()
        {
            CreateMap<ClientSsoViewModel, ClientSsoModel>()
                .ForMember(
                    dst => dst.ClientSsoId,
                    opt => opt.MapFrom(e => e.ClientSsoId));

            CreateMap<ClientSsoModel, ClientSsoViewModel>()
                .ForMember(
                    dst => dst.ClientSsoId,
                    opt => opt.MapFrom(e => e.ClientSsoId));
        }
    }
}