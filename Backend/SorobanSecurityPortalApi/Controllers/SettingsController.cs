using SorobanSecurityPortalApi.Authorization;
using SorobanSecurityPortalApi.Authorization.Attributes;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/v1/settings")]
    public class SettingsController : ControllerBase
    {
        private readonly ISettingsService _settingsService;
        private readonly IContentFilterService _contentFilterService;
        
        public SettingsController(
            ISettingsService settingsService,
            IContentFilterService contentFilterService)           
        {
            _settingsService = settingsService;
            _contentFilterService = contentFilterService;
        }

        [HttpGet]
        [RoleAuthorize(Role.Admin)]
        [CombinedAuthorize]
        public IActionResult ListAll()
        {
            return Ok(_settingsService.ListAll());
        }

        [HttpPost]
        [RoleAuthorize(Role.Admin)]
        [CombinedAuthorize]
        public IActionResult Save([FromBody] List<SettingsViewModel> settingsViewModels)
        {
            _settingsService.SaveAll(settingsViewModels);
            return Ok();
        }

        [HttpPost("reboot")]
        [RoleAuthorize(Role.Admin)]
        [CombinedAuthorize]
        public IActionResult Reboot()
        {
            _settingsService.Reboot();
            return Ok();
        }

        [HttpGet("default-profanity-words")]
        [RoleAuthorize(Role.Admin)]
        [CombinedAuthorize]
        public IActionResult GetDefaultProfanityWords()
        {
            var words = _contentFilterService.GetDefaultProfanityWords();
            return Ok(new { words = words.OrderBy(w => w).ToList(), count = words.Count });
        }

        [HttpPost("validate-profanity-words")]
        [RoleAuthorize(Role.Admin)]
        [CombinedAuthorize]
        public IActionResult ValidateProfanityWords([FromBody] ValidateProfanityWordsRequest request)
        {
            var defaultWords = _contentFilterService.GetDefaultProfanityWords();
            var customWords = request.Words
                .Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(w => w.Trim().ToLowerInvariant())
                .Where(w => !string.IsNullOrWhiteSpace(w))
                .ToList();

            var duplicatesInDefault = customWords
                .Where(w => defaultWords.Contains(w))
                .ToList();

            var duplicatesInCustom = customWords
                .GroupBy(w => w)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToList();

            return Ok(new 
            { 
                duplicatesInDefault = duplicatesInDefault,
                duplicatesInCustom = duplicatesInCustom,
                hasDuplicates = duplicatesInDefault.Any() || duplicatesInCustom.Any()
            });
        }
    }
}
