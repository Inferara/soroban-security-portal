using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using Microsoft.EntityFrameworkCore;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class ConnectionProcessor : IConnectionProcessor
    {
        private readonly Db _db;
        private readonly ExtendedConfig _config;

        public ConnectionProcessor(Db db, ExtendedConfig config)
        {
            _db = db;
            _config = config;
        }

        public async Task<List<ConnectionModel?>> List(int? workspaceId)
        {
            var qry = _db.Connection.OrderBy(item => item.ConnectionId).AsNoTracking();
            if (workspaceId == 0)
            {
                qry = qry.Where(e => e.WorkspaceId == null || e.WorkspaceId == 0);
            }
            else if (workspaceId != null && workspaceId > 0)
            {
                qry = qry.Where(e => e.WorkspaceId == workspaceId);
            }
            var data = await qry.ToListAsync();
            return data;
        }

        public async Task<ConnectionModel> Set(ConnectionModel connectionModel, int? workspaceId)
        {
            ConnectionModel? settingValue;
            if (connectionModel.ConnectionId == 0)
            {
                settingValue = new ConnectionModel
                {
                    CreatedBy = connectionModel.CreatedBy,
                    Created = connectionModel.Created,
                    Name = connectionModel.Name,
                    Type = connectionModel.Type,
                    Content = connectionModel.Content,
                    WorkspaceId = workspaceId == 0 ? null : workspaceId,
                };
                await _db.Connection.AddAsync(settingValue);
            }
            else
            {
                settingValue = await _db.Connection.FirstAsync(item => item.ConnectionId == connectionModel.ConnectionId);
                settingValue.Name = connectionModel.Name;
                settingValue.Content = connectionModel.Content;
                _db.Connection.Update(settingValue);
            }

            await _db.SaveChangesAsync();
            return settingValue;
        }

        public async Task Remove(int connectionId)
        {
            var connection = await _db.Connection
                .FirstOrDefaultAsync(item => item.ConnectionId == connectionId);
            if (connection == null)
                return;
            _db.Connection.Remove(connection);
            await _db.SaveChangesAsync();
        }

        public async Task<ConnectionModel?> GetById(int connectionId)
        {
            return await _db.Connection.AsNoTracking().FirstOrDefaultAsync(t => t.ConnectionId == connectionId);
        }

        public async Task<ConnectionModel?> GetByName(string connectionName, int? workspaceId)
        {
            var qry = _db.Connection.AsNoTracking();
            if (workspaceId == 0)
            {
                qry = qry.Where(e => e.Name == connectionName && (e.WorkspaceId == null || e.WorkspaceId == 0));
            }
            else if (workspaceId != null && workspaceId > 0)
            {
                qry = qry.Where(e => e.Name == connectionName && e.WorkspaceId == workspaceId);
            }
            return await qry.FirstOrDefaultAsync();
        }
    }

    public interface IConnectionProcessor
    {
        Task<List<ConnectionModel?>> List(int? workspaceId);
        Task<ConnectionModel> Set(ConnectionModel connectionModel, int? workspaceId);
        Task Remove(int connectionId);
        Task<ConnectionModel?> GetById(int connectionId);
        Task<ConnectionModel?> GetByName(string connectionName, int? workspaceId);
    }
}
