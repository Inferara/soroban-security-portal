using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class VulnerabilityService : IVulnerabilityService
    {
        private readonly IMapper _mapper;
        private readonly IVulnerabilityProcessor _vulnerabilityProcessor;
        private readonly IReportProcessor _reportProcessor;
        private readonly UserContextAccessor _userContextAccessor;

        public VulnerabilityService(
            IMapper mapper,
            IVulnerabilityProcessor vulnerabilityProcessor,
            IReportProcessor reportProcessor,
            UserContextAccessor userContextAccessor)
        {
            _mapper = mapper;
            _vulnerabilityProcessor = vulnerabilityProcessor;
            _reportProcessor = reportProcessor;
            _userContextAccessor = userContextAccessor;
        }

        public async Task<List<IdValue>> ListSeverities()
        {
            var result = new List<IdValue>
            {
                new IdValue { Id = 1, Name = "Critical" },
                new IdValue { Id = 2, Name = "High" },
                new IdValue { Id = 3, Name = "Medium" },
                new IdValue { Id = 4, Name = "Low" },
                new IdValue { Id = 4, Name = "Info" }
            };
            return result;
        }

        public async Task<List<IdValue>> ListCategories()
        {
            var result = new List<IdValue>
            {
                new IdValue { Id = 1, Name = "Overflow" },
                new IdValue { Id = 2, Name = "Access Control" },
                new IdValue { Id = 3, Name = "Logic Bug" },
                new IdValue { Id = 4, Name = "Reentrancy" },
                new IdValue { Id = 5, Name = "Timestamp" },

            };
            return result;
        }

        public async Task<List<IdValueUrl>> ListSources()
        {
            var reports = await _reportProcessor.GetList();
            var result = new List<IdValueUrl>();
            foreach (var report in reports) {
                result.Add(new IdValueUrl
                {
                    Id = report.Id,
                    Name = report.Name,
                    Url = ""
                });
            }
            result.Add(new IdValueUrl
            {
                Id = 0,
                Name = "External",
                Url = ""
            });
            return result;
        }


        public async Task<List<VulnerabilityViewModel>> Search(VulnerabilitySearchViewModel? vulnerabilitySearch)
        {
            var searchResult = await _vulnerabilityProcessor.Search(_mapper.Map<Models.DbModels.VulnerabilitySearchModel>(vulnerabilitySearch));
            var result = _mapper.Map<List<VulnerabilityViewModel>>(searchResult);
            return result;
        }

        public async Task<VulnerabilityViewModel> Add(VulnerabilityViewModel vulnerabilityViewModel)
        {
            var vulnerabilityModel = _mapper.Map<Models.DbModels.VulnerabilityModel>(vulnerabilityViewModel);
            var loginName = await _userContextAccessor.GetLoginNameAsync();
            vulnerabilityModel.Author = loginName;
            var addedVulnerability = await _vulnerabilityProcessor.Add(vulnerabilityModel);
            return _mapper.Map<VulnerabilityViewModel>(addedVulnerability);
        }

        public async Task Approve(int vulnerabilityId)
        {
            var loginName = await _userContextAccessor.GetLoginNameAsync();
            await _vulnerabilityProcessor.Approve(vulnerabilityId, loginName);
        }

        public async Task Reject(int vulnerabilityId)
        {
            var loginName = await _userContextAccessor.GetLoginNameAsync();
            await _vulnerabilityProcessor.Reject(vulnerabilityId, loginName);
        }

        public async Task Remove(int vulnerabilityId)
        {
            await _vulnerabilityProcessor.Remove(vulnerabilityId);
        }

        public async Task<VulnerabilityViewModel> Get(int vulnerabilityId)
        {
            var vulnerability = await _vulnerabilityProcessor.Get(vulnerabilityId);
            return _mapper.Map<VulnerabilityViewModel>(vulnerability);
        }

        public async Task<VulnerabilityViewModel> Update(VulnerabilityViewModel vulnerabilityViewModel)
        {
            var vulnerabilityModel = _mapper.Map<Models.DbModels.VulnerabilityModel>(vulnerabilityViewModel);
            var loginName = await _userContextAccessor.GetLoginNameAsync();
            var updatedVulnerability = await _vulnerabilityProcessor.Update(loginName, vulnerabilityModel);
            return _mapper.Map<VulnerabilityViewModel>(updatedVulnerability);
        }

        public async Task<List<VulnerabilityViewModel>> GetList()
        {
            var vulnerabilities = await _vulnerabilityProcessor.GetList();
            return _mapper.Map<List<VulnerabilityViewModel>>(vulnerabilities);
        }
    }

    public class IdValue
    {
        public int Id { get; set; }
        public string Name { get; set; }
    }
    public class IdValueUrl : IdValue
    {
        public string Url { get; set; }
    }

    public interface IVulnerabilityService
    {
        Task<List<IdValue>> ListSeverities();
        Task<List<IdValue>> ListCategories();
        Task<List<IdValueUrl>> ListSources();
        Task<List<VulnerabilityViewModel>> Search(VulnerabilitySearchViewModel? vulnerabilitySearch);
        Task<VulnerabilityViewModel> Add(VulnerabilityViewModel vulnerability);
        Task Approve(int vulnerabilityId);
        Task Reject(int vulnerabilityId);
        Task Remove(int vulnerabilityId);
        Task<VulnerabilityViewModel> Get(int vulnerabilityId);
        Task<VulnerabilityViewModel> Update(VulnerabilityViewModel vulnerability);
        Task<List<VulnerabilityViewModel>> GetList();

    }
}
