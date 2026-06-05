using System;
using System.Collections.Generic;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class ForumCategoryViewModel
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public int SortOrder { get; set; }
        public bool IsLocked { get; set; }
        public int ThreadCount { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class ForumThreadViewModel
    {
        public int Id { get; set; }
        public int CategoryId { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        public string CategorySlug { get; set; } = string.Empty;
        public int AuthorId { get; set; }
        public string AuthorName { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public bool IsPinned { get; set; }
        public bool IsLocked { get; set; }
        public int ViewCount { get; set; }
        public int PostCount { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public ForumPostViewModel? LastPost { get; set; }
    }

    public class ForumPostViewModel
    {
        public int Id { get; set; }
        public int ThreadId { get; set; }
        public int AuthorId { get; set; }
        public string AuthorName { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string ContentHtml { get; set; } = string.Empty;
        public bool IsFirstPost { get; set; }
        public int Votes { get; set; }
        public bool IsEdited { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? CurrentUserVote { get; set; }
        public bool IsOwn { get; set; }
    }

    public class ForumThreadDetailViewModel
    {
        public int Id { get; set; }
        public int CategoryId { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        public string CategorySlug { get; set; } = string.Empty;
        public int AuthorId { get; set; }
        public string AuthorName { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public bool IsPinned { get; set; }
        public bool IsLocked { get; set; }
        public int ViewCount { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public List<ForumPostViewModel> Posts { get; set; } = new();
        public int TotalPosts { get; set; }
        public int CurrentPage { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
    }

    public class CreateThreadRequest
    {
        public int CategoryId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }

    public class CreatePostRequest
    {
        public string Content { get; set; } = string.Empty;
    }

    public class UpdatePostRequest
    {
        public string Content { get; set; } = string.Empty;
    }

    public class ForumVoteRequest
    {
        public string VoteType { get; set; } = string.Empty;
    }

    public class ForumVoteResultViewModel
    {
        public int Votes { get; set; }
        public string? CurrentUserVote { get; set; }
    }

    public class PaginatedResult<T>
    {
        public List<T> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int CurrentPage { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
    }
}
