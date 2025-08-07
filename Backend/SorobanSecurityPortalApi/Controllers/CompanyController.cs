using SorobanSecurityPortalApi.Services.ControllersServices;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Authorization.Attributes;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/companies")]
    public class CompanyController : ControllerBase
    {
        private readonly ICompanyService _companyService;

        public CompanyController(ICompanyService companyService)
        {
            _companyService = companyService;
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPost]
        public async Task<IActionResult> Add(CompanyViewModel companyViewModel)
        {
            var result = await _companyService.Add(companyViewModel);
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPut]
        public async Task<IActionResult> Update(CompanyViewModel companyViewModel)
        {
            var result = await _companyService.Update(companyViewModel);
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            await _companyService.Delete(id);
            return Ok();
        }

        [HttpGet]
        public async Task<IActionResult> List()
        {
            var result = await _companyService.List();
            return Ok(result);
        }

        [HttpGet]
        [Route("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var companies = await _companyService.List();
            var company = companies.FirstOrDefault(a => a.Id == id);
            if (company == null)
            {
                return NotFound($"Company with ID {id} not found.");
            }
            return Ok(company);
        }
    }
}
