using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class AuditorRatingProcessor : IAuditorRatingProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public AuditorRatingProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<AuditorRatingModel> Add(AuditorRatingModel ratingModel)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            db.AuditorRating.Add(ratingModel);
            await db.SaveChangesAsync();
            return ratingModel;
        }

        public async Task<List<AuditorRatingModel>> ListByAuditorId(int auditorId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.AuditorRating
                .AsNoTracking()
                .Include(x => x.Creator)
                .Where(x => x.AuditorId == auditorId)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();
        }

        public async Task<double> GetAverageRating(int auditorId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var ratings = await db.AuditorRating
                .Where(x => x.AuditorId == auditorId)
                .Select(x => (x.QualityScore + x.CommunicationScore + x.ThoroughnessScore) / 3.0)
                .ToListAsync();

            if (ratings.Count == 0) return 0;
            return ratings.Average();
        }
    }

    public interface IAuditorRatingProcessor
    {
        Task<AuditorRatingModel> Add(AuditorRatingModel ratingModel);
        Task<List<AuditorRatingModel>> ListByAuditorId(int auditorId);
        Task<double> GetAverageRating(int auditorId);
    }
}
