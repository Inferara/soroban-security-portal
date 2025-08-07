using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.Mapping;

public class CompanyModelProfile : Profile
{
    public CompanyModelProfile()
    {
        CreateMap<CompanyViewModel, CompanyModel>();
        CreateMap<CompanyModel, CompanyViewModel>();
    }
}