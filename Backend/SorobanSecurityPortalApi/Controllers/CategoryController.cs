using SorobanSecurityPortalApi.Services.ControllersServices;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Authorization.Attributes;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/categories")]
    public class CategoryController : ControllerBase
    {
        private readonly ICategoryService _categoryService;

        public CategoryController(ICategoryService categoryService)
        {
            _categoryService = categoryService;
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPost]
        public async Task<IActionResult> Add(CategoryViewModel categoryViewModel)
        {
            var result = await _categoryService.Add(categoryViewModel);
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPut]
        public async Task<IActionResult> Update(CategoryViewModel categoryViewModel)
        {
            var result = await _categoryService.Update(categoryViewModel);
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin)]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            await _categoryService.Delete(id);
            return Ok();
        }

        [HttpGet]
        public async Task<IActionResult> List()
        {
            var result = await _categoryService.List();
            return Ok(result);
        }

        [HttpGet]
        [Route("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var categorys = await _categoryService.List();
            var category = categorys.FirstOrDefault(a => a.Id == id);
            if (category == null)
            {
                return NotFound($"Category with ID {id} not found.");
            }
            return Ok(category);
        }

    }
}
