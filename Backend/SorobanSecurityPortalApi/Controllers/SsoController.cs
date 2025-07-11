using SorobanSecurityPortalApi.Authorization.Attributes;
using SorobanSecurityPortalApi.Common.Extensions;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/v1/sso")]
    public class SsoController : ControllerBase
    {
        private readonly ISsoService _ssoService;
        public SsoController(ISsoService ssoService)           
        {
            _ssoService = ssoService;
        }

        [Authorize]
        [HttpGet("clients/{clientSsoId}")]
        public async Task<IActionResult> GetClient(int clientSsoId)
        {
            var currentUser = this.GetLogin();
            if (currentUser == null) return Unauthorized();

            var client = await _ssoService.GetClientById(clientSsoId);
            return Ok(client);
        }

        [RoleAuthorize(Role.Admin)]
        [HttpGet("clients")]
        public async Task<IActionResult> ListClients()
        {
            var currentUser = this.GetLogin();
            if (currentUser == null) return Unauthorized();

            var clients = await _ssoService.ListClients();
            return Ok(clients);
        }

        [RoleAuthorize(Role.Admin)]
        [HttpDelete("clients/{clientSsoId}")]
        public async Task<IActionResult> DeleteClient(int clientSsoId)
        {
            var currentUser = this.GetLogin();
            if (currentUser == null) return Unauthorized();

            await _ssoService.DeleteClient(clientSsoId);
            return Ok();
        }

        [RoleAuthorize(Role.Admin)]
        [HttpPost("clients")]
        public async Task<IActionResult> AddClient([FromBody] ClientSsoViewModel clientSsoViewModel)
        {
            var currentUser = this.GetLogin();
            if (currentUser == null) return Unauthorized();

            clientSsoViewModel.CreatedBy = currentUser;
            var model = await _ssoService.AddClient(clientSsoViewModel);

            return Ok(model != null);
        }

        [RoleAuthorize(Role.Admin)]
        [HttpPut("clients/{clientSsoId}")]
        public async Task<IActionResult> UpdateClient([FromBody] ClientSsoViewModel clientSsoViewModel)
        {
            var currentUser = this.GetLogin();
            if (currentUser == null) return Unauthorized();

            var model = await _ssoService.UpdateClient(clientSsoViewModel);

            return Ok(model != null);
        }
    }
}
