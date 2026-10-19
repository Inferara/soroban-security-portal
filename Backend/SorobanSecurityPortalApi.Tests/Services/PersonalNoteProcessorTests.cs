using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class PersonalNoteProcessorTests
    {
        private readonly List<PersonalNoteModel> _notes = new();
        private readonly List<VulnerabilityModel> _vulnerabilities = new();
        private readonly Mock<DbSet<PersonalNoteModel>> _noteSetMock;
        private readonly Mock<DbSet<VulnerabilityModel>> _vulnerabilitySetMock;
        private readonly Mock<Db> _dbMock;
        private readonly Mock<IDbContextFactory<Db>> _dbFactoryMock = new();
        private readonly PersonalNoteProcessor _processor;

        public PersonalNoteProcessorTests()
        {
            _vulnerabilities.Add(new VulnerabilityModel
            {
                Id = 10,
                Title = "Missing Auth Check",
                Description = "Contract lacks require_auth call.",
                Severity = "High",
                IsDeleted = false
            });
            _vulnerabilities.Add(new VulnerabilityModel
            {
                Id = 20,
                Title = "Integer Overflow",
                Description = "Unchecked arithmetic.",
                Severity = "Critical",
                IsDeleted = false
            });

            _noteSetMock = CreateDbSetMock(_notes);
            _vulnerabilitySetMock = CreateDbSetMock(_vulnerabilities);

            var dbQueryMock = new Mock<IDbQuery>();
            var loggerMock = new Mock<ILogger<Db>>();
            var dataSourceProviderMock = new Mock<IDataSourceProvider>();

            _dbMock = new Mock<Db>(
                dbQueryMock.Object,
                loggerMock.Object,
                dataSourceProviderMock.Object
            ) { CallBase = true };

            _dbMock.Object.PersonalNote = _noteSetMock.Object;
            _dbMock.Object.Vulnerability = _vulnerabilitySetMock.Object;
            _dbMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
            _dbMock.Setup(x => x.DisposeAsync()).Returns(ValueTask.CompletedTask);

            _dbFactoryMock
                .Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(_dbMock.Object);

            _processor = new PersonalNoteProcessor(_dbFactoryMock.Object);
        }

        [Fact]
        public async Task Upsert_Should_CreateNewNote_WhenNoneExistsForUserAndVulnerability()
        {
            var result = await _processor.Upsert(10, loginId: 1, content: "Investigate require_auth");

            _notes.Should().ContainSingle();
            _notes[0].LoginId.Should().Be(1);
            _notes[0].VulnerabilityId.Should().Be(10);
            _notes[0].Content.Should().Be("Investigate require_auth");
            result.Title.Should().Be("Missing Auth Check");
            result.Severity.Should().Be("High");
        }

        [Fact]
        public async Task Upsert_Should_UpdateExistingNote_WhenUserAlreadyHasNoteOnVulnerability()
        {
            _notes.Add(new PersonalNoteModel
            {
                Id = 5,
                LoginId = 1,
                VulnerabilityId = 10,
                Content = "Initial draft",
                CreatedAt = DateTime.UtcNow.AddHours(-1),
                UpdatedAt = DateTime.UtcNow.AddHours(-1)
            });

            var result = await _processor.Upsert(10, loginId: 1, content: "Updated analysis");

            _notes.Should().ContainSingle();
            _notes[0].Content.Should().Be("Updated analysis");
            result.Id.Should().Be(5);
            result.Content.Should().Be("Updated analysis");
        }

        [Fact]
        public async Task Upsert_Should_ThrowKeyNotFound_WhenVulnerabilityDoesNotExist()
        {
            await Assert.ThrowsAsync<KeyNotFoundException>(
                () => _processor.Upsert(999, loginId: 1, content: "Orphan note"));

            _notes.Should().BeEmpty();
        }

        [Fact]
        public async Task GetByVulnerability_Should_EnforceUserIsolation()
        {
            _notes.Add(new PersonalNoteModel
            {
                Id = 1,
                LoginId = 100,
                VulnerabilityId = 10,
                Content = "User 100 secret note"
            });

            var otherUserView = await _processor.GetByVulnerability(10, loginId: 200);
            var ownerView = await _processor.GetByVulnerability(10, loginId: 100);

            otherUserView.Should().BeNull();
            ownerView.Should().NotBeNull();
            ownerView!.Content.Should().Be("User 100 secret note");
        }

        [Fact]
        public async Task List_Should_ReturnOnlyCurrentUsersNotes_OrderedByUpdatedAtDesc()
        {
            _notes.Add(new PersonalNoteModel
            {
                Id = 1,
                LoginId = 100,
                VulnerabilityId = 10,
                Content = "Older note",
                UpdatedAt = DateTime.UtcNow.AddMinutes(-10)
            });
            _notes.Add(new PersonalNoteModel
            {
                Id = 2,
                LoginId = 100,
                VulnerabilityId = 20,
                Content = "Newer note",
                UpdatedAt = DateTime.UtcNow
            });
            _notes.Add(new PersonalNoteModel
            {
                Id = 3,
                LoginId = 200,
                VulnerabilityId = 10,
                Content = "Another user's note",
                UpdatedAt = DateTime.UtcNow.AddMinutes(5)
            });

            var result = await _processor.List(loginId: 100);

            result.Should().HaveCount(2);
            result[0].Id.Should().Be(2);
            result[0].Title.Should().Be("Integer Overflow");
            result[1].Id.Should().Be(1);
            result[1].Title.Should().Be("Missing Auth Check");
        }

        [Fact]
        public async Task Delete_Should_ThrowKeyNotFound_WhenNoteBelongsToDifferentUser()
        {
            _notes.Add(new PersonalNoteModel
            {
                Id = 7,
                LoginId = 100,
                VulnerabilityId = 10,
                Content = "User 100 note"
            });

            await Assert.ThrowsAsync<KeyNotFoundException>(() => _processor.Delete(7, loginId: 200));
            _notes.Should().ContainSingle();
        }

        [Fact]
        public async Task Delete_Should_RemoveNote_WhenOwnedByUser()
        {
            var note = new PersonalNoteModel
            {
                Id = 7,
                LoginId = 100,
                VulnerabilityId = 10,
                Content = "User 100 note"
            };
            _notes.Add(note);

            await _processor.Delete(7, loginId: 100);

            _notes.Should().BeEmpty();
        }

        private static Mock<DbSet<T>> CreateDbSetMock<T>(List<T> sourceList) where T : class
        {
            var queryable = sourceList.AsQueryable();
            var dbSetMock = new Mock<DbSet<T>>();

            dbSetMock.As<IQueryable<T>>().Setup(m => m.Provider).Returns(new TestAsyncQueryProvider<T>(queryable.Provider));
            dbSetMock.As<IQueryable<T>>().Setup(m => m.Expression).Returns(queryable.Expression);
            dbSetMock.As<IQueryable<T>>().Setup(m => m.ElementType).Returns(queryable.ElementType);
            dbSetMock.As<IQueryable<T>>().Setup(m => m.GetEnumerator()).Returns(() => queryable.GetEnumerator());
            dbSetMock.As<IAsyncEnumerable<T>>().Setup(m => m.GetAsyncEnumerator(It.IsAny<CancellationToken>()))
                .Returns(() => new TestAsyncEnumerator<T>(queryable.GetEnumerator()));

            dbSetMock.Setup(d => d.Add(It.IsAny<T>())).Callback<T>(sourceList.Add);
            dbSetMock.Setup(d => d.Remove(It.IsAny<T>())).Callback<T>(item => sourceList.Remove(item));

            return dbSetMock;
        }
    }
}
