using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.Mapping;

public class FileModelProfile : Profile
{
    public FileModelProfile()
    {
        CreateMap<FileViewModel, FileModel>();
        CreateMap<FileModel, FileViewModel>();
    }
}