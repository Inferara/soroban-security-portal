using SorobanSecurityPortalApi.Services.ControllersServices;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Authorization.Attributes;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/auditors")]
    public class AuditorController : ControllerBase
    {
        private readonly IAuditorService _auditorService;

        public AuditorController(IAuditorService auditorService)
        {
            _auditorService = auditorService;
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPost]
        public async Task<IActionResult> Add(AuditorViewModel auditorViewModel)
        {
            var result = await _auditorService.Add(auditorViewModel);
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPut]
        public async Task<IActionResult> Update(AuditorViewModel auditorViewModel)
        {
            var result = await _auditorService.Update(auditorViewModel);
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            await _auditorService.Delete(id);
            return Ok();
        }

        [HttpGet]
        public async Task<IActionResult> List()
        {
            var result = await _auditorService.List();
            return Ok(result);
        }

        [HttpGet]
        [Route("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var auditors = await _auditorService.List();
            var auditor = auditors.FirstOrDefault(a => a.Id == id);
            if (auditor == null)
            {
                return NotFound($"Auditor with ID {id} not found.");
            }
            return Ok(auditor);
        }

        [HttpGet("statistics/changes")]
        public async Task<IActionResult> GetStatisticsChanges()
        {
            var result = await _auditorService.GetStatisticsChanges();
            return Ok(result);
        }
    }
}
