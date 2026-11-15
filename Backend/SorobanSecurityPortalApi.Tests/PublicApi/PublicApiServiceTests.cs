using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.PublicApi;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.PublicApi
{
    public class PublicApiServiceTests
    {
        private readonly Mock<IVulnerabilityProcessor> _vulns = new();
        private readonly Mock<IReportProcessor> _reports = new();
        private readonly Mock<IPublicApiProcessor> _public = new();
        private readonly Mock<IGeminiEmbeddingService> _embedding = new();
        private readonly Mock<IExtendedConfig> _extendedConfig = new();
        private readonly Config _config = new(@"{
            ""ProductVersion"": ""1.0"",
            ""DbConnectionTimeout"": 30,
            ""DbServer"": ""localhost"",
            ""DbPort"": 5432,
            ""DbName"": ""db"",
            ""DbUser"": ""u"",
            ""DbPassword"": ""p"",
            ""DbTimeout"": 30,
            ""DbPgPoolSize"": 10,
            ""AutoCompactLargeObjectHeap"": false,
            ""DistributedCacheUrl"": ""localhost"",
            ""DistributedCachePassword"": ""x"",
            ""AppUrl"": ""https://portal.example/api/v1""
        }");
        private VulnerabilitySearchModel? _vulnSearch;
        private ReportSearchModel? _reportSearch;

        public PublicApiServiceTests()
        {
            _extendedConfig.SetupGet(c => c.GeminiApiKey).Returns("key");
            _embedding.Setup(e => e.GenerateEmbeddingForDocumentAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(new float[] { 0.1f, 0.2f });
            _vulns.Setup(v => v.Search(It.IsAny<VulnerabilitySearchModel>()))
                .Callback<VulnerabilitySearchModel>(s => _vulnSearch = s)
                .ReturnsAsync(new List<VulnerabilityModel>());
            _vulns.Setup(v => v.SearchTotal(It.IsAny<VulnerabilitySearchModel>())).ReturnsAsync(0);
            _reports.Setup(r => r.Search(It.IsAny<ReportSearchModel?>()))
                .Callback<ReportSearchModel?>(s => _reportSearch = s)
                .ReturnsAsync(new List<ReportModel>());
            _public.Setup(p => p.ListProtocols()).ReturnsAsync(new List<PublicProtocol>
            {
                new() { Id = 1, Name = "Blend" },
                new() { Id = 2, Name = "Blend V2" },
                new() { Id = 3, Name = "Soroswap" },
            });
            _public.Setup(p => p.ListAuditors()).ReturnsAsync(new List<PublicEntity> { new() { Id = 9, Name = "Veridise" } });
            _public.Setup(p => p.ListCompanies()).ReturnsAsync(new List<PublicEntity> { new() { Id = 4, Name = "Script3" } });
        }

        private PublicApiService Build() => new(
            _vulns.Object, _reports.Object, _public.Object, _embedding.Object, _extendedConfig.Object, _config,
            new MemoryCache(new MemoryCacheOptions()), new QueryEmbeddingCache(), NullLogger<PublicApiService>.Instance)
        {
            EmbeddingTimeout = TimeSpan.FromMilliseconds(150),
        };

        private static VulnerabilityModel Vuln(int id, string severity = "High") => new()
        {
            Id = id,
            Title = $"Finding {id}",
            Severity = severity,
            Category = VulnerabilityCategory.ValidNotFixed,
            Tags = new List<string> { "Access Control" },
            Description = "body",
            Report = new ReportModel
            {
                Id = 5,
                Name = "Audit",
                Protocol = new ProtocolModel { Id = 1, Name = "Blend", Company = new CompanyModel { Id = 4, Name = "Script3" } },
                Auditor = new AuditorModel { Id = 9, Name = "Veridise" },
            },
        };

        // ---- paging ----

        [Theory]
        [InlineData(null, null, 1, 20)]
        [InlineData(0, 0, 1, 20)]
        [InlineData(-3, -1, 1, 20)]
        [InlineData(4, 50, 4, 50)]
        [InlineData(1, 100, 1, 100)]
        [InlineData(1, 100000, 1, 100)]
        public async Task Paging_Is_Normalized_And_Capped(int? page, int? pageSize, int expectedPage, int expectedSize)
        {
            var result = await Build().SearchVulnerabilities(new PublicVulnerabilityQuery { Page = page, PageSize = pageSize });

            result.Page.Should().Be(expectedPage);
            result.PageSize.Should().Be(expectedSize);
            _vulnSearch!.Page.Should().Be(expectedPage);
            _vulnSearch.PageSize.Should().Be(expectedSize);
        }

        [Fact]
        public async Task Search_Never_Asks_For_Descriptions_And_Reports_HasMore()
        {
            _vulns.Setup(v => v.Search(It.IsAny<VulnerabilitySearchModel>()))
                .Callback<VulnerabilitySearchModel>(s => _vulnSearch = s)
                .ReturnsAsync(new List<VulnerabilityModel> { Vuln(1), Vuln(2) });
            _vulns.Setup(v => v.SearchTotal(It.IsAny<VulnerabilitySearchModel>())).ReturnsAsync(5);

            var result = await Build().SearchVulnerabilities(new PublicVulnerabilityQuery { PageSize = 2 });

            _vulnSearch!.IncludeDescription.Should().BeFalse();
            result.Total.Should().Be(5);
            result.HasMore.Should().BeTrue();
            result.SearchMode.Should().Be("none");
        }

        // ---- mapping ----

        [Fact]
        public async Task Summary_Carries_Lowercase_Severity_Refs_And_Portal_Url_But_No_Internal_Fields()
        {
            _vulns.Setup(v => v.Search(It.IsAny<VulnerabilitySearchModel>())).ReturnsAsync(new List<VulnerabilityModel> { Vuln(77, "HIGH") });

            var item = (await Build().SearchVulnerabilities(new PublicVulnerabilityQuery())).Items.Single();

            item.Should().BeEquivalentTo(new
            {
                Id = 77,
                Title = "Finding 77",
                Severity = "high",
                Category = "ValidNotFixed",
                Report = new { Id = 5, Name = "Audit" },
                Protocol = new { Id = 1, Name = "Blend" },
                Company = new { Id = 4, Name = "Script3" },
                Auditor = new { Id = 9, Name = "Veridise" },
                Url = "https://portal.example/vulnerability/77",
            });
            typeof(PublicVulnerabilitySummary).GetProperties().Select(p => p.Name)
                .Should().NotContain(new[] { "CreatedBy", "LastActionBy", "Status", "IsHidden", "IsDeleted", "Embedding", "PicturesContainerGuid" });
        }

        // ---- filters ----

        [Fact]
        public async Task Severity_Filter_Is_Case_Insensitive_And_Covers_Both_Stored_Spellings()
        {
            await Build().SearchVulnerabilities(new PublicVulnerabilityQuery { Severity = "HIGH, critical" });

            _vulnSearch!.Severities.Should().BeEquivalentTo(new[] { "high", "High", "critical", "Critical" });
        }

        [Theory]
        [InlineData("urgent")]
        [InlineData("high,urgent")]
        public async Task Unknown_Severity_Is_A_Validation_Error(string severity)
        {
            var act = () => Build().SearchVulnerabilities(new PublicVulnerabilityQuery { Severity = severity });

            (await act.Should().ThrowAsync<PublicApiValidationException>()).WithMessage("*severity*");
        }

        [Fact]
        public async Task Category_Accepts_Friendly_Spellings()
        {
            await Build().SearchVulnerabilities(new PublicVulnerabilityQuery { Category = "valid_not_fixed, acknowledged" });

            _vulnSearch!.Categories.Should().Equal(VulnerabilityCategory.ValidNotFixed, VulnerabilityCategory.Acknowledged);
        }

        [Theory]
        [InlineData("Invalid")] // never exposed publicly
        [InlineData("3")]
        [InlineData("nonsense")]
        public async Task Invalid_Or_Unknown_Category_Is_A_Validation_Error(string category)
        {
            var act = () => Build().SearchVulnerabilities(new PublicVulnerabilityQuery { Category = category });

            await act.Should().ThrowAsync<PublicApiValidationException>();
        }

        [Fact]
        public async Task Protocol_By_Id()
        {
            await Build().SearchVulnerabilities(new PublicVulnerabilityQuery { Protocol = "3" });
            _vulnSearch!.ProtocolIds.Should().Equal(3);
        }

        [Fact]
        public async Task Protocol_By_Exact_Name_Wins_Over_Partial_Matches()
        {
            await Build().SearchVulnerabilities(new PublicVulnerabilityQuery { Protocol = "blend" });
            _vulnSearch!.ProtocolIds.Should().Equal(1);
        }

        [Fact]
        public async Task Protocol_By_Partial_Name_Matches_All_Containing()
        {
            await Build().SearchVulnerabilities(new PublicVulnerabilityQuery { Protocol = "ble" });
            _vulnSearch!.ProtocolIds.Should().BeEquivalentTo(new[] { 1, 2 });
        }

        [Theory]
        [InlineData("999")]
        [InlineData("no-such-protocol")]
        public async Task Unknown_Protocol_Is_A_Validation_Error_Not_An_Empty_Result(string protocol)
        {
            var act = () => Build().SearchVulnerabilities(new PublicVulnerabilityQuery { Protocol = protocol });

            (await act.Should().ThrowAsync<PublicApiValidationException>()).WithMessage("*protocol*");
        }

        [Fact]
        public async Task From_After_To_Is_A_Validation_Error()
        {
            var act = () => Build().SearchVulnerabilities(new PublicVulnerabilityQuery
            {
                From = new DateTime(2026, 5, 1),
                To = new DateTime(2026, 1, 1),
            });

            await act.Should().ThrowAsync<PublicApiValidationException>();
        }

        [Fact]
        public async Task Overlong_Query_Is_A_Validation_Error()
        {
            var act = () => Build().SearchVulnerabilities(new PublicVulnerabilityQuery { Query = new string('x', 501) });

            await act.Should().ThrowAsync<PublicApiValidationException>();
        }

        // ---- text search ----

        [Fact]
        public async Task Query_With_Working_Embeddings_Is_A_Semantic_Search_With_The_Configured_Threshold()
        {
            var result = await Build().SearchVulnerabilities(new PublicVulnerabilityQuery { Query = "  reentrancy  " });

            result.SearchMode.Should().Be("semantic");
            _vulnSearch!.SearchText.Should().Be("reentrancy");
            _vulnSearch.Embedding.Should().NotBeNull();
            _vulnSearch.MinRelevance.Should().BeNull();
        }

        [Fact]
        public async Task Query_When_Embeddings_Fail_Falls_Back_To_Keyword_Search_Instead_Of_Failing()
        {
            _embedding.Setup(e => e.GenerateEmbeddingForDocumentAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ThrowsAsync(new Exception("402"));

            var result = await Build().SearchVulnerabilities(new PublicVulnerabilityQuery { Query = "reentrancy" });

            result.SearchMode.Should().Be("keyword");
            _vulnSearch!.Embedding.Should().BeNull();
            _vulnSearch.MinRelevance.Should().BeLessThan(1); // the vector-tuned threshold would hide everything
        }

        [Fact]
        public async Task After_A_Failure_The_Provider_Is_Skipped_For_Other_Queries_Too()
        {
            _embedding.Setup(e => e.GenerateEmbeddingForDocumentAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ThrowsAsync(new Exception("down"));
            var service = Build();

            await service.SearchVulnerabilities(new PublicVulnerabilityQuery { Query = "first" });
            await service.SearchVulnerabilities(new PublicVulnerabilityQuery { Query = "second" });
            await service.SearchReports(new PublicReportQuery { Query = "third" });

            _embedding.Verify(e => e.GenerateEmbeddingForDocumentAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task A_Slow_Provider_Is_Cancelled_Not_Left_Running()
        {
            // A provider call that only ends when its token is cancelled, like a request stuck in retries.
            CancellationToken seen = default;
            _embedding.Setup(e => e.GenerateEmbeddingForDocumentAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .Returns<string, CancellationToken>(async (_, token) =>
                {
                    seen = token;
                    await Task.Delay(Timeout.Infinite, token);
                    return Array.Empty<float>();
                });

            var result = await Build().SearchVulnerabilities(new PublicVulnerabilityQuery { Query = "reentrancy" });

            result.SearchMode.Should().Be("keyword");
            seen.IsCancellationRequested.Should().BeTrue();
        }

        [Fact]
        public async Task The_Same_Query_Is_Embedded_Once()
        {
            var service = Build();

            await service.SearchVulnerabilities(new PublicVulnerabilityQuery { Query = "Reentrancy" });
            await service.SearchVulnerabilities(new PublicVulnerabilityQuery { Query = "Reentrancy", Page = 2 });

            _embedding.Verify(e => e.GenerateEmbeddingForDocumentAsync("Reentrancy", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Another_Spelling_Of_A_Query_Gets_Its_Own_Embedding_Not_The_First_Ones()
        {
            var service = Build();

            await service.SearchVulnerabilities(new PublicVulnerabilityQuery { Query = "DoS in AMM" });
            await service.SearchVulnerabilities(new PublicVulnerabilityQuery { Query = "dos in amm" });

            _embedding.Verify(e => e.GenerateEmbeddingForDocumentAsync("DoS in AMM", It.IsAny<CancellationToken>()), Times.Once);
            _embedding.Verify(e => e.GenerateEmbeddingForDocumentAsync("dos in amm", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Without_A_Configured_Embedding_Key_The_Provider_Is_Never_Called()
        {
            _extendedConfig.SetupGet(c => c.GeminiApiKey).Returns("");

            var result = await Build().SearchVulnerabilities(new PublicVulnerabilityQuery { Query = "reentrancy" });

            result.SearchMode.Should().Be("keyword");
            _embedding.Verify(e => e.GenerateEmbeddingForDocumentAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        // ---- single items ----

        [Fact]
        public async Task GetVulnerability_Returns_Description_And_Null_When_Missing()
        {
            _public.Setup(p => p.GetVulnerability(10)).ReturnsAsync(Vuln(10));
            _public.Setup(p => p.GetVulnerability(11)).ReturnsAsync((VulnerabilityModel?)null);

            (await Build().GetVulnerability(10))!.Description.Should().Be("body");
            (await Build().GetVulnerability(11)).Should().BeNull();
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-1)]
        public async Task Non_Positive_Id_Is_A_Validation_Error(int id)
        {
            await ((Func<Task>)(() => Build().GetVulnerability(id))).Should().ThrowAsync<PublicApiValidationException>();
            await ((Func<Task>)(() => Build().GetReport(id, false))).Should().ThrowAsync<PublicApiValidationException>();
        }

        // ---- reports ----

        [Fact]
        public async Task Reports_Without_Query_Are_Newest_First_And_Paged_In_Memory()
        {
            var all = Enumerable.Range(1, 45).Select(i => new ReportModel { Id = i, Name = $"R{i}" }).ToList();
            _reports.Setup(r => r.Search(It.IsAny<ReportSearchModel?>()))
                .Callback<ReportSearchModel?>(s => _reportSearch = s)
                .ReturnsAsync(all);

            var page = await Build().SearchReports(new PublicReportQuery { Page = 3, PageSize = 20 });

            _reportSearch!.SortBy.Should().Be("date");
            _reportSearch.SortDirection.Should().Be("desc");
            page.Total.Should().Be(45);
            page.Items.Select(i => i.Id).Should().Equal(41, 42, 43, 44, 45);
            page.HasMore.Should().BeFalse();
            page.Items[0].Url.Should().Be("https://portal.example/report/41");
            page.Items[0].DownloadUrl.Should().Be("https://portal.example/api/v1/reports/41/download");
        }

        [Fact]
        public async Task A_Huge_Report_Page_Number_Is_An_Empty_Page_Not_Page_One()
        {
            var all = Enumerable.Range(1, 45).Select(i => new ReportModel { Id = i, Name = $"R{i}" }).ToList();
            _reports.Setup(r => r.Search(It.IsAny<ReportSearchModel?>())).ReturnsAsync(all);

            // 30_000_000 * 100 overflows int; a 32-bit offset would wrap and serve the first page.
            var page = await Build().SearchReports(new PublicReportQuery { Page = 30_000_000, PageSize = 100 });

            page.Items.Should().BeEmpty();
            page.Total.Should().Be(45);
            page.HasMore.Should().BeFalse();
        }

        [Fact]
        public async Task The_Query_Embedding_Cache_Is_Bounded()
        {
            var cache = new QueryEmbeddingCache();
            var service = new PublicApiService(
                _vulns.Object, _reports.Object, _public.Object, _embedding.Object, _extendedConfig.Object, _config,
                new MemoryCache(new MemoryCacheOptions()), cache, NullLogger<PublicApiService>.Instance);

            for (var i = 0; i < QueryEmbeddingCache.MaxEntries + 50; i++)
                await service.SearchVulnerabilities(new PublicVulnerabilityQuery { Query = $"query {i}" });

            cache.Cache.Count.Should().BeLessThanOrEqualTo(QueryEmbeddingCache.MaxEntries);
        }

        [Fact]
        public async Task Reports_With_Query_Leave_Ordering_To_Relevance()
        {
            await Build().SearchReports(new PublicReportQuery { Query = "lending" });

            _reportSearch!.SortBy.Should().BeNull();
            _reportSearch.SearchText.Should().Be("lending");
        }

        [Fact]
        public async Task Report_Filter_That_Matches_Several_Entities_Asks_For_A_Precise_One()
        {
            var act = () => Build().SearchReports(new PublicReportQuery { Protocol = "ble" });

            (await act.Should().ThrowAsync<PublicApiValidationException>()).WithMessage("*matches 2*");
        }

        [Fact]
        public async Task GetReport_Returns_Findings_Counts_And_Content_Only_On_Request()
        {
            _public.Setup(p => p.GetReport(5, It.IsAny<bool>())).ReturnsAsync(new ReportModel { Id = 5, Name = "Audit", MdFile = "# text" });
            _public.Setup(p => p.CountReportFindingsBySeverity(5)).ReturnsAsync(new Dictionary<string, int> { ["high"] = 2 });
            _vulns.Setup(v => v.Search(It.IsAny<VulnerabilitySearchModel>()))
                .Callback<VulnerabilitySearchModel>(s => _vulnSearch = s)
                .ReturnsAsync(new List<VulnerabilityModel> { Vuln(1), Vuln(2) });
            _vulns.Setup(v => v.SearchTotal(It.IsAny<VulnerabilitySearchModel>())).ReturnsAsync(2);

            var without = await Build().GetReport(5, includeContent: false);
            var with = await Build().GetReport(5, includeContent: true);

            without!.Content.Should().BeNull();
            with!.Content.Should().Be("# text");
            with.FindingsTotal.Should().Be(2);
            with.FindingsBySeverity.Should().ContainKey("high").WhoseValue.Should().Be(2);
            with.Findings.Should().HaveCount(2);
            _vulnSearch!.ReportIds.Should().Equal(5);
            _vulnSearch.PageSize.Should().Be(100);
            _vulnSearch.IncludeDescription.Should().BeFalse();
        }

        [Fact]
        public async Task GetReport_Missing_Is_Null()
        {
            _public.Setup(p => p.GetReport(6, false)).ReturnsAsync((ReportModel?)null);

            (await Build().GetReport(6, false)).Should().BeNull();
        }

        // ---- catalog ----

        [Fact]
        public async Task Catalog_Lists_Carry_Portal_Urls_And_Are_Cached_Briefly()
        {
            var service = Build();

            var first = await service.ListProtocols();
            await service.ListProtocols();
            await service.SearchVulnerabilities(new PublicVulnerabilityQuery { Protocol = "Blend" });

            first.Select(p => p.Url).Should().StartWith("https://portal.example/protocol/1");
            _public.Verify(p => p.ListProtocols(), Times.Once);
            (await service.ListAuditors()).Single().Url.Should().Be("https://portal.example/auditor/9");
            (await service.ListCompanies()).Single().Url.Should().Be("https://portal.example/company/4");
        }
    }
}
