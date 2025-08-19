using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using Microsoft.EntityFrameworkCore;

namespace SorobanSecurityPortalApi.Data.Processors;

public class ClientSsoProcessor : IClientSsoProcessor
{
    private readonly IDbContextFactory<Db> _dbFactory;

    public ClientSsoProcessor(IDbContextFactory<Db> dbFactory)
    {
        _dbFactory = dbFactory;
    }

    public async Task<ClientSsoModel?> Get(int clientSsoId)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        return await db.ClientSso.AsNoTracking().FirstOrDefaultAsync(e => e.ClientSsoId == clientSsoId);
    }

    public async Task<List<ClientSsoModel>> List()
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        return await db.ClientSso.AsNoTracking().ToListAsync();
    }

    public async Task Delete(int clientSsoId)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var clientSso = await db.ClientSso.FirstOrDefaultAsync(item => item.ClientSsoId == clientSsoId);
        if (clientSso == null) return;
        db.ClientSso.Remove(clientSso);
        await db.SaveChangesAsync();
    }

    public async Task<ClientSsoModel> Add(ClientSsoModel clientSsoModel)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        if (clientSsoModel.ClientSsoId != 0) throw new ArgumentException("Sso Client identifier must be zero");

        await db.ClientSso.AddAsync(clientSsoModel);
        await db.SaveChangesAsync();

        return clientSsoModel;
    }

    public async Task<ClientSsoModel> Update(ClientSsoModel clientSsoModel)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        if (clientSsoModel.ClientSsoId == 0) throw new ArgumentException("Sso Client identifier mustn't be zero");

        var existingClientSso = await db.ClientSso.FirstAsync(item => item.ClientSsoId == clientSsoModel.ClientSsoId);

        db.Entry(existingClientSso).CurrentValues.SetValues(clientSsoModel);

        db.ClientSso.Update(existingClientSso);
        await db.SaveChangesAsync();
        return existingClientSso;
    }
}

public interface IClientSsoProcessor
{
    Task<ClientSsoModel?> Get(int clientSsoId);
    Task<List<ClientSsoModel>> List();
    Task Delete(int clientSsoId);
    Task<ClientSsoModel> Add(ClientSsoModel clientSsoModel);
    Task<ClientSsoModel> Update(ClientSsoModel clientSsoModel);
}