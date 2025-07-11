using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using Microsoft.EntityFrameworkCore;

namespace SorobanSecurityPortalApi.Data.Processors;

public class ClientSsoProcessor : IClientSsoProcessor
{
    private readonly Db _db;

    public ClientSsoProcessor(Db db)
    {
        _db = db;
    }

    public async Task<ClientSsoModel?> Get(int clientSsoId)
    {
        return await _db.ClientSso.AsNoTracking().FirstOrDefaultAsync(e => e.ClientSsoId == clientSsoId);
    }

    public async Task<List<ClientSsoModel>> List()
    {
        return await _db.ClientSso.AsNoTracking().ToListAsync();
    }

    public async Task Delete(int clientSsoId)
    {
        var clientSso = await _db.ClientSso.FirstOrDefaultAsync(item => item.ClientSsoId == clientSsoId);
        if (clientSso == null) return;
        _db.ClientSso.Remove(clientSso);
        await _db.SaveChangesAsync();
    }

    public async Task<ClientSsoModel> Add(ClientSsoModel clientSsoModel)
    {
        if (clientSsoModel.ClientSsoId != 0) throw new ArgumentException("Sso Client identifier must be zero");

        await _db.ClientSso.AddAsync(clientSsoModel);
        await _db.SaveChangesAsync();

        return clientSsoModel;
    }

    public async Task<ClientSsoModel> Update(ClientSsoModel clientSsoModel)
    {
        if (clientSsoModel.ClientSsoId == 0) throw new ArgumentException("Sso Client identifier mustn't be zero");

        var existingClientSso = await _db.ClientSso.FirstAsync(item => item.ClientSsoId == clientSsoModel.ClientSsoId);

        _db.Entry(existingClientSso).CurrentValues.SetValues(clientSsoModel);

        _db.ClientSso.Update(existingClientSso);
        await _db.SaveChangesAsync();
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