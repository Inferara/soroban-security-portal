using FluentAssertions;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class PageViewServiceTests
    {
        private readonly Mock<IPageViewProcessor> _proc = new();
        private readonly Mock<IExtendedConfig> _cfg = new();

        public PageViewServiceTests()
        {
            _cfg.SetupGet(c => c.AuthSecurityKey).Returns("test-secret-key-test-secret-key-1234567890");
        }

        private PageViewService Sut() => new(_proc.Object, _cfg.Object);

        [Fact]
        public async Task RecordView_HumanUa_RecordsHumanSource()
        {
            _proc.Setup(p => p.ExistsTodayAsync(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<PageViewSource>()))
                 .ReturnsAsync(false);
            PageViewModel? saved = null;
            _proc.Setup(p => p.AddAsync(It.IsAny<PageViewModel>())).Callback<PageViewModel>(m => saved = m).Returns(Task.CompletedTask);

            await Sut().RecordView(EntityType.Report, 7, "203.0.113.4",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36");

            saved.Should().NotBeNull();
            saved!.Source.Should().Be(PageViewSource.Human);
            saved.EntityType.Should().Be(EntityType.Report);
            saved.EntityId.Should().Be(7);
            saved.VisitorHash.Should().NotBeNullOrWhiteSpace();
            saved.VisitorHash.Should().NotContain("203.0.113.4"); // no raw IP stored
        }

        [Fact]
        public async Task RecordView_BotUa_RecordsCrawlerSource()
        {
            _proc.Setup(p => p.ExistsTodayAsync(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<PageViewSource>()))
                 .ReturnsAsync(false);
            PageViewModel? saved = null;
            _proc.Setup(p => p.AddAsync(It.IsAny<PageViewModel>())).Callback<PageViewModel>(m => saved = m).Returns(Task.CompletedTask);

            await Sut().RecordView(EntityType.Report, 7, "1.2.3.4", "Twitterbot/1.0");

            saved!.Source.Should().Be(PageViewSource.Crawler);
        }

        [Fact]
        public async Task RecordView_ForcedCrawler_OverridesUa()
        {
            _proc.Setup(p => p.ExistsTodayAsync(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<PageViewSource>()))
                 .ReturnsAsync(false);
            PageViewModel? saved = null;
            _proc.Setup(p => p.AddAsync(It.IsAny<PageViewModel>())).Callback<PageViewModel>(m => saved = m).Returns(Task.CompletedTask);

            await Sut().RecordView(EntityType.Vulnerability, 3, "1.2.3.4",
                "Mozilla/5.0 Chrome/120", PageViewSource.Crawler);

            saved!.Source.Should().Be(PageViewSource.Crawler);
        }

        [Fact]
        public async Task RecordView_Duplicate_SkipsInsert()
        {
            _proc.Setup(p => p.ExistsTodayAsync(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<PageViewSource>()))
                 .ReturnsAsync(true);

            await Sut().RecordView(EntityType.Report, 7, "1.2.3.4", "Mozilla/5.0 Chrome/120");

            _proc.Verify(p => p.AddAsync(It.IsAny<PageViewModel>()), Times.Never);
        }

        [Fact]
        public async Task RecordView_SameInputs_ProduceSameHash()
        {
            _proc.Setup(p => p.ExistsTodayAsync(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<PageViewSource>()))
                 .ReturnsAsync(false);
            var hashes = new List<string>();
            _proc.Setup(p => p.AddAsync(It.IsAny<PageViewModel>()))
                 .Callback<PageViewModel>(m => hashes.Add(m.VisitorHash)).Returns(Task.CompletedTask);

            await Sut().RecordView(EntityType.Report, 7, "9.9.9.9", "Mozilla/5.0 Chrome/120");
            await Sut().RecordView(EntityType.Report, 7, "9.9.9.9", "Mozilla/5.0 Chrome/120");
            await Sut().RecordView(EntityType.Report, 7, "8.8.8.8", "Mozilla/5.0 Chrome/120");

            hashes.Should().HaveCount(3);
            hashes[0].Should().Be(hashes[1]);          // same ip+ua+day → same hash
            hashes[2].Should().NotBe(hashes[0]);        // different ip → different hash
        }

        [Fact]
        public async Task GetCounts_DelegatesToProcessor()
        {
            _proc.Setup(p => p.GetCountsAsync(EntityType.Auditor, 5))
                 .ReturnsAsync(new PageViewCountViewModel { Total = 12, Unique = 9 });

            var r = await Sut().GetCounts(EntityType.Auditor, 5);

            r.Total.Should().Be(12);
            r.Unique.Should().Be(9);
        }
    }
}
