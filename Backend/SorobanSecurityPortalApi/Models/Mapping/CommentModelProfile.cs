using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Models.Mapping
{
    public class CommentModelProfile : Profile
    {
        public CommentModelProfile()
        {
            // AuthorName, ReplyCount, and Replies are populated in the service, not mapped.
            CreateMap<CommentModel, CommentViewModel>()
                .ForMember(d => d.AuthorName, o => o.Ignore())
                .ForMember(d => d.ReplyCount, o => o.Ignore())
                .ForMember(d => d.Replies, o => o.Ignore());
        }
    }
}
