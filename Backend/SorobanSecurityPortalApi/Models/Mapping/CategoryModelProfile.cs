using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.Mapping;

public class CategoryModelProfile : Profile
{
    public CategoryModelProfile()
    {
        CreateMap<CategoryViewModel, CategoryModel>();
        CreateMap<CategoryModel, CategoryViewModel>();
    }
}