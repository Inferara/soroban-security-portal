using SorobanSecurityPortalApi.Services.ControllersServices;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Authorization.Attributes;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("")]
    public class FileController : ControllerBase
    {
        private readonly IFileService _fileService;

        public FileController(IFileService fileService)
        {
            _fileService = fileService;
        }

        [HttpGet("file/{containerGuid}/{fileName}")]
        public async Task<IActionResult> Get(string containerGuid, string fileName)
        {
            var result = await _fileService.Get(containerGuid, fileName);
            if (result?.BinFile == null || result.BinFile.Length == 0)
            {
                return BadRequest("File not found.");
            }
            return File(result.BinFile, result.Type, result.Name);
        }

        [HttpGet("api/v1/file/{containerGuid}")]
        public async Task<IActionResult> List(string containerGuid)
        {
            var result = await _fileService.List(containerGuid);
            return Ok(result);
        }
        
        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpDelete("api/v1/file/{containerGuid}/{fileName}")]
        public async Task<IActionResult> Remove(string containerGuid, string fileName)
        {
            await _fileService.Remove(containerGuid, fileName);
            return Ok("removed");
        }

    }
}
