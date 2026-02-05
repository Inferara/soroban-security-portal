using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Xunit;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Common.Data;

namespace SorobanSecurityPortalApi.Tests.Models
{
    public class NotificationModelTests
    {
        [Fact]
        public void CanCreateNotificationModel()
        {
            var notification = new NotificationModel
            {
                UserId = 1,
                Message = "Test message"
            };
            Assert.Equal(1, notification.UserId);
            Assert.Equal("Test message", notification.Message);
            Assert.False(notification.IsRead);
        }
    }

    public class WatchModelTests
    {
        [Fact]
        public void CanCreateWatchModel()
        {
            var watch = new WatchModel
            {
                UserId = 1,
                EntityId = 2,
                EntityType = "Protocol"
            };
            Assert.Equal(1, watch.UserId);
            Assert.Equal(2, watch.EntityId);
            Assert.Equal("Protocol", watch.EntityType);
        }
    }
}
