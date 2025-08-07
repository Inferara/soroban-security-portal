using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Common;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class CompanyService : ICompanyService
    {
        private readonly IMapper _mapper;
        private readonly ICompanyProcessor _companyProcessor;
        private readonly UserContextAccessor _userContextAccessor;

        public CompanyService(
            IMapper mapper,
            ICompanyProcessor companyProcessor,
            UserContextAccessor userContextAccessor)
        {
            _mapper = mapper;
            _companyProcessor = companyProcessor;
            _userContextAccessor = userContextAccessor;
        }

        public async Task<CompanyViewModel> Add(CompanyViewModel companyViewModel)
        {
            var companyModel = _mapper.Map<CompanyModel>(companyViewModel);
            companyModel.CreatedBy = await _userContextAccessor.GetLoginNameAsync();
            companyModel.Date = DateTime.UtcNow;
            companyModel = await _companyProcessor.Add(companyModel);
            return _mapper.Map<CompanyViewModel>(companyModel);
        }

        public async Task<List<CompanyViewModel>> List()
        {
            var companies = await _companyProcessor.List();
            return _mapper.Map<List<CompanyViewModel>>(companies);
        }

        public async Task Delete(int id)
        {
            await _companyProcessor.Delete(id);
        }

        public async Task<CompanyViewModel> Update(CompanyViewModel companyViewModel)
        {
            var companyModel = _mapper.Map<CompanyModel>(companyViewModel);
            companyModel = await _companyProcessor.Update(companyModel);
            return _mapper.Map<CompanyViewModel>(companyModel);
        }
    }

    public interface ICompanyService
    {
        Task<CompanyViewModel> Add(CompanyViewModel companyViewModel);
        Task<List<CompanyViewModel>> List();
        Task Delete(int id);
        Task<CompanyViewModel> Update(CompanyViewModel companyViewModel);
    }
}
