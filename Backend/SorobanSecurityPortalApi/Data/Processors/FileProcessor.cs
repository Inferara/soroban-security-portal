using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using Microsoft.EntityFrameworkCore;
using static SorobanSecurityPortalApi.Common.ExceptionHandlingMiddleware;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class FileProcessor : IFileProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public FileProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<FileModel> Add(FileModel fileModel)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            if (fileModel == null)
                throw new ArgumentNullException(nameof(fileModel));
            fileModel.Date = DateTime.UtcNow;
            db.File.Add(fileModel);
            await db.SaveChangesAsync();
            return fileModel;
        }

        public async Task<FileModel> Get(int fileId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var file = await db.File.AsNoTracking().FirstOrDefaultAsync(item => item.Id == fileId);
            if (file == null)
                throw new SorobanSecurityPortalUiException($"File with ID {fileId} not found.");
            if (file.BinFile == null)
                file.BinFile = Array.Empty<byte>();
            return file;
        }
        public async Task<FileModel> Get(string containerGuid, string fileName)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var file = await db.File.AsNoTracking().FirstOrDefaultAsync(item => item.ContainerGuid.ToLower() == containerGuid.ToLower() && item.Name.ToLower() == fileName.ToLower());
            if (file == null)
                throw new SorobanSecurityPortalUiException($"File '{fileName}' not found in container '{containerGuid}'.");
            if (file.BinFile == null)
                file.BinFile = Array.Empty<byte>();
            return file;
        }

        public async Task Remove(int fileId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var existing = await db.File.FirstAsync(item => item.Id == fileId);
            if (existing == null)
                return;
            db.File.Remove(existing);
            await db.SaveChangesAsync();
        }

        public async Task Remove(string containerGuid, string fileName)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var existing = await db.File.FirstOrDefaultAsync(item => item.ContainerGuid.ToLower() == containerGuid.ToLower() && item.Name.ToLower() == fileName.ToLower());
            if (existing == null)
                return;
            db.File.Remove(existing);
            await db.SaveChangesAsync();
        }

        public async Task<List<FileModel>> List(string containerGuid)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.File
                .AsNoTracking()
                .Select(v => new FileModel
                {
                    Id = v.Id,
                    Name = v.Name,
                    ContainerGuid = v.ContainerGuid,
                    Date = v.Date,
                    Type = v.Type,
                    CreatedBy = v.CreatedBy,
                })
                .Where(v => v.ContainerGuid.ToLower() == containerGuid.ToLower())
                .OrderByDescending(v => v.Id)
                .ToListAsync();
        }
    }

    public interface IFileProcessor
    {
        Task<FileModel> Add(FileModel fileModel);
        Task<FileModel> Get(int fileId);
        Task<FileModel> Get(string containerGuid, string fileName);
        Task Remove(int fileId);
        Task Remove(string containerGuid, string fileName);
        Task<List<FileModel>> List(string containerGuid);
    }
}