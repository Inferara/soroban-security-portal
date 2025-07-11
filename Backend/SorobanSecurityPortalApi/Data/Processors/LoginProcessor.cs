using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Common.Extensions;
using SorobanSecurityPortalApi.Models.DbModels;
using Microsoft.EntityFrameworkCore;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class LoginProcessor : ILoginProcessor
    {
        private readonly IDbQuery _dbQuery;
        private readonly Db _db;

        public LoginProcessor(Db db, IDbQuery dbQuery)
        {
            _dbQuery = dbQuery;
            _db = db;
        }

        public async Task<LoginModel?> GetByCredentials(string login, string password)
        {
            var loginModel = await _db.Login.AsNoTracking()
                .FirstOrDefaultAsync(item => item.Login == login && item.LoginType == LoginTypeEnum.Password);
            return loginModel == null || !loginModel.IsEnabled || loginModel.PasswordHash != password.GetHash()
                ? null
                : loginModel;
        }

        public async Task<List<LoginModel>> List()
        {
            return await _db.Login.AsNoTracking().ToListAsync();
        }

        public async Task<LoginModel?> GetById(int id)
        {
            var login = await _db.Login.AsNoTracking()
                .FirstOrDefaultAsync(item => item.LoginId == id);
            return login;
        }

        public async Task<LoginModel?> GetByLogin(string login, LoginTypeEnum loginType)
        {
            return await _db.Login.AsNoTracking()
                .FirstOrDefaultAsync(item => item.Login == login && item.LoginType == loginType);
        }

        public async Task Update(LoginModel loginModel)
        {
            var existingLogin = await _db.Login
                .FirstOrDefaultAsync(item => item.Login == loginModel.Login && loginModel.LoginType == item.LoginType);

            if (existingLogin == null)
                return;

            _db.Entry(existingLogin).CurrentValues.SetValues(loginModel);

            _db.Login.Update(existingLogin);
            await _db.SaveChangesAsync();
        }

        public async Task Delete(int id)
        {
            var login = await _db.Login.FirstOrDefaultAsync(item => item.LoginId == id);
            if (login == null) return;
            _db.Login.Remove(login);
            await _db.SaveChangesAsync();
        }

        public async Task<LoginModel> Add(LoginModel loginModel)
        {
            var existingLogin = await _db.Login
                .FirstOrDefaultAsync(item => item.Login == loginModel.Login && loginModel.LoginType == item.LoginType);

            if (existingLogin != null) return existingLogin;

            await _db.Login.AddAsync(loginModel);
            await _db.SaveChangesAsync();
            return loginModel;
        }
    }

    public interface ILoginProcessor
    {
        Task<LoginModel?> GetByCredentials(string login, string password);
        Task<List<LoginModel>> List();
        Task<LoginModel?> GetById(int id);
        Task<LoginModel?> GetByLogin(string login, LoginTypeEnum loginType);
        Task Update(LoginModel login);
        Task Delete(int id);
        Task<LoginModel> Add(LoginModel login);
    }
}