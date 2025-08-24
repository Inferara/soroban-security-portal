using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class ProtocolProcessor : IProtocolProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public ProtocolProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<ProtocolModel> Add(ProtocolModel protocolModel)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            if (protocolModel == null)
            {
                throw new ArgumentNullException(nameof(protocolModel), "Protocol model cannot be null");
            }
            protocolModel.Date = DateTime.UtcNow;
            db.Protocol.Add(protocolModel);
            await db.SaveChangesAsync();
            return protocolModel;
        }

        public async Task<ProtocolModel> Update(ProtocolModel protocolModel)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            if (protocolModel == null)
            {
                throw new ArgumentNullException(nameof(protocolModel), "Protocol model cannot be null");
            }
            var existingProtocol = await db.Protocol.FindAsync(protocolModel.Id);
            if (existingProtocol == null)
            {
                throw new KeyNotFoundException($"Protocol with ID {protocolModel.Id} not found");
            }


            existingProtocol.Name = protocolModel.Name;
            existingProtocol.CompanyId = protocolModel.CompanyId;
            existingProtocol.Url = protocolModel.Url;
            await db.SaveChangesAsync();
            return existingProtocol;
        }

        public async Task Delete(int protocolModelId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var protocol = await db.Protocol.FindAsync(protocolModelId);
            if (protocol == null)
            {
                throw new KeyNotFoundException($"Protocol with ID {protocolModelId} not found");
            }
            db.Protocol.Remove(protocol);
            await db.SaveChangesAsync();
        }

        public async Task<List<ProtocolModel>> List()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Protocol
                .AsNoTracking()
                .OrderByDescending(x => x.Id)
                .ToListAsync();
        }
    }

    public interface IProtocolProcessor
    {
        Task<ProtocolModel> Add(ProtocolModel protocolModel);
        Task<ProtocolModel> Update(ProtocolModel protocolModel);
        Task Delete(int protocolModelId);
        Task<List<ProtocolModel>> List();
    }
}