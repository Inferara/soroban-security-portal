using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.Mapping;

public class ForumModelProfile : Profile
{
    public ForumModelProfile()
    {
        CreateMap<ForumCategoryModel, ForumCategoryViewModel>();
        CreateMap<ForumCategoryViewModel, ForumCategoryModel>();
        
        CreateMap<ForumThreadModel, ForumThreadViewModel>();
        CreateMap<ForumThreadViewModel, ForumThreadModel>();
        
        CreateMap<ForumThreadModel, ForumThreadDetailViewModel>();
        CreateMap<ForumThreadDetailViewModel, ForumThreadModel>();
        
        CreateMap<ForumPostModel, ForumPostViewModel>();
        CreateMap<ForumPostViewModel, ForumPostModel>();
        
        CreateMap<CreateThreadRequest, ForumThreadModel>();
        CreateMap<CreatePostRequest, ForumPostModel>();
        CreateMap<UpdatePostRequest, ForumPostModel>();
    }
}
