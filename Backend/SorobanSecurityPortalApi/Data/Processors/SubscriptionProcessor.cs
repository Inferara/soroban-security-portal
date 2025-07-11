using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class SubscriptionProcessor : ISubscriptionProcessor
    {
        private readonly Db _db;

        public SubscriptionProcessor(Db db)
        {
            _db = db;
        }

        public async Task<SubscriptionModel> Subscribe(SubscriptionModel subscriptionModel)
        {
            if (subscriptionModel.Id != 0)
                throw new ArgumentException("Subscription identifier must be zero");
            subscriptionModel.Date = DateTime.UtcNow;
            await _db.Subscription.AddAsync(subscriptionModel);
            await _db.SaveChangesAsync();
            return subscriptionModel;
        }

        public async Task<List<SubscriptionModel>> List()
        {
            return await _db.Subscription.AsNoTracking().OrderByDescending(x => x.Id).ToListAsync();
        }
    }

    public interface ISubscriptionProcessor
    {
        Task<SubscriptionModel> Subscribe(SubscriptionModel subscriptionModel);
        Task<List<SubscriptionModel>> List();
    }
}