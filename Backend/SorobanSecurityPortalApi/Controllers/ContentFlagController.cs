using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/content-flags")]
    [Authorize]
    public class ContentFlagController : ControllerBase
    {
        private readonly IContentFlagService _service;
        public ContentFlagController(IContentFlagService service) => _service = service;

        [HttpPost]
        public async Task<IActionResult> Flag([FromBody] FlagContentRequest request)
        {
            var result = await _service.Flag(request);
            return result switch
            {
                Result<bool, string>.Ok => Ok(true),
                Result<bool, string>.Err e when e.Error == ContentFlagService.ErrContentNotFound => NotFound(e.Error),
                Result<bool, string>.Err e when e.Error == ContentFlagService.ErrAlreadyFlagged => Conflict(e.Error),
                Result<bool, string>.Err e => BadRequest(e.Error),
                _ => throw new InvalidOperationException("Unexpected result")
            };
        }
    }
}
