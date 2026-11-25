using System;
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
    public class ReportProcessorSearchSortingTests
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
            return m;
        }

        private static ReportProcessor BuildProcessor(List<ReportModel> list)
        {
            var dbMock = new Mock<Db>(
                new Mock<IDbQuery>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<Db>>().Object,
                new Mock<IDataSourceProvider>().Object) { CallBase = true };
            dbMock.Setup(d => d.Report).Returns(CreateDbSetMock(list).Object);

            var factory = new Mock<IDbContextFactory<Db>>();
            factory.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(dbMock.Object);
            // Search without text/embedding never touches ExtendedConfig.
            return new ReportProcessor(factory.Object, null!);
        }

        // Id, Date and Name deliberately run in different orders, and the input
        // list is shuffled: a test can only pass if the requested field is
        // really the one being sorted. (Previously all three fields ascended
        // together, so sorting by Id would have passed every test.)
        // Date asc -> Ids 2, 3, 1; Date desc -> 1, 3, 2;
        // Name asc -> Alpha(3), Bravo(1), Charlie(2); Id desc -> 3, 2, 1.
        private static List<ReportModel> ThreeApprovedReports() => new()
        {
            new() { Id = 3, Name = "Alpha", Date = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc), Status = ReportModelStatus.Approved },
            new() { Id = 1, Name = "Bravo", Date = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc), Status = ReportModelStatus.Approved },
            new() { Id = 2, Name = "Charlie", Date = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), Status = ReportModelStatus.Approved },
        };

        // sortBy "Date", "DATE" and "date" must all sort by date.
        [Theory]
        [InlineData("Date")]
        [InlineData("DATE")]
        [InlineData("date")]
        public async Task Search_SortBy_Date_Is_CaseInsensitive(string sortBy)
        {
            var found = await BuildProcessor(ThreeApprovedReports())
                .Search(new ReportSearchModel { SortBy = sortBy, SortDirection = "asc" });

            found.Select(r => r.Id).Should().Equal(2, 3, 1);
        }

        // sortDirection "ASC" and "asc" must both sort ascending; "DESC"/"desc" descending.
        [Theory]
        [InlineData("ASC", new[] { 2, 3, 1 })]
        [InlineData("asc", new[] { 2, 3, 1 })]
        [InlineData("DESC", new[] { 1, 3, 2 })]
        [InlineData("desc", new[] { 1, 3, 2 })]
        public async Task Search_SortDirection_Is_CaseInsensitive(string direction, int[] expectedIds)
        {
            var found = await BuildProcessor(ThreeApprovedReports())
                .Search(new ReportSearchModel { SortBy = "date", SortDirection = direction });

            found.Select(r => r.Id).Should().Equal(expectedIds);
        }

        // sortBy "name" (any case) sorts by name.
        [Theory]
        [InlineData("name")]
        [InlineData("Name")]
        [InlineData("NAME")]
        public async Task Search_SortBy_Name_Is_CaseInsensitive(string sortBy)
        {
            var found = await BuildProcessor(ThreeApprovedReports())
                .Search(new ReportSearchModel { SortBy = sortBy, SortDirection = "asc" });

            found.Select(r => r.Name).Should().Equal("Alpha", "Bravo", "Charlie");
        }

        // An unknown sortBy must return results in the default order, not throw (no 500).
        [Fact]
        public async Task Search_Unknown_SortBy_FallsBack_To_NewestFirst()
        {
            var found = await BuildProcessor(ThreeApprovedReports())
                .Search(new ReportSearchModel { SortBy = "anything" });

            found.Select(r => r.Id).Should().Equal(3, 2, 1);
        }

        // No text and no sortBy: newest-first by id (previously undefined order).
        [Fact]
        public async Task Search_NoText_NoSortBy_Returns_NewestFirst()
        {
            var found = await BuildProcessor(ThreeApprovedReports())
                .Search(new ReportSearchModel());

            found.Select(r => r.Id).Should().Equal(3, 2, 1);
        }

        // Null search model: newest-first by id (existing behaviour, must not change).
        [Fact]
        public async Task Search_Null_Search_Returns_NewestFirst()
        {
            var found = await BuildProcessor(ThreeApprovedReports()).Search(null);

            found.Select(r => r.Id).Should().Equal(3, 2, 1);
        }

        // Regression (negative control): the known-good lowercase inputs keep the exact
        // ordering they had before the fix.
        [Fact]
        public async Task Search_Lowercase_Date_Desc_Sorts_By_Date_Descending()
        {
            var found = await BuildProcessor(ThreeApprovedReports())
                .Search(new ReportSearchModel { SortBy = "date", SortDirection = "desc" });

            found.Select(r => r.Id).Should().Equal(1, 3, 2);
        }
    }
}
