using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using SorobanSecurityPortalApi.Controllers;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Controllers
{
    public class PersonalNoteControllerTests
    {
        private readonly Mock<IPersonalNoteService> _serviceMock = new();
        private readonly PersonalNoteController _controller;

        public PersonalNoteControllerTests()
        {
            _controller = new PersonalNoteController(_serviceMock.Object);
        }

        [Fact]
        public async Task List_Should_ReturnOk_WithUserNotes()
        {
            var notes = new List<PersonalNoteViewModel>
            {
                new() { Id = 1, VulnerabilityId = 10, Content = "Check reentrancy guard", Title = "Reentrancy" }
            };
            _serviceMock.Setup(s => s.List()).ReturnsAsync(notes);

            var result = await _controller.List();

            var ok = result.Should().BeOfType<OkObjectResult>().Subject;
            ok.Value.Should().BeEquivalentTo(notes);
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-5)]
        public async Task GetByVulnerability_Should_ReturnBadRequest_WhenVulnerabilityIdInvalid(int badId)
        {
            var result = await _controller.GetByVulnerability(badId);

            result.Should().BeOfType<BadRequestObjectResult>();
            _serviceMock.Verify(s => s.GetByVulnerability(It.IsAny<int>()), Times.Never);
        }

        [Fact]
        public async Task GetByVulnerability_Should_ReturnNoContent_WhenNotFound()
        {
            _serviceMock.Setup(s => s.GetByVulnerability(42)).ReturnsAsync((PersonalNoteViewModel?)null);

            var result = await _controller.GetByVulnerability(42);

            result.Should().BeOfType<NoContentResult>();
        }

        [Fact]
        public async Task GetByVulnerability_Should_ReturnOk_WhenNoteExists()
        {
            var note = new PersonalNoteViewModel { Id = 7, VulnerabilityId = 42, Content = "Verify overflow" };
            _serviceMock.Setup(s => s.GetByVulnerability(42)).ReturnsAsync(note);

            var result = await _controller.GetByVulnerability(42);

            var ok = result.Should().BeOfType<OkObjectResult>().Subject;
            ok.Value.Should().BeEquivalentTo(note);
        }

        [Fact]
        public async Task Save_Should_ReturnBadRequest_WhenVulnerabilityIdInvalid()
        {
            var result = await _controller.Save(0, new UpsertPersonalNoteRequest { Content = "valid note" });

            result.Should().BeOfType<BadRequestObjectResult>();
            _serviceMock.Verify(s => s.Save(It.IsAny<int>(), It.IsAny<string>()), Times.Never);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public async Task Save_Should_ReturnBadRequest_WhenContentBlank(string blank)
        {
            var result = await _controller.Save(1, new UpsertPersonalNoteRequest { Content = blank });

            result.Should().BeOfType<BadRequestObjectResult>();
            _serviceMock.Verify(s => s.Save(It.IsAny<int>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Save_Should_ReturnBadRequest_WhenContentExceedsMaxLength()
        {
            var oversized = new string('a', PersonalNoteService.MaxNoteLength + 1);
            var result = await _controller.Save(1, new UpsertPersonalNoteRequest { Content = oversized });

            result.Should().BeOfType<BadRequestObjectResult>();
            _serviceMock.Verify(s => s.Save(It.IsAny<int>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Save_Should_ReturnNotFound_WhenVulnerabilityMissing()
        {
            _serviceMock
                .Setup(s => s.Save(999, "Note"))
                .ThrowsAsync(new KeyNotFoundException("Vulnerability with ID 999 not found"));

            var result = await _controller.Save(999, new UpsertPersonalNoteRequest { Content = "  Note  " });

            result.Should().BeOfType<NotFoundObjectResult>();
        }

        [Fact]
        public async Task Save_Should_ReturnOk_WhenValid()
        {
            var saved = new PersonalNoteViewModel { Id = 3, VulnerabilityId = 12, Content = "Audit follow-up" };
            _serviceMock.Setup(s => s.Save(12, "Audit follow-up")).ReturnsAsync(saved);

            var result = await _controller.Save(12, new UpsertPersonalNoteRequest { Content = "  Audit follow-up  " });

            var ok = result.Should().BeOfType<OkObjectResult>().Subject;
            ok.Value.Should().BeEquivalentTo(saved);
        }

        [Fact]
        public async Task Delete_Should_ReturnBadRequest_WhenIdInvalid()
        {
            var result = await _controller.Delete(0);

            result.Should().BeOfType<BadRequestObjectResult>();
            _serviceMock.Verify(s => s.Delete(It.IsAny<int>()), Times.Never);
        }

        [Fact]
        public async Task Delete_Should_ReturnNotFound_WhenNoteDoesNotExistOrBelongsToAnotherUser()
        {
            _serviceMock.Setup(s => s.Delete(55)).ThrowsAsync(new KeyNotFoundException("Personal note with ID 55 not found"));

            var result = await _controller.Delete(55);

            result.Should().BeOfType<NotFoundObjectResult>();
        }

        [Fact]
        public async Task Delete_Should_ReturnNoContent_WhenDeleted()
        {
            _serviceMock.Setup(s => s.Delete(5)).Returns(Task.CompletedTask);

            var result = await _controller.Delete(5);

            result.Should().BeOfType<NoContentResult>();
        }

        [Fact]
        public async Task DeleteByVulnerability_Should_ReturnNoContent_WhenDeleted()
        {
            _serviceMock.Setup(s => s.DeleteByVulnerability(15)).Returns(Task.CompletedTask);

            var result = await _controller.DeleteByVulnerability(15);

            result.Should().BeOfType<NoContentResult>();
        }
    }
}
