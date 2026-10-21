using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using SorobanSecurityPortalApi.Common;
using static SorobanSecurityPortalApi.Common.ExceptionHandlingMiddleware;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class PersonalNoteServiceTests
    {
        private readonly Mock<IUserContextAccessor> _userContextMock = new();
        private readonly Mock<IPersonalNoteProcessor> _processorMock = new();
        private readonly PersonalNoteService _service;

        public PersonalNoteServiceTests()
        {
            _service = new PersonalNoteService(_userContextMock.Object, _processorMock.Object);
        }

        [Fact]
        public async Task List_Should_ReturnNotesForAuthenticatedUserOnly()
        {
            _userContextMock.Setup(u => u.GetLoginIdOrNullAsync()).ReturnsAsync(42);
            var expected = new List<PersonalNoteViewModel>
            {
                new() { Id = 1, VulnerabilityId = 100, Content = "User 42 private note", Title = "Vuln 100" }
            };
            _processorMock.Setup(p => p.List(42)).ReturnsAsync(expected);

            var result = await _service.List();

            result.Should().BeEquivalentTo(expected);
            _processorMock.Verify(p => p.List(42), Times.Once);
        }

        [Fact]
        public async Task List_Should_ThrowAuthException_WhenUserNotAuthenticated()
        {
            _userContextMock.Setup(u => u.GetLoginIdOrNullAsync()).ReturnsAsync(0);

            await Assert.ThrowsAsync<SorobanSecurityPortalAuthException>(() => _service.List());
            _processorMock.Verify(p => p.List(It.IsAny<int>()), Times.Never);
        }

        [Fact]
        public async Task List_Should_ThrowAuthException_WhenLoginNoLongerExists()
        {
            // A valid token whose login row was deleted resolves to no login id.
            _userContextMock.Setup(u => u.GetLoginIdOrNullAsync()).ReturnsAsync((int?)null);

            await Assert.ThrowsAsync<SorobanSecurityPortalAuthException>(() => _service.List());
            _processorMock.Verify(p => p.List(It.IsAny<int>()), Times.Never);
        }

        [Fact]
        public async Task GetByVulnerability_Should_ScopeToAuthenticatedUserId()
        {
            _userContextMock.Setup(u => u.GetLoginIdOrNullAsync()).ReturnsAsync(17);
            var note = new PersonalNoteViewModel { Id = 9, VulnerabilityId = 5, Content = "Private analysis" };
            _processorMock.Setup(p => p.GetByVulnerability(5, 17)).ReturnsAsync(note);

            var result = await _service.GetByVulnerability(5);

            result.Should().BeEquivalentTo(note);
            _processorMock.Verify(p => p.GetByVulnerability(5, 17), Times.Once);
        }

        [Fact]
        public async Task Save_Should_TrimContent_And_PassAuthenticatedUserId()
        {
            _userContextMock.Setup(u => u.GetLoginIdOrNullAsync()).ReturnsAsync(25);
            var expected = new PersonalNoteViewModel { Id = 4, VulnerabilityId = 11, Content = "Trimmed content" };
            _processorMock.Setup(p => p.Upsert(11, 25, "Trimmed content")).ReturnsAsync(expected);

            var result = await _service.Save(11, "   Trimmed content   ");

            result.Should().BeEquivalentTo(expected);
            _processorMock.Verify(p => p.Upsert(11, 25, "Trimmed content"), Times.Once);
        }

        [Fact]
        public async Task Save_Should_ThrowArgumentException_WhenContentEmpty()
        {
            _userContextMock.Setup(u => u.GetLoginIdOrNullAsync()).ReturnsAsync(25);

            await Assert.ThrowsAsync<ArgumentException>(() => _service.Save(11, "   "));
            _processorMock.Verify(p => p.Upsert(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Save_Should_ThrowArgumentException_WhenContentTooLong()
        {
            _userContextMock.Setup(u => u.GetLoginIdOrNullAsync()).ReturnsAsync(25);
            var tooLong = new string('x', PersonalNoteService.MaxNoteLength + 1);

            await Assert.ThrowsAsync<ArgumentException>(() => _service.Save(11, tooLong));
            _processorMock.Verify(p => p.Upsert(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Delete_Should_EnforceOwnershipWithAuthenticatedUserId()
        {
            _userContextMock.Setup(u => u.GetLoginIdOrNullAsync()).ReturnsAsync(33);
            _processorMock.Setup(p => p.Delete(8, 33)).Returns(Task.CompletedTask);

            await _service.Delete(8);

            _processorMock.Verify(p => p.Delete(8, 33), Times.Once);
        }

        [Fact]
        public async Task DeleteByVulnerability_Should_EnforceOwnershipWithAuthenticatedUserId()
        {
            _userContextMock.Setup(u => u.GetLoginIdOrNullAsync()).ReturnsAsync(33);
            _processorMock.Setup(p => p.DeleteByVulnerability(19, 33)).Returns(Task.CompletedTask);

            await _service.DeleteByVulnerability(19);

            _processorMock.Verify(p => p.DeleteByVulnerability(19, 33), Times.Once);
        }
    }
}
