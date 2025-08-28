using SorobanSecurityPortalApi.Services.ControllersServices;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Authorization.Attributes;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/protocols")]
    public class ProtocolController : ControllerBase
    {
        private readonly IProtocolService _protocolService;

        public ProtocolController(IProtocolService protocolService)
        {
            _protocolService = protocolService;
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPost]
        public async Task<IActionResult> Add(ProtocolViewModel protocolViewModel)
        {
            var result = await _protocolService.Add(protocolViewModel);
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPut]
        public async Task<IActionResult> Update(ProtocolViewModel protocolViewModel)
        {
            var result = await _protocolService.Update(protocolViewModel);
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin)]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            await _protocolService.Delete(id);
            return Ok();
        }

        [HttpGet]
        public async Task<IActionResult> List()
        {
            var result = await _protocolService.List();
            return Ok(result);
        }

        [HttpGet]
        [Route("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var protocols = await _protocolService.List();
            var protocol = protocols.FirstOrDefault(a => a.Id == id);
            if (protocol == null)
            {
                return NotFound($"Protocol with ID {id} not found.");
            }
            return Ok(protocol);
        }

        [HttpGet("statistics/changes")]
        public async Task<IActionResult> GetStatisticsChanges()
        {
            var result = await _protocolService.GetStatisticsChanges();
            return Ok(result);
        }
    }
}
