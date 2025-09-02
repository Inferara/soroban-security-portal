using AutoMapper;
using Pgvector;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class VulnerabilityService : IVulnerabilityService
    {
        private readonly IMapper _mapper;
        private readonly IVulnerabilityProcessor _vulnerabilityProcessor;
        private readonly IReportProcessor _reportProcessor;
        private readonly IFileProcessor _fileProcessor;
        private readonly IGeminiEmbeddingService _embeddingService;
        private readonly UserContextAccessor _userContextAccessor;

        public VulnerabilityService(
            IMapper mapper,
            IVulnerabilityProcessor vulnerabilityProcessor,
            IReportProcessor reportProcessor,
            IFileProcessor fileProcessor,
            IGeminiEmbeddingService embeddingService,
            UserContextAccessor userContextAccessor)
        {
            _mapper = mapper;
            _vulnerabilityProcessor = vulnerabilityProcessor;
            _reportProcessor = reportProcessor;
            _fileProcessor = fileProcessor;
            _embeddingService = embeddingService;
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
                new IdValue { Id = 5, Name = "Note" }
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


        public async Task<List<VulnerabilityViewModel>> Search(VulnerabilitySearchViewModel? vulnerabilitySearchViewModel)
        {
            var vulnerabilitySearchModel = _mapper.Map<Models.DbModels.VulnerabilitySearchModel>(vulnerabilitySearchViewModel);
            if (vulnerabilitySearchModel != null && !string.IsNullOrEmpty(vulnerabilitySearchModel.SearchText))
            {
                var embeddingArray = await _embeddingService.GenerateEmbeddingForDocumentAsync(vulnerabilitySearchModel.SearchText);
                vulnerabilitySearchModel.Embedding = new Vector(embeddingArray);
            }
            var searchResult = await _vulnerabilityProcessor.Search(vulnerabilitySearchModel);
            var result = _mapper.Map<List<VulnerabilityViewModel>>(searchResult);
            return result;
        }

        public async Task<int> SearchTotal(VulnerabilitySearchViewModel? vulnerabilitySearchViewModel)
        {
            var vulnerabilitySearchModel = _mapper.Map<Models.DbModels.VulnerabilitySearchModel>(vulnerabilitySearchViewModel);
            if (vulnerabilitySearchModel != null && !string.IsNullOrEmpty(vulnerabilitySearchModel.SearchText))
            {
                var embeddingArray = await _embeddingService.GenerateEmbeddingForDocumentAsync(vulnerabilitySearchModel.SearchText);
                vulnerabilitySearchModel.Embedding = new Vector(embeddingArray);
            }
            return await _vulnerabilityProcessor.SearchTotal(_mapper.Map<Models.DbModels.VulnerabilitySearchModel>(vulnerabilitySearchModel));
        }

        public async Task<VulnerabilityViewModel> Add(VulnerabilityViewModel vulnerabilityViewModel, List<FileViewModel> files)
        {
            var loginName = await _userContextAccessor.GetLoginNameAsync();
            foreach (var file in files)
            {
                if (file.BinFile != null && file.BinFile.Length > 0)
                {
                    var fileModel = _mapper.Map<Models.DbModels.FileModel>(file);
                    fileModel.Date = DateTime.UtcNow;
                    fileModel.Author = loginName;
                    var addedFile = await _fileProcessor.Add(fileModel);
                    file.Id = addedFile.Id;
                }
            }
            var vulnerabilityModel = _mapper.Map<Models.DbModels.VulnerabilityModel>(vulnerabilityViewModel);
            vulnerabilityModel.Author = loginName;
            var addedVulnerability = await _vulnerabilityProcessor.Add(vulnerabilityModel);
            return _mapper.Map<VulnerabilityViewModel>(addedVulnerability);
        }

        public async Task Approve(int vulnerabilityId)
        {
            var loginName = await _userContextAccessor.GetLoginNameAsync();
            await _vulnerabilityProcessor.Approve(vulnerabilityId, loginName);
        }

        public async Task<Result<bool, string>> Reject(int vulnerabilityId)
        {
            var loginName = await _userContextAccessor.GetLoginNameAsync();
            var vulnerabilityModel = await _vulnerabilityProcessor.Get(vulnerabilityId);
            if (vulnerabilityModel == null)
                return new Result<bool, string>.Err("Vulnerability not found.");
            if (!await CanUpdateRejectVulnerability(vulnerabilityModel, loginName))
                return new Result<bool, string>.Err("You cannot reject this vulnerability.");
            await _vulnerabilityProcessor.Reject(vulnerabilityId, loginName);
            return new Result<bool, string>.Ok(true);
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

        public async Task<Result<VulnerabilityViewModel, string>> Update(VulnerabilityViewModel vulnerabilityViewModel, List<FileViewModel> files)
        {
            var vulnerabilityModel = _mapper.Map<Models.DbModels.VulnerabilityModel>(vulnerabilityViewModel);
            var loginName = await _userContextAccessor.GetLoginNameAsync();
            if (! await CanUpdateRejectVulnerability(vulnerabilityModel, loginName))
            {
                return new Result<VulnerabilityViewModel, string>.Err("You cannot update this vulnerability.");
            }
            foreach (var file in files)
            {
                if (file.BinFile != null && file.BinFile.Length > 0)
                {
                    var fileModel = _mapper.Map<Models.DbModels.FileModel>(file);
                    fileModel.Date = DateTime.UtcNow;
                    fileModel.Author = loginName; //TODO better have id here if we want to let users change their logins (maybe not)
                    var addedFile = await _fileProcessor.Add(fileModel);
                    file.Id = addedFile.Id;
                }
            }
            var updatedVulnerability = await _vulnerabilityProcessor.Update(loginName, vulnerabilityModel);
            return new Result<VulnerabilityViewModel, string>.Ok(_mapper.Map<VulnerabilityViewModel>(updatedVulnerability));
        }

        public async Task<List<VulnerabilityViewModel>> GetList()
        {
            var vulnerabilities = await _vulnerabilityProcessor.GetList();
            return _mapper.Map<List<VulnerabilityViewModel>>(vulnerabilities);
        }

        public async Task<VulnerabilitiesStatisticsViewModel> GetStatistics()
        {
            return await _vulnerabilityProcessor.GetStatistics();
        }

        public async Task<VulnerabilityStatisticsChangesViewModel> GetStatisticsChange()
        {
            return await _vulnerabilityProcessor.GetStatisticsChanges();
        }

        private async Task<bool> CanUpdateRejectVulnerability(VulnerabilityModel vulnerabilityModel, string login)
        {
            if (vulnerabilityModel.Author == login || await _userContextAccessor.IsLoginAdmin(login))
            {
                return true;
            }
            else
            {
                if (await _userContextAccessor.IsLoginAdmin(vulnerabilityModel.Author))
                {
                    return false;
                }
                return true;
            }
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
        Task<List<IdValueUrl>> ListSources();
        Task<List<VulnerabilityViewModel>> Search(VulnerabilitySearchViewModel? vulnerabilitySearch);
        Task<int> SearchTotal(VulnerabilitySearchViewModel? vulnerabilitySearch);
        Task<VulnerabilityViewModel> Add(VulnerabilityViewModel vulnerability, List<FileViewModel> files);
        Task Approve(int vulnerabilityId);
        Task<Result<bool, string>> Reject(int vulnerabilityId);
        Task Remove(int vulnerabilityId);
        Task<VulnerabilityViewModel> Get(int vulnerabilityId);
        Task<Result<VulnerabilityViewModel, string>> Update(VulnerabilityViewModel vulnerability, List<FileViewModel> files);
        Task<List<VulnerabilityViewModel>> GetList();
        Task<VulnerabilitiesStatisticsViewModel> GetStatistics();
        Task<VulnerabilityStatisticsChangesViewModel> GetStatisticsChange();
    }
}
