using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using System;
using System.Linq;

namespace SorobanSecurityPortalApi.Models.Mapping
{
    public class CommentProfile : Profile
    {
        public CommentProfile()
        {
            CreateMap<CommentModel, CommentViewModel>()
                .ForMember(dest => dest.Author, opt => opt.MapFrom(src => src.Author))
                .ForMember(dest => dest.UpvoteCount, opt => opt.MapFrom(src => src.Votes.Count(v => v.Vote == VoteType.Upvote)))
                .ForMember(dest => dest.DownvoteCount, opt => opt.MapFrom(src => src.Votes.Count(v => v.Vote == VoteType.Downvote)))
                .ForMember(dest => dest.ReplyCount, opt => opt.MapFrom(src => src.Replies.Count(r => !r.IsDeleted)))
                .ForMember(dest => dest.Replies, opt => opt.MapFrom(src => src.Replies.Where(r => !r.IsDeleted).OrderBy(r => r.CreatedAt)))
                .ForMember(dest => dest.CurrentUserVote, opt => opt.Ignore());

            CreateMap<LoginModel, CommentAuthorViewModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.LoginId))
                .ForMember(dest => dest.DisplayName, opt => opt.MapFrom(src => src.FullName))
                .ForMember(dest => dest.AvatarUrl, opt => opt.MapFrom(src => $"/api/v1/user/{src.LoginId}/avatar.png"))
                .ForMember(dest => dest.ReputationScore, opt => opt.MapFrom(src => src.UserProfile != null ? src.UserProfile.ReputationScore : 0));

            CreateMap<CommentCreateViewModel, CommentModel>()
                .ForMember(dest => dest.ContentHtml, opt => opt.Ignore())
                .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(_ => DateTime.UtcNow))
                .ForMember(dest => dest.IsEdited, opt => opt.MapFrom(_ => false))
                .ForMember(dest => dest.IsDeleted, opt => opt.MapFrom(_ => false));

            CreateMap<CommentUpdateViewModel, CommentModel>()
                .ForMember(dest => dest.Content, opt => opt.MapFrom(src => src.Content))
                .ForMember(dest => dest.UpdatedAt, opt => opt.MapFrom(_ => DateTime.UtcNow))
                .ForMember(dest => dest.IsEdited, opt => opt.MapFrom(_ => true))
                .ForAllOtherMembers(opt => opt.Ignore());
        }
    }
}
