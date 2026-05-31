using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Tests.Services; // TestAsyncQueryProvider<T> / TestAsyncEnumerator<T>
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Data
{
    public class AgentRunProcessorTests
    {
        private static Mock<DbSet<T>> CreateDbSetMock<T>(List<T> source) where T : class
        {
            var q = source.AsQueryable();
            var m = new Mock<DbSet<T>>();
            m.As<IQueryable<T>>().Setup(x => x.Provider).Returns(new TestAsyncQueryProvider<T>(q.Provider));
            m.As<IQueryable<T>>().Setup(x => x.Expression).Returns(q.Expression);
            m.As<IQueryable<T>>().Setup(x => x.ElementType).Returns(q.ElementType);
            m.As<IQueryable<T>>().Setup(x => x.GetEnumerator()).Returns(q.GetEnumerator());
            m.As<IAsyncEnumerable<T>>().Setup(x => x.GetAsyncEnumerator(It.IsAny<CancellationToken>()))
                .Returns(new TestAsyncEnumerator<T>(q.GetEnumerator()));
            m.Setup(d => d.Add(It.IsAny<T>())).Callback<T>(source.Add);
            return m;
        }

        private static Mock<IDbContextFactory<Db>> BuildFactory(List<AgentRunModel> list)
        {
            var dbMock = new Mock<Db>(
                new Mock<IDbQuery>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<Db>>().Object,
                new Mock<IDataSourceProvider>().Object) { CallBase = true };
            dbMock.Setup(d => d.AgentRun).Returns(CreateDbSetMock(list).Object);
            dbMock.Setup(d => d.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
            var factory = new Mock<IDbContextFactory<Db>>();
            factory.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(dbMock.Object);
            return factory;
        }

        [Fact]
        public async Task Add_Defaults_Status_To_Queued_And_Persists()
        {
            var list = new List<AgentRunModel>();
            var processor = new AgentRunProcessor(BuildFactory(list).Object);

            var result = await processor.Add(new AgentRunModel { SourceUrl = "https://x/report" });

            result.Status.Should().Be(AgentRunStatus.Queued);
            list.Should().ContainSingle();
        }

        [Fact]
        public async Task ClaimNextQueued_Marks_Oldest_Queued_As_Processing()
        {
            var list = new List<AgentRunModel>
            {
                new() { Id = 1, Status = AgentRunStatus.Succeeded },
                new() { Id = 2, Status = AgentRunStatus.Queued },
                new() { Id = 3, Status = AgentRunStatus.Queued },
            };
            var processor = new AgentRunProcessor(BuildFactory(list).Object);

            var claimed = await processor.ClaimNextQueued();

            claimed!.Id.Should().Be(2);
            claimed.Status.Should().Be(AgentRunStatus.Processing);
            claimed.StartedAt.Should().NotBeNull();
        }

        [Fact]
        public async Task ClaimNextQueued_Returns_Null_When_None_Queued()
        {
            var list = new List<AgentRunModel> { new() { Id = 1, Status = AgentRunStatus.Succeeded } };
            var processor = new AgentRunProcessor(BuildFactory(list).Object);

            (await processor.ClaimNextQueued()).Should().BeNull();
        }

        [Fact]
        public async Task SubmitResult_Success_Sets_Succeeded_And_Stores_Output()
        {
            var list = new List<AgentRunModel> { new() { Id = 5, Status = AgentRunStatus.Processing } };
            var processor = new AgentRunProcessor(BuildFactory(list).Object);

            await processor.SubmitResult(5, new AgentRunResult
            {
                Success = true, ArticleMarkdown = "# A", FindingsJson = "[]", Transcript = "...", DurationMs = 1234
            });

            var run = list.Single();
            run.Status.Should().Be(AgentRunStatus.Succeeded);
            run.ArticleMarkdown.Should().Be("# A");
            run.FinishedAt.Should().NotBeNull();
        }

        [Fact]
        public async Task SubmitResult_Failure_Sets_Failed_And_Stores_Error()
        {
            var list = new List<AgentRunModel> { new() { Id = 6, Status = AgentRunStatus.Processing } };
            var processor = new AgentRunProcessor(BuildFactory(list).Object);

            await processor.SubmitResult(6, new AgentRunResult { Success = false, Error = "timeout", Transcript = "boom" });

            list.Single().Status.Should().Be(AgentRunStatus.Failed);
            list.Single().Error.Should().Be("timeout");
        }

        [Fact]
        public async Task SetStatus_Updates_Status()
        {
            var list = new List<AgentRunModel> { new() { Id = 7, Status = AgentRunStatus.Succeeded } };
            var processor = new AgentRunProcessor(BuildFactory(list).Object);

            await processor.SetStatus(7, AgentRunStatus.Rejected);

            list.Single().Status.Should().Be(AgentRunStatus.Rejected);
        }

        [Fact]
        public async Task GetList_Omits_Heavy_Columns_And_Orders_By_Id_Desc()
        {
            var list = new List<AgentRunModel>
            {
                new() { Id = 1, Status = AgentRunStatus.Succeeded, ArticleMarkdown = "big", FindingsJson = "[{}]", Transcript = "trace" },
                new() { Id = 2, Status = AgentRunStatus.Queued },
            };
            var processor = new AgentRunProcessor(BuildFactory(list).Object);

            var page = await processor.GetList(page: 1, pageSize: 10);

            page.Should().HaveCount(2);
            page[0].Id.Should().Be(2); // OrderByDescending(Id)
            page.Should().OnlyContain(r => r.ArticleMarkdown == "" && r.FindingsJson == "" && r.Transcript == "");
        }

        [Fact]
        public async Task SetProvenance_Stores_CreatedReportId_And_VulnerabilityIds()
        {
            var list = new List<AgentRunModel> { new() { Id = 9, Status = AgentRunStatus.Succeeded } };
            var processor = new AgentRunProcessor(BuildFactory(list).Object);

            await processor.SetProvenance(9, createdReportId: 55, createdVulnerabilityIds: new List<int> { 200, 201 });

            list.Single().CreatedReportId.Should().Be(55);
            list.Single().CreatedVulnerabilityIds.Should().BeEquivalentTo(new[] { 200, 201 });
        }

        [Fact]
        public async Task SubmitResult_Stores_Report_Metadata()
        {
            var list = new List<AgentRunModel> { new() { Id = 50, Status = AgentRunStatus.Processing } };
            var processor = new AgentRunProcessor(BuildFactory(list).Object);

            await processor.SubmitResult(50, new AgentRunResult
            {
                Success = true, ReportTitle = "Rozo Audit", ProtocolName = "Rozo",
                AuditorName = "Hacken", ReportDate = new DateTime(2026, 4, 13, 0, 0, 0, DateTimeKind.Utc)
            });

            var run = list.Single();
            run.ReportTitle.Should().Be("Rozo Audit");
            run.ProtocolName.Should().Be("Rozo");
            run.AuditorName.Should().Be("Hacken");
            run.ReportDate.Should().Be(new DateTime(2026, 4, 13, 0, 0, 0, DateTimeKind.Utc));
        }

        [Fact]
        public async Task SubmitResult_Coerces_Unspecified_ReportDate_To_Utc()
        {
            // A date like "2026-04-13" deserializes to Kind=Unspecified, which Npgsql rejects for a
            // timestamptz column. The processor must coerce it to UTC so the save doesn't 500.
            var list = new List<AgentRunModel> { new() { Id = 51, Status = AgentRunStatus.Processing } };
            var processor = new AgentRunProcessor(BuildFactory(list).Object);

            await processor.SubmitResult(51, new AgentRunResult
            {
                Success = true,
                ReportDate = new DateTime(2026, 4, 13, 0, 0, 0, DateTimeKind.Unspecified)
            });

            list.Single().ReportDate!.Value.Kind.Should().Be(DateTimeKind.Utc);
        }

        [Fact]
        public async Task UpdateTranscript_Sets_Transcript()
        {
            var list = new List<AgentRunModel> { new() { Id = 7, Status = AgentRunStatus.Processing, Transcript = "" } };
            var processor = new AgentRunProcessor(BuildFactory(list).Object);

            await processor.UpdateTranscript(7, "step 1\nstep 2");

            list.Single().Transcript.Should().Be("step 1\nstep 2");
        }

        [Fact]
        public async Task SubmitResult_Stores_ReportPdfUrl()
        {
            var list = new List<AgentRunModel> { new() { Id = 52, Status = AgentRunStatus.Processing } };
            var processor = new AgentRunProcessor(BuildFactory(list).Object);

            await processor.SubmitResult(52, new AgentRunResult
            {
                Success = true,
                ReportPdfUrl = "https://example.com/report.pdf"
            });

            list.Single().ReportPdfUrl.Should().Be("https://example.com/report.pdf");
        }

        [Fact]
        public async Task SubmitResult_Ignores_Submit_When_Run_Not_Processing()
        {
            // A late/duplicate submit (e.g. from a worker whose run was already reaped) must not clobber
            // a run that's already terminal.
            var list = new List<AgentRunModel>
            {
                new() { Id = 5, Status = AgentRunStatus.Failed, ArticleMarkdown = "original", Error = "reaped" }
            };
            var processor = new AgentRunProcessor(BuildFactory(list).Object);

            await processor.SubmitResult(5, new AgentRunResult { Success = true, ArticleMarkdown = "LATE" });

            list.Single().Status.Should().Be(AgentRunStatus.Failed);
            list.Single().ArticleMarkdown.Should().Be("original");
            list.Single().Error.Should().Be("reaped");
        }

        [Fact]
        public async Task ReclaimStuckProcessing_Fails_Only_Old_Processing_Runs()
        {
            var now = DateTime.UtcNow;
            var list = new List<AgentRunModel>
            {
                new() { Id = 1, Status = AgentRunStatus.Processing, StartedAt = now.AddMinutes(-40) }, // stuck
                new() { Id = 2, Status = AgentRunStatus.Processing, StartedAt = now.AddMinutes(-5) },  // recent
                new() { Id = 3, Status = AgentRunStatus.Processing, StartedAt = null },                // never started
                new() { Id = 4, Status = AgentRunStatus.Succeeded,  StartedAt = now.AddMinutes(-90) }, // terminal
            };
            var processor = new AgentRunProcessor(BuildFactory(list).Object);

            var reclaimed = await processor.ReclaimStuckProcessing(TimeSpan.FromMinutes(30));

            reclaimed.Should().Be(1);
            list.First(r => r.Id == 1).Status.Should().Be(AgentRunStatus.Failed);
            list.First(r => r.Id == 1).Error.Should().Contain("Abandoned");
            list.First(r => r.Id == 1).FinishedAt.Should().NotBeNull();
            list.First(r => r.Id == 2).Status.Should().Be(AgentRunStatus.Processing);
            list.First(r => r.Id == 3).Status.Should().Be(AgentRunStatus.Processing);
            list.First(r => r.Id == 4).Status.Should().Be(AgentRunStatus.Succeeded);
        }

        [Fact]
        public async Task FindActiveOrApprovedBySourceUrl_Matches_Active_Or_Approved_Only()
        {
            var list = new List<AgentRunModel>
            {
                new() { Id = 1, SourceUrl = "u", Status = AgentRunStatus.Failed },
                new() { Id = 2, SourceUrl = "u", Status = AgentRunStatus.Approved, CreatedReportId = 5 },
                new() { Id = 3, SourceUrl = "other", Status = AgentRunStatus.Queued },
            };
            var processor = new AgentRunProcessor(BuildFactory(list).Object);

            var found = await processor.FindActiveOrApprovedBySourceUrl("u");
            found.Should().NotBeNull();
            found!.Id.Should().Be(2); // most recent active/approved, not the Failed one

            (await processor.FindActiveOrApprovedBySourceUrl("missing")).Should().BeNull();
        }
    }
}
