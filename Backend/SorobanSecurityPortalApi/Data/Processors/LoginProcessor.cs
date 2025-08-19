using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Common.Extensions;
using SorobanSecurityPortalApi.Models.DbModels;
using Microsoft.EntityFrameworkCore;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class LoginProcessor : ILoginProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public LoginProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<LoginModel?> GetByCredentials(string login, string password)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var loginModel = await db.Login.AsNoTracking()
                .FirstOrDefaultAsync(item => item.Login == login && item.LoginType == LoginTypeEnum.Password);
            return loginModel == null || !loginModel.IsEnabled || loginModel.PasswordHash != password.GetHash()
                ? null
                : loginModel;
        }

        public async Task<List<LoginModel>> List()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Login.AsNoTracking().ToListAsync();
        }

        public async Task<LoginModel?> GetById(int id)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var login = await db.Login.AsNoTracking()
                .FirstOrDefaultAsync(item => item.LoginId == id);
            return login;
        }

        public async Task<LoginModel?> GetByLogin(string login, LoginTypeEnum loginType)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Login.AsNoTracking()
                .FirstOrDefaultAsync(item => item.Login == login && item.LoginType == loginType);
        }

        public async Task<LoginModel?> GetByEmail(string email)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Login.AsNoTracking()
                .FirstOrDefaultAsync(item => item.Email == email);
        }

        public async Task Update(LoginModel loginModel)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var existingLogin = await db.Login
                .FirstOrDefaultAsync(item => item.Login == loginModel.Login && loginModel.LoginType == item.LoginType);

            if (existingLogin == null)
                return;

            db.Entry(existingLogin).CurrentValues.SetValues(loginModel);

            db.Login.Update(existingLogin);
            await db.SaveChangesAsync();
        }

        public async Task Delete(int id)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var login = await db.Login.FirstOrDefaultAsync(item => item.LoginId == id);
            if (login == null) return;
            db.Login.Remove(login);
            await db.SaveChangesAsync();
        }

        public async Task<LoginModel> Add(LoginModel loginModel)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var existingLogin = await db.Login
                .FirstOrDefaultAsync(item => item.Login == loginModel.Login && loginModel.LoginType == item.LoginType);

            if (existingLogin != null) return existingLogin;

            await db.Login.AddAsync(loginModel);
            await db.SaveChangesAsync();
            return loginModel;
        }
    }

    public interface ILoginProcessor
    {
        Task<LoginModel?> GetByCredentials(string login, string password);
        Task<List<LoginModel>> List();
        Task<LoginModel?> GetById(int id);
        Task<LoginModel?> GetByLogin(string login, LoginTypeEnum loginType);
        Task<LoginModel?> GetByEmail(string email);
        Task Update(LoginModel login);
        Task Delete(int id);
        Task<LoginModel> Add(LoginModel login);
    }
}