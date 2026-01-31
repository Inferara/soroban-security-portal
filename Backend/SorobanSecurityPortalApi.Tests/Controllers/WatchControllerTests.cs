using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using SorobanSecurityPortalApi.Controllers;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Common.Data;

namespace SorobanSecurityPortalApi.Tests.Controllers
{
    public class WatchControllerTests
    {
        private WatchController GetController(DbContextOptions<Db> options)
        {
            var db = new Db(options, null, null);
            db.Database.EnsureCreated();
            return new WatchController(db);
        }

        [Fact]
        public async Task Watch_AddsNewWatch()
        {
            var options = new DbContextOptionsBuilder<Db>()
                .UseInMemoryDatabase(databaseName: "Watch_AddsNewWatch")
                .Options;
            var controller = GetController(options);
            var dto = new WatchController.WatchDto { UserId = 1, EntityId = 2, EntityType = "Protocol" };

            var result = await controller.Watch(dto);
            Assert.IsType<OkResult>(result);
        }

        [Fact]
        public async Task Watch_DuplicateReturnsBadRequest()
        {
            var options = new DbContextOptionsBuilder<Db>()
                .UseInMemoryDatabase(databaseName: "Watch_Duplicate")
                .Options;
            var controller = GetController(options);
            var dto = new WatchController.WatchDto { UserId = 1, EntityId = 2, EntityType = "Protocol" };
            await controller.Watch(dto);
            var result = await controller.Watch(dto);
            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task Unwatch_RemovesWatch()
        {
            var options = new DbContextOptionsBuilder<Db>()
                .UseInMemoryDatabase(databaseName: "Unwatch_RemovesWatch")
                .Options;
            var controller = GetController(options);
            var dto = new WatchController.WatchDto { UserId = 1, EntityId = 2, EntityType = "Protocol" };
            await controller.Watch(dto);
            var result = await controller.Unwatch(dto);
            Assert.IsType<OkResult>(result);
        }

        [Fact]
        public async Task Unwatch_NonexistentReturnsNotFound()
        {
            var options = new DbContextOptionsBuilder<Db>()
                .UseInMemoryDatabase(databaseName: "Unwatch_Nonexistent")
                .Options;
            var controller = GetController(options);
            var dto = new WatchController.WatchDto { UserId = 1, EntityId = 2, EntityType = "Protocol" };
            var result = await controller.Unwatch(dto);
            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task GetWatchCount_ReturnsCorrectCount()
        {
            var options = new DbContextOptionsBuilder<Db>()
                .UseInMemoryDatabase(databaseName: "GetWatchCount")
                .Options;
            var controller = GetController(options);
            var dto = new WatchController.WatchDto { UserId = 1, EntityId = 2, EntityType = "Protocol" };
            await controller.Watch(dto);
            var result = await controller.GetWatchCount(2, "Protocol") as OkObjectResult;
            Assert.NotNull(result);
            Assert.Equal(1, result.Value);
        }

        [Fact]
        public async Task GetWatchedEntities_ReturnsWatchedList()
        {
            var options = new DbContextOptionsBuilder<Db>()
                .UseInMemoryDatabase(databaseName: "GetWatchedEntities")
                .Options;
            var controller = GetController(options);
            var dto = new WatchController.WatchDto { UserId = 1, EntityId = 2, EntityType = "Protocol" };
            await controller.Watch(dto);
            var result = await controller.GetWatchedEntities(1) as OkObjectResult;
            Assert.NotNull(result);
            var list = Assert.IsType<List<WatchModel>>(result.Value);
            Assert.Single(list);
            Assert.Equal(2, list[0].EntityId);
        }
    }
}
