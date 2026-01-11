using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Authorization.Attributes;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;

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
        public async Task<IActionResult> Add([FromForm] string companyData, [FromForm] IFormFile? image = null)
        {
            var jsonOptions = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var companyViewModel = System.Text.Json.JsonSerializer.Deserialize<CompanyViewModel>(companyData, jsonOptions);
            if (companyViewModel == null)
            {
                return BadRequest("Invalid company data.");
            }

            if (image != null && image.Length > 0)
            {
                using var memoryStream = new MemoryStream();
                await image.CopyToAsync(memoryStream);
                companyViewModel.ImageData = memoryStream.ToArray();
            }

            var result = await _companyService.Add(companyViewModel);
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPut]
        public async Task<IActionResult> Update([FromForm] string companyData, [FromForm] IFormFile? image = null)
        {
            var jsonOptions = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var companyViewModel = System.Text.Json.JsonSerializer.Deserialize<CompanyViewModel>(companyData, jsonOptions);
            if (companyViewModel == null)
            {
                return BadRequest("Invalid company data.");
            }

            if (image != null && image.Length > 0)
            {
                using var memoryStream = new MemoryStream();
                await image.CopyToAsync(memoryStream);
                companyViewModel.ImageData = memoryStream.ToArray();
            }

            var result = await _companyService.Update(companyViewModel);
            if (result is Result<CompanyViewModel, string>.Ok ok)
                return Ok(ok.Value);
            else if (result is Result<CompanyViewModel, string>.Err err)
                return BadRequest(err.Error);
            else
                throw new InvalidOperationException("Unexpected result type");
        }

        [RoleAuthorize(Role.Admin)]
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

        [HttpGet("{id}/image.png")]
        public async Task<IActionResult> GetCompanyImage(int id)
        {
            var company = await _companyService.GetById(id);
            if (company == null || company.Image == null || company.Image.Length == 0)
            {
                return NotFound("Image not found.");
            }
            return File(company.Image, "image/png", "image.png");
        }
    }
}
