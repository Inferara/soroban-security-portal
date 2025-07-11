using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class SubscriptionService : ISubscriptionService
    {
        private readonly IMapper _mapper;
        private readonly ISubscriptionProcessor _subscriptionProcessor;

        public SubscriptionService(
            IMapper mapper,
            ISubscriptionProcessor subscriptionProcessor)
        {
            _mapper = mapper;
            _subscriptionProcessor = subscriptionProcessor;
        }

        public async Task<SubscriptionViewModel> Subscribe(SubscriptionViewModel subscriptionViewModel)
        {
            var subscriptionModel = _mapper.Map<SubscriptionModel>(subscriptionViewModel);
            subscriptionModel = await _subscriptionProcessor.Subscribe(subscriptionModel);
            return _mapper.Map<SubscriptionViewModel>(subscriptionModel);
        }

        public async Task<List<SubscriptionViewModel>> List()
        {
            var subscriptions = await _subscriptionProcessor.List();
            return _mapper.Map<List<SubscriptionViewModel>>(subscriptions);
        }
    }

    public interface ISubscriptionService
    {
        Task<SubscriptionViewModel> Subscribe(SubscriptionViewModel subscriptionViewModel);
        Task<List<SubscriptionViewModel>> List();
    }
}
