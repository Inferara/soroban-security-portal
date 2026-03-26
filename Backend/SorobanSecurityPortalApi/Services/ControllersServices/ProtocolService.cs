using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Common;
using System.Collections.Generic;
using System.Linq;
using System;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class ProtocolService : IProtocolService
    {
        private readonly IMapper _mapper;
        private readonly IProtocolProcessor _protocolProcessor;
        private readonly IReportProcessor _reportProcessor;
        private readonly IVulnerabilityProcessor _vulnerabilityProcessor;
        private readonly UserContextAccessor _userContextAccessor;

        public ProtocolService(
            IMapper mapper,
            IProtocolProcessor protocolProcessor,
            IReportProcessor reportProcessor,
            IVulnerabilityProcessor vulnerabilityProcessor,
            UserContextAccessor userContextAccessor)
        {
            _mapper = mapper;
            _protocolProcessor = protocolProcessor;
            _reportProcessor = reportProcessor;
            _vulnerabilityProcessor = vulnerabilityProcessor;
            _userContextAccessor = userContextAccessor;
        }

        public async Task<ProtocolViewModel> Add(ProtocolViewModel protocolViewModel)
        {
            var protocolModel = _mapper.Map<ProtocolModel>(protocolViewModel);
            protocolModel.CreatedBy = await _userContextAccessor.GetLoginIdAsync();
            protocolModel.Date = DateTime.UtcNow;
            protocolModel = await _protocolProcessor.Add(protocolModel);
            return _mapper.Map<ProtocolViewModel>(protocolModel);
        }

        public async Task<List<ProtocolViewModel>> List()
        {
            var protocols = await _protocolProcessor.List();
            return _mapper.Map<List<ProtocolViewModel>>(protocols);
        }

        public async Task<ProtocolModel?> GetById(int id)
        {
            return await _protocolProcessor.GetById(id);
        }

        public async Task Delete(int id)
        {
            await _protocolProcessor.Delete(id);
        }

        public async Task<Result<ProtocolViewModel, string>> Update(ProtocolViewModel protocolViewModel)
        {
            var protocolModel = _mapper.Map<ProtocolModel>(protocolViewModel);
            var loginId = await _userContextAccessor.GetLoginIdAsync();
            if (! await CanUpdateProtocol(protocolModel, loginId))
            {
                return new Result<ProtocolViewModel, string>.Err("You cannot update this protocol.");
            }
            protocolModel = await _protocolProcessor.Update(protocolModel);
            return new Result<ProtocolViewModel, string>.Ok(_mapper.Map<ProtocolViewModel>(protocolModel));
        }

        public async Task<ProtocolStatisticsChangesViewModel> GetStatisticsChanges()
        {
            var statsChange = await _protocolProcessor.GetStatisticsChanges();
            return _mapper.Map<ProtocolStatisticsChangesViewModel>(statsChange);
        }

        public async Task<List<ProtocolWithMetricsViewModel>> ListWithMetrics()
        {
            var protocols = await _protocolProcessor.List();
            var protocolsViewModel = _mapper.Map<List<ProtocolViewModel>>(protocols);

            var reports = await _reportProcessor.GetList(false); // only approved

            // Filter to approved vulnerabilities only, excluding Invalid and NA categories
            // to keep metrics consistent with what is shown on the vulnerabilities page
            var vulnerabilities = (await _vulnerabilityProcessor.GetList())
                .Where(v => v.Status == VulnerabilityModelStatus.Approved
                         && v.Category != VulnerabilityCategory.Invalid
                         && v.Category != VulnerabilityCategory.NA)
                .ToList();

            // Pre-group by protocol ID once (O(R+V)) rather than scanning inside the loop (O(P*(R+V)))
            var reportsByProtocol = reports
                .Where(r => r.Protocol != null)
                .ToLookup(r => r.Protocol!.Id);

            var vulnerabilitiesByProtocol = vulnerabilities
                .Where(v => v.Report?.Protocol != null)
                .ToLookup(v => v.Report!.Protocol!.Id);

            var result = new List<ProtocolWithMetricsViewModel>();

            foreach (var protocol in protocolsViewModel)
            {
                var protocolReports = reportsByProtocol[protocol.Id];
                var protocolVulnerabilities = vulnerabilitiesByProtocol[protocol.Id];

                var totalVulnerabilities = protocolVulnerabilities.Count();
                var fixedVulnerabilities = protocolVulnerabilities.Count(v => v.Category == VulnerabilityCategory.Valid);
                var fixRate = totalVulnerabilities > 0 ? (int)Math.Round((double)fixedVulnerabilities / totalVulnerabilities * 100) : 0;

                result.Add(new ProtocolWithMetricsViewModel
                {
                    Protocol = protocol,
                    ReportsCount = protocolReports.Count(),
                    VulnerabilitiesCount = totalVulnerabilities,
                    FixedCount = fixedVulnerabilities,
                    FixRate = fixRate,
                    CompanyName = protocolReports.FirstOrDefault()?.Protocol?.Company?.Name ?? "N/A",
                    Auditors = protocolReports.Select(r => r.Auditor?.Name).Where(n => !string.IsNullOrEmpty(n)).Distinct().ToList()!
                });
            }

            return result;
        }

        private async Task<bool> CanUpdateProtocol(ProtocolModel protocolModel, int loginId)
        {
            if (protocolModel.CreatedBy == loginId || await _userContextAccessor.IsLoginIdAdmin(loginId))
            {
                return true;
            }
            else
            {
                if (await _userContextAccessor.IsLoginIdAdmin(protocolModel.CreatedBy))
                {
                    return false;
                }
                return true;
            }
        }
    }

    public interface IProtocolService
    {
        Task<ProtocolViewModel> Add(ProtocolViewModel protocolViewModel);
        Task<List<ProtocolViewModel>> List();
        Task<ProtocolModel?> GetById(int id);
        Task Delete(int id);
        Task<Result<ProtocolViewModel, string>> Update(ProtocolViewModel protocolViewModel);
        Task<ProtocolStatisticsChangesViewModel> GetStatisticsChanges();
        Task<List<ProtocolWithMetricsViewModel>> ListWithMetrics();
    }
}
