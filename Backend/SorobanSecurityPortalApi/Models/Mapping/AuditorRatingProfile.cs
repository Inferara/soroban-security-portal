using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.Mapping;

public class AuditorRatingProfile : Profile
{
    public AuditorRatingProfile()
    {
        CreateMap<AuditorRatingViewModel, AuditorRatingModel>();
        CreateMap<AuditorRatingModel, AuditorRatingViewModel>()
            .ForMember(dest => dest.CreatedByName, opt => opt.MapFrom(src => src.Auditor.Name)); // Placeholder, should probably be user's name
    }
}
