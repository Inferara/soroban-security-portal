using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using AutoMapper;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.Moderation;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public interface IForumService
    {
        Task<List<ForumCategoryViewModel>> GetCategories();
        Task<PaginatedResult<ForumThreadViewModel>> GetThreadsByCategory(string categorySlug, int page, int pageSize);
        Task<ForumThreadDetailViewModel> GetThreadBySlug(string slug, int page, int pageSize);
        Task<ForumThreadViewModel> CreateThread(CreateThreadRequest request);
        Task<ForumPostViewModel> CreatePost(int threadId, CreatePostRequest request);
        Task<ForumPostViewModel> UpdatePost(int postId, UpdatePostRequest request);
        Task<ForumVoteResultViewModel> VoteOnPost(int postId, string voteType);
        Task RecordThreadView(int threadId, string? visitorIdentifier);
    }

    public class ForumService : IForumService
    {
        private const int EditWindowMinutes = 30;
        private const int MaxTitleLength = 200;
        private const int MaxContentLength = 10000;
        private const int DefaultPageSize = 20;

        private readonly IForumProcessor _processor;
        private readonly IContentFilterService _contentFilter;
        private readonly IUserContextAccessor _userContext;
        private readonly IMapper _mapper;
        private readonly IDistributedCache _cache;
        private readonly IVoteProcessor _voteProcessor;
        private readonly ILogger<ForumService> _logger;

        public ForumService(
            IForumProcessor processor,
            IContentFilterService contentFilter,
            IUserContextAccessor userContext,
            IMapper mapper,
            IDistributedCache cache,
            IVoteProcessor voteProcessor,
            ILogger<ForumService> logger)
        {
            _processor = processor;
            _contentFilter = contentFilter;
            _userContext = userContext;
            _mapper = mapper;
            _cache = cache;
            _voteProcessor = voteProcessor;
            _logger = logger;
        }

        public async Task<List<ForumCategoryViewModel>> GetCategories()
        {
            var categories = await _processor.GetCategories();
            var result = new List<ForumCategoryViewModel>();

            foreach (var category in categories)
            {
                var threadCount = await _processor.GetThreadCountForCategory(category.Id);
                var vm = _mapper.Map<ForumCategoryViewModel>(category);
                vm.ThreadCount = threadCount;
                result.Add(vm);
            }

            return result;
        }

        public async Task<PaginatedResult<ForumThreadViewModel>> GetThreadsByCategory(string categorySlug, int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Max(1, Math.Min(100, pageSize));

            var category = await _processor.GetCategoryBySlug(categorySlug);
            if (category == null)
                throw new KeyNotFoundException($"Category with slug '{categorySlug}' not found.");

            if (category.IsLocked)
                throw new InvalidOperationException("This category is locked and cannot be viewed.");

            var threads = await _processor.GetThreadsByCategory(category.Id, page, pageSize);
            var totalCount = await _processor.GetThreadCountForCategory(category.Id);

            var authorIds = threads.Select(t => t.AuthorId).Distinct().ToList();
            var authorNames = await _processor.GetAuthorNames(authorIds);

            var lastPostThreadIds = threads.Select(t => t.Id).ToList();
            var lastPosts = new Dictionary<int, ForumPostModel>();
            foreach (var threadId in lastPostThreadIds)
            {
                var lastPost = await _processor.GetLastPostForThread(threadId);
                if (lastPost != null)
                    lastPosts[threadId] = lastPost;
            }

            var lastPostAuthorIds = lastPosts.Values.Select(p => p.AuthorId).Distinct().ToList();
            var lastPostAuthorNames = await _processor.GetAuthorNames(lastPostAuthorIds);

            var items = new List<ForumThreadViewModel>();
            foreach (var thread in threads)
            {
                var vm = _mapper.Map<ForumThreadViewModel>(thread);
                vm.CategoryName = category.Name;
                vm.CategorySlug = category.Slug;
                vm.AuthorName = authorNames.TryGetValue(thread.AuthorId, out var name) && !string.IsNullOrWhiteSpace(name) 
                    ? name 
                    : "Anonymous";
                vm.PostCount = await _processor.GetPostCountForThread(thread.Id);

                if (lastPosts.TryGetValue(thread.Id, out var lastPost))
                {
                    vm.LastPost = _mapper.Map<ForumPostViewModel>(lastPost);
                    vm.LastPost.AuthorName = lastPostAuthorNames.TryGetValue(lastPost.AuthorId, out var lpName) 
                        && !string.IsNullOrWhiteSpace(lpName) 
                        ? lpName 
                        : "Anonymous";
                }

                items.Add(vm);
            }

            return new PaginatedResult<ForumThreadViewModel>
            {
                Items = items,
                TotalCount = totalCount,
                CurrentPage = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            };
        }

        public async Task<ForumThreadDetailViewModel> GetThreadBySlug(string slug, int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Max(1, Math.Min(100, pageSize));

            var thread = await _processor.GetThreadBySlug(slug);
            if (thread == null)
                throw new KeyNotFoundException($"Thread with slug '{slug}' not found.");

            var categoryModel = await _processor.GetCategoryById(thread.CategoryId);
            
            if (categoryModel != null && categoryModel.IsLocked)
                throw new InvalidOperationException("This thread's category is locked.");

            var totalCount = await _processor.GetPostCountForThread(thread.Id);
            var posts = await _processor.GetPostsByThread(thread.Id, page, pageSize);

            var authorIds = posts.Select(p => p.AuthorId).Concat(new[] { thread.AuthorId }).Distinct().ToList();
            var authorNames = await _processor.GetAuthorNames(authorIds);

            var viewerId = await _userContext.GetLoginIdOrNullAsync() ?? 0;

            var postViewModels = new List<ForumPostViewModel>();
            foreach (var post in posts)
            {
                var vm = _mapper.Map<ForumPostViewModel>(post);
                vm.AuthorName = authorNames.TryGetValue(post.AuthorId, out var name) && !string.IsNullOrWhiteSpace(name) 
                    ? name 
                    : "Anonymous";
                vm.IsOwn = post.AuthorId == viewerId;

                if (viewerId != 0)
                {
                    var userVote = await _voteProcessor.GetUserVotesForForumPosts(viewerId, new List<int> { post.Id });
                    if (userVote.TryGetValue(post.Id, out var voteType))
                        vm.CurrentUserVote = VoteTypeToString(voteType);
                }

                postViewModels.Add(vm);
            }

            return new ForumThreadDetailViewModel
            {
                Id = thread.Id,
                CategoryId = thread.CategoryId,
                CategoryName = categoryModel?.Name ?? "Unknown",
                CategorySlug = categoryModel?.Slug ?? "unknown",
                AuthorId = thread.AuthorId,
                AuthorName = authorNames.TryGetValue(thread.AuthorId, out var authorName) && !string.IsNullOrWhiteSpace(authorName) 
                    ? authorName 
                    : "Anonymous",
                Title = thread.Title,
                Slug = thread.Slug,
                IsPinned = thread.IsPinned,
                IsLocked = thread.IsLocked,
                ViewCount = thread.ViewCount,
                CreatedAt = thread.CreatedAt,
                UpdatedAt = thread.UpdatedAt,
                Posts = postViewModels,
                TotalPosts = totalCount,
                CurrentPage = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            };
        }

        public async Task<ForumThreadViewModel> CreateThread(CreateThreadRequest request)
        {
            var userId = await _userContext.GetLoginIdAsync();
            if (userId == 0)
                throw new UnauthorizedAccessException("User not logged in.");

            if (string.IsNullOrWhiteSpace(request.Title))
                throw new InvalidOperationException("Title must not be empty.");
            if (request.Title.Length > MaxTitleLength)
                throw new InvalidOperationException($"Title must not exceed {MaxTitleLength} characters.");
            if (string.IsNullOrWhiteSpace(request.Content))
                throw new InvalidOperationException("Content must not be empty.");
            if (request.Content.Length > MaxContentLength)
                throw new InvalidOperationException($"Content must not exceed {MaxContentLength} characters.");

            var category = await _processor.GetCategoryById(request.CategoryId);
            if (category == null)
                throw new KeyNotFoundException($"Category with id {request.CategoryId} not found.");
            if (category.IsLocked)
                throw new InvalidOperationException("Cannot create threads in a locked category.");

            if (!await _contentFilter.CheckRateLimitAsync(userId))
                throw new InvalidOperationException("Rate limit exceeded. Please wait a moment before submitting again.");

            var filterResult = await _contentFilter.FilterContentAsync(request.Content, userId);
            if (filterResult.IsBlocked)
                throw new InvalidOperationException($"Content blocked: {string.Join("; ", filterResult.Warnings)}");

            var slug = GenerateSlug(request.Title);

            var thread = new ForumThreadModel
            {
                CategoryId = request.CategoryId,
                AuthorId = userId,
                Title = request.Title,
                Slug = slug,
                CreatedAt = DateTime.UtcNow
            };

            var createdThread = await _processor.CreateThread(thread);

            var firstPost = new ForumPostModel
            {
                ThreadId = createdThread.Id,
                AuthorId = userId,
                Content = request.Content,
                ContentHtml = filterResult.SanitizedContent ?? string.Empty,
                IsFirstPost = true,
                CreatedAt = DateTime.UtcNow
            };

            var createdPost = await _processor.CreatePost(firstPost);

            var authorNames = await _processor.GetAuthorNames(new List<int> { userId });
            var vm = _mapper.Map<ForumThreadViewModel>(createdThread);
            vm.AuthorName = authorNames.TryGetValue(userId, out var name) && !string.IsNullOrWhiteSpace(name) 
                ? name 
                : "Anonymous";
            vm.CategoryName = category.Name;
            vm.CategorySlug = category.Slug;
            vm.PostCount = 1;

            return vm;
        }

        public async Task<ForumPostViewModel> CreatePost(int threadId, CreatePostRequest request)
        {
            var userId = await _userContext.GetLoginIdAsync();
            if (userId == 0)
                throw new UnauthorizedAccessException("User not logged in.");

            if (string.IsNullOrWhiteSpace(request.Content))
                throw new InvalidOperationException("Content must not be empty.");
            if (request.Content.Length > MaxContentLength)
                throw new InvalidOperationException($"Content must not exceed {MaxContentLength} characters.");

            var thread = await _processor.GetThreadById(threadId);
            if (thread == null)
                throw new KeyNotFoundException($"Thread with id {threadId} not found.");

            var category = await _processor.GetCategoryById(thread.CategoryId);
            if (category != null && (category.IsLocked || thread.IsLocked))
                throw new InvalidOperationException("Cannot post to a locked thread or category.");

            if (!await _contentFilter.CheckRateLimitAsync(userId))
                throw new InvalidOperationException("Rate limit exceeded. Please wait a moment before submitting again.");

            var filterResult = await _contentFilter.FilterContentAsync(request.Content, userId);
            if (filterResult.IsBlocked)
                throw new InvalidOperationException($"Content blocked: {string.Join("; ", filterResult.Warnings)}");

            var post = new ForumPostModel
            {
                ThreadId = threadId,
                AuthorId = userId,
                Content = request.Content,
                ContentHtml = filterResult.SanitizedContent ?? string.Empty,
                IsFirstPost = false,
                CreatedAt = DateTime.UtcNow
            };

            var createdPost = await _processor.CreatePost(post);

            var authorNames = await _processor.GetAuthorNames(new List<int> { userId });
            var vm = _mapper.Map<ForumPostViewModel>(createdPost);
            vm.AuthorName = authorNames.TryGetValue(userId, out var name) && !string.IsNullOrWhiteSpace(name) 
                ? name 
                : "Anonymous";
            vm.IsOwn = true;

            return vm;
        }

        public async Task<ForumPostViewModel> UpdatePost(int postId, UpdatePostRequest request)
        {
            var userId = await _userContext.GetLoginIdAsync();
            if (userId == 0)
                throw new UnauthorizedAccessException("User not logged in.");

            if (string.IsNullOrWhiteSpace(request.Content))
                throw new InvalidOperationException("Content must not be empty.");
            if (request.Content.Length > MaxContentLength)
                throw new InvalidOperationException($"Content must not exceed {MaxContentLength} characters.");

            var post = await _processor.GetPostById(postId);
            if (post == null)
                throw new KeyNotFoundException($"Post with id {postId} not found.");

            if (post.AuthorId != userId)
                throw new UnauthorizedAccessException("You can only edit your own posts.");

            if ((DateTime.UtcNow - post.CreatedAt).TotalMinutes > EditWindowMinutes)
                throw new InvalidOperationException($"The edit window for this post has expired ({EditWindowMinutes} minutes).");

            if (!await _contentFilter.CheckRateLimitAsync(userId))
                throw new InvalidOperationException("Rate limit exceeded. Please wait a moment before submitting again.");

            var filterResult = await _contentFilter.FilterContentAsync(request.Content, userId);
            if (filterResult.IsBlocked)
                throw new InvalidOperationException($"Content blocked: {string.Join("; ", filterResult.Warnings)}");

            var updatedPost = await _processor.UpdatePost(postId, request.Content, filterResult.SanitizedContent ?? string.Empty);
            if (updatedPost == null)
                throw new KeyNotFoundException($"Post with id {postId} not found.");

            var authorNames = await _processor.GetAuthorNames(new List<int> { userId });
            var vm = _mapper.Map<ForumPostViewModel>(updatedPost);
            vm.AuthorName = authorNames.TryGetValue(userId, out var name) && !string.IsNullOrWhiteSpace(name) 
                ? name 
                : "Anonymous";
            vm.IsOwn = true;

            return vm;
        }

        public async Task<ForumVoteResultViewModel> VoteOnPost(int postId, string voteType)
        {
            var userId = await _userContext.GetLoginIdAsync();
            if (userId == 0)
                throw new UnauthorizedAccessException("User not logged in.");

            var post = await _processor.GetPostById(postId);
            if (post == null)
                throw new KeyNotFoundException($"Post with id {postId} not found.");

            VoteType? parsed = (voteType ?? "").ToLowerInvariant() switch
            {
                "upvote" => VoteType.Upvote,
                "downvote" => VoteType.Downvote,
                "none" => null,
                _ => throw new InvalidOperationException("voteType must be 'upvote', 'downvote', or 'none'.")
            };

            var outcome = await _voteProcessor.SetForumPostVote(postId, userId, parsed);
            if (outcome == null)
                throw new KeyNotFoundException($"Post with id {postId} not found.");
            if (outcome.IsSelfVote)
                throw new InvalidOperationException("You cannot vote on your own post.");
            if (outcome.BelowDownvoteThreshold)
                throw new InvalidOperationException(
                    $"You need at least {VoteProcessor.MinReputationToDownvote} reputation to downvote.");

            var userVote = await _voteProcessor.GetUserVotesForForumPosts(userId, new List<int> { postId });
            var currentUserVote = userVote.TryGetValue(postId, out var vt) ? VoteTypeToString(vt) : null;

            return new ForumVoteResultViewModel
            {
                Votes = outcome.VoteCount,
                CurrentUserVote = currentUserVote
            };
        }

        public async Task RecordThreadView(int threadId, string? visitorIdentifier)
        {
            var cacheKey = $"forum_view:{threadId}:{visitorIdentifier ?? "anonymous"}:{DateTime.UtcNow:yyyyMMdd}";
            var cached = await _cache.GetStringAsync(cacheKey);
            
            if (!string.IsNullOrEmpty(cached))
                return;

            await _cache.SetStringAsync(cacheKey, "1", new DistributedCacheEntryOptions 
            { 
                AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(1) 
            });

            await _processor.IncrementViewCount(threadId);
        }

        private static string GenerateSlug(string title)
        {
            var slug = title.ToLowerInvariant()
                .Replace(" ", "-")
                .Replace("/", "-")
                .Replace("\\", "-")
                .Replace("?", "")
                .Replace("!", "")
                .Replace(".", "")
                .Replace(",", "")
                .Replace(";", "")
                .Replace(":", "")
                .Replace("'", "")
                .Replace("\"", "")
                .Replace("&", "and")
                .Replace("@", "at");

            // Ensure unique slug by appending random suffix if needed
            using var rng = RandomNumberGenerator.Create();
            var bytes = new byte[4];
            rng.GetBytes(bytes);
            var suffix = BitConverter.ToUInt32(bytes, 0).ToString("x8");
            
            return $"{slug}-{suffix}";
        }

        private static string? VoteTypeToString(VoteType? v) => v switch
        {
            VoteType.Upvote => "upvote",
            VoteType.Downvote => "downvote",
            _ => null
        };
    }
}
