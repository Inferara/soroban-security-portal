using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Common;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class AuditorRatingService : IAuditorRatingService
    {
        private readonly IMapper _mapper;
        private readonly IAuditorRatingProcessor _ratingProcessor;
        private readonly UserContextAccessor _userContextAccessor;

        public AuditorRatingService(
            IMapper mapper,
            IAuditorRatingProcessor ratingProcessor,
            UserContextAccessor userContextAccessor)
        {
            _mapper = mapper;
            _ratingProcessor = ratingProcessor;
            _userContextAccessor = userContextAccessor;
        }

        public async Task<AuditorRatingViewModel> Add(AuditorRatingViewModel ratingViewModel)
        {
            var ratingModel = _mapper.Map<AuditorRatingModel>(ratingViewModel);
            ratingModel.CreatedBy = await _userContextAccessor.GetLoginIdAsync();
            ratingModel.CreatedAt = DateTime.UtcNow;
            
            ratingModel = await _ratingProcessor.Add(ratingModel);
            return _mapper.Map<AuditorRatingViewModel>(ratingModel);
        }

        public async Task<List<AuditorRatingViewModel>> ListByAuditorId(int auditorId)
        {
            var ratings = await _ratingProcessor.ListByAuditorId(auditorId);
            return _mapper.Map<List<AuditorRatingViewModel>>(ratings);
        }

        public async Task<double> GetAverageRating(int auditorId)
        {
            return await _ratingProcessor.GetAverageRating(auditorId);
        }
    }

    public interface IAuditorRatingService
    {
        Task<AuditorRatingViewModel> Add(AuditorRatingViewModel ratingViewModel);
        Task<List<AuditorRatingViewModel>> ListByAuditorId(int auditorId);
        Task<double> GetAverageRating(int auditorId);
    }
}
