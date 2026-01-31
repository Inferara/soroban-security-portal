using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Xunit;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Moq;
using AutoMapper;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class NotificationIntegrationTests
    {
        [Fact]
        public async Task AddingAuditor_CreatesNotificationsForWatchers()
        {
            var options = new DbContextOptionsBuilder<Db>()
                .UseInMemoryDatabase(databaseName: "Notification_Auditor")
                .Options;
            using (var db = new Db(options, null, null))
            {
                db.Watch.Add(new WatchModel { UserId = 1, EntityId = 10, EntityType = "Auditor" });
                db.SaveChanges();
            }

            var auditorModel = new AuditorModel { Id = 10, Name = "Test Auditor" };
            var mockMapper = new Mock<IMapper>();
            mockMapper.Setup(m => m.Map<AuditorModel>(It.IsAny<object>())).Returns(auditorModel);
            mockMapper.Setup(m => m.Map<AuditorViewModel>(It.IsAny<object>())).Returns(new AuditorViewModel { Id = 10, Name = "Test Auditor" });
            var mockProcessor = new Mock<IAuditorProcessor>();
            mockProcessor.Setup(p => p.Add(It.IsAny<AuditorModel>())).ReturnsAsync(auditorModel);
            var mockUserContext = new Mock<UserContextAccessor>(null);
            mockUserContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(99);

            var service = new AuditorService(mockMapper.Object, mockProcessor.Object, mockUserContext.Object);
            var viewModel = new AuditorViewModel { Id = 10, Name = "Test Auditor" };
            await service.Add(viewModel);

            using (var db = new Db(options, null, null))
            {
                var notifications = await db.Notification.ToListAsync();
                Assert.Single(notifications);
                Assert.Equal(1, notifications[0].UserId);
                Assert.Contains("Test Auditor", notifications[0].Message);
            }
        }
    }
}
