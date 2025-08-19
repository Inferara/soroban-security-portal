using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class SubscriptionProcessor : ISubscriptionProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public SubscriptionProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<SubscriptionModel> Subscribe(SubscriptionModel subscriptionModel)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            if (subscriptionModel.Id != 0)
                throw new ArgumentException("Subscription identifier must be zero");
            subscriptionModel.Date = DateTime.UtcNow;
            await db.Subscription.AddAsync(subscriptionModel);
            await db.SaveChangesAsync();
            return subscriptionModel;
        }

        public async Task<List<SubscriptionModel>> List()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Subscription.AsNoTracking().OrderByDescending(x => x.Id).ToListAsync();
        }
    }

    public interface ISubscriptionProcessor
    {
        Task<SubscriptionModel> Subscribe(SubscriptionModel subscriptionModel);
        Task<List<SubscriptionModel>> List();
    }
}