using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using Microsoft.EntityFrameworkCore;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class LoginHistoryProcessor : ILoginHistoryProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public LoginHistoryProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public LoginHistoryModel Add(LoginHistoryModel loginHistory)
        {
            using var db = _dbFactory.CreateDbContext();
            db.LoginHistory.Add(loginHistory);
            db.SaveChanges();
            return loginHistory;
        }

        public LoginHistoryModel? GetByRefreshToken(string refreshToken)
        {
            using var db = _dbFactory.CreateDbContext();
            if (string.IsNullOrEmpty(refreshToken))
                return null;
            var result = db.LoginHistory.AsNoTracking().FirstOrDefault(item => item.RefreshToken == refreshToken);
            if (result == null || result.ValidUntilTime < DateTime.UtcNow)
                return null;
            return result;
        }

        public LoginHistoryModel? GetByCode(string code)
        {
            using var db = _dbFactory.CreateDbContext();
            if (string.IsNullOrEmpty(code))
                return null;
            var result = db.LoginHistory.AsNoTracking().FirstOrDefault(item => item.Code == code);
            if (result == null || result.ValidUntilTime < DateTime.UtcNow)
                return null;
            return result;
        }

        public LoginHistoryModel? GetBySessionId(int sessionId)
        {
            using var db = _dbFactory.CreateDbContext();
            var result = db.LoginHistory.AsNoTracking().FirstOrDefault(item => item.LoginHistoryId == sessionId);
            if (result == null || result.ValidUntilTime < DateTime.UtcNow)
                return null;
            return result;
        }

        public void Update(LoginHistoryModel loginHistory)
        {
            using var db = _dbFactory.CreateDbContext();
            var existingLoginHistory = db.LoginHistory.FirstOrDefault(item => item.LoginHistoryId == loginHistory.LoginHistoryId);
            if (existingLoginHistory == null)
                return;
            db.Entry(existingLoginHistory).CurrentValues.SetValues(loginHistory);
            db.LoginHistory.Update(existingLoginHistory);
            db.SaveChanges();
        }
    }

    public interface ILoginHistoryProcessor
    {
        LoginHistoryModel Add(LoginHistoryModel loginHistory);
        LoginHistoryModel? GetByRefreshToken(string refreshToken);
        LoginHistoryModel? GetByCode(string code);
        LoginHistoryModel? GetBySessionId(int sessionId);
        void Update(LoginHistoryModel login);
    }
}