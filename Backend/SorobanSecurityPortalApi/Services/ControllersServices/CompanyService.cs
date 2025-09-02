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

        public async Task<Result<CompanyViewModel, string>> Update(CompanyViewModel companyViewModel)
        {
            var companyModel = _mapper.Map<CompanyModel>(companyViewModel);
            var loginName = await _userContextAccessor.GetLoginNameAsync();
            if (!await CanUpdateCompany(companyModel, loginName))
            {
                return new Result<CompanyViewModel, string>.Err("You cannot update this company.");
            }
            companyModel = await _companyProcessor.Update(companyModel);
            return new Result<CompanyViewModel, string>.Ok(_mapper.Map<CompanyViewModel>(companyModel));
        }

        private async Task<bool> CanUpdateCompany(CompanyModel companyModel, string login)
        {
            if (companyModel.CreatedBy == login || await _userContextAccessor.IsLoginAdmin(login))
            {
                return true;
            }
            else
            {
                if (await _userContextAccessor.IsLoginAdmin(companyModel.CreatedBy))
                {
                    return false;
                }
                return true;
            }
        }
    }

    public interface ICompanyService
    {
        Task<CompanyViewModel> Add(CompanyViewModel companyViewModel);
        Task<List<CompanyViewModel>> List();
        Task Delete(int id);
        Task<Result<CompanyViewModel, string>> Update(CompanyViewModel companyViewModel);
    }
}
