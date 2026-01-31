using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Mappings
{
    public class CommentMappingProfile : Profile
    {
        public CommentMappingProfile()
        {
           
            CreateMap<MentionModel, MentionViewModel>()
                .ForMember(dest => dest.MentionedUserName, 
                    opt => opt.MapFrom(src => src.MentionedUser != null 
                        ? src.MentionedUser.FullName 
                        : "Unknown User"));         

            CreateMap<CommentModel, CommentViewModel>()
                .ForMember(dest => dest.AuthorName, 
                    opt => opt.MapFrom(src => src.Author != null 
                        ? src.Author.FullName 
                        : "Unknown Author"))

                .ForMember(dest => dest.AuthorAvatarUrl, 
                    opt => opt.MapFrom(src => (src.Author != null && src.Author.Image != null) 
                        ? $"data:image/png;base64,{Convert.ToBase64String(src.Author.Image)}" 
                        : null)) 

                .ForMember(dest => dest.Status, 
                    opt => opt.MapFrom(src => src.Status.ToString()))
                .ForMember(dest => dest.Mentions, 
                    opt => opt.MapFrom(src => src.Mentions))
                .ForMember(dest => dest.Replies, 
                    opt => opt.MapFrom(src => src.Replies));
        }
    }
}