using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using Microsoft.EntityFrameworkCore;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class LoginHistoryProcessor : ILoginHistoryProcessor
    {
        private readonly IDbQuery _dbQuery;
        private readonly Db _db;

        public LoginHistoryProcessor(Db db, IDbQuery dbQuery)
        {
            _dbQuery = dbQuery;
            _db = db;
        }

        public LoginHistoryModel Add(LoginHistoryModel loginHistory)
        {
            _db.LoginHistory.Add(loginHistory);
            _db.SaveChanges();
            return loginHistory;
        }

        public LoginHistoryModel? GetByRefreshToken(string refreshToken)
        {
            if (string.IsNullOrEmpty(refreshToken))
                return null;
            var result = _db.LoginHistory.AsNoTracking().FirstOrDefault(item => item.RefreshToken == refreshToken);
            if (result == null || result.ValidUntilTime < DateTime.UtcNow)
                return null;
            return result;
        }

        public LoginHistoryModel? GetByCode(string code)
        {
            if (string.IsNullOrEmpty(code))
                return null;
            var result = _db.LoginHistory.AsNoTracking().FirstOrDefault(item => item.Code == code);
            if (result == null || result.ValidUntilTime < DateTime.UtcNow)
                return null;
            return result;
        }

        public LoginHistoryModel? GetBySessionId(int sessionId)
        {
            var result = _db.LoginHistory.AsNoTracking().FirstOrDefault(item => item.LoginHistoryId == sessionId);
            if (result == null || result.ValidUntilTime < DateTime.UtcNow)
                return null;
            return result;
        }

        public void Update(LoginHistoryModel loginHistory)
        {
            var existingLoginHistory = _db.LoginHistory.FirstOrDefault(item => item.LoginHistoryId == loginHistory.LoginHistoryId);
            if (existingLoginHistory == null)
                return;
            _db.Entry(existingLoginHistory).CurrentValues.SetValues(loginHistory);
            _db.LoginHistory.Update(existingLoginHistory);
            _db.SaveChanges();
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