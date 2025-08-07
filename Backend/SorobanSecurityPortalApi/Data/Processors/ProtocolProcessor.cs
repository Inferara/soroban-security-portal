using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class ProtocolProcessor : IProtocolProcessor
    {
        private readonly Db _db;

        public ProtocolProcessor(Db db)
        {
            _db = db;
        }

        public async Task<ProtocolModel> Add(ProtocolModel protocolModel)
        {
            if (protocolModel == null)
            {
                throw new ArgumentNullException(nameof(protocolModel), "Protocol model cannot be null");
            }
            protocolModel.Date = DateTime.UtcNow;
            _db.Protocol.Add(protocolModel);
            await _db.SaveChangesAsync();
            return protocolModel;
        }

        public async Task<ProtocolModel> Update(ProtocolModel protocolModel)
        {
            if (protocolModel == null)
            {
                throw new ArgumentNullException(nameof(protocolModel), "Protocol model cannot be null");
            }
            var existingProtocol = await _db.Protocol.FindAsync(protocolModel.Id);
            if (existingProtocol == null)
            {
                throw new KeyNotFoundException($"Protocol with ID {protocolModel.Id} not found");
            }
            existingProtocol.Name = protocolModel.Name;
            existingProtocol.CompanyId = protocolModel.CompanyId;
            existingProtocol.Url = protocolModel.Url;
            await _db.SaveChangesAsync();
            return existingProtocol;
        }

        public async Task Delete(int protocolModelId)
        {
            var protocol = await _db.Protocol.FindAsync(protocolModelId);
            if (protocol == null)
            {
                throw new KeyNotFoundException($"Protocol with ID {protocolModelId} not found");
            }
            _db.Protocol.Remove(protocol);
            await _db.SaveChangesAsync();
        }

        public async Task<List<ProtocolModel>> List()
        {
            return await _db.Protocol.OrderByDescending(x => x.Id).ToListAsync();
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