using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class FileService : IFileService
    {
        private readonly IMapper _mapper;
        private readonly IFileProcessor _fileProcessor;
        
        public FileService(
            IMapper mapper,
            IFileProcessor fileProcessor)
        {
            _mapper = mapper;
            _fileProcessor = fileProcessor;
        }

        public async Task<FileViewModel?> Get(string containerGuid, string fileName)
        {
            var fileModel = await _fileProcessor.Get(containerGuid, fileName);
            if (fileModel == null)
            {
                return null;
            }
            var fileViewModel = _mapper.Map<FileViewModel>(fileModel);
            return fileViewModel;
        }

        public async Task Remove(string containerGuid, string fileName)
        {
            await _fileProcessor.Remove(containerGuid, fileName);
        }

        public async Task<string[]> List(string containerGuid)
        {
            var files = await _fileProcessor.List(containerGuid);
            return files.Select(f => f.Name).ToArray();
        }
    }

    public interface IFileService
    {
        Task<FileViewModel?> Get(string containerGuid, string fileName);
        Task Remove(string containerGuid, string fileName);
        Task<string[]> List(string containerGuid);
    }
}
