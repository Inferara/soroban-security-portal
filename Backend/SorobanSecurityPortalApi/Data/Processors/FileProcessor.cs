using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using Microsoft.EntityFrameworkCore;
using static SorobanSecurityPortalApi.Common.ExceptionHandlingMiddleware;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class FileProcessor : IFileProcessor
    {
        private readonly Db _db;

        public FileProcessor(Db db)
        {
            _db = db;
        }

        public async Task<FileModel> Add(FileModel fileModel)
        {
            if (fileModel == null)
                throw new ArgumentNullException(nameof(fileModel));
            fileModel.Date = DateTime.UtcNow;
            _db.File.Add(fileModel);
            await _db.SaveChangesAsync();
            return fileModel;
        }

        public async Task<FileModel> Get(int fileId)
        {
            var file = await _db.File.AsNoTracking().FirstOrDefaultAsync(item => item.Id == fileId);
            if (file == null)
                throw new SorobanSecurityPortalUiException($"File with ID {fileId} not found.");
            if (file.BinFile == null)
                file.BinFile = Array.Empty<byte>();
            return file;
        }
        public async Task<FileModel> Get(string containerGuid, string fileName)
        {
            var file = await _db.File.AsNoTracking().FirstOrDefaultAsync(item => item.ContainerGuid.ToLower() == containerGuid.ToLower() && item.Name.ToLower() == fileName.ToLower());
            if (file == null)
                throw new SorobanSecurityPortalUiException($"File '{fileName}' not found in container '{containerGuid}'.");
            if (file.BinFile == null)
                file.BinFile = Array.Empty<byte>();
            return file;
        }

        public async Task Remove(int fileId)
        {
            var existing = await _db.File.FirstAsync(item => item.Id == fileId);
            if (existing == null)
                return;
            _db.File.Remove(existing);
            await _db.SaveChangesAsync();
        }

        public async Task Remove(string containerGuid, string fileName)
        {
            var existing = await _db.File.FirstOrDefaultAsync(item => item.ContainerGuid.ToLower() == containerGuid.ToLower() && item.Name.ToLower() == fileName.ToLower());
            if (existing == null)
                return;
            _db.File.Remove(existing);
            await _db.SaveChangesAsync();
        }

        public async Task<List<FileModel>> List(string containerGuid)
        {
            return await _db.File
                .AsNoTracking()
                .Select(v => new FileModel
                {
                    Id = v.Id,
                    Name = v.Name,
                    ContainerGuid = v.ContainerGuid,
                    Date = v.Date,
                    Type = v.Type,
                    Author = v.Author,
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