using Microsoft.AspNetCore.Mvc;
using AutoMapper;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/users")]
    public class BadgeController : ControllerBase
    {
        private readonly IBadgeProcessor _badgeProcessor;
        private readonly IMapper _mapper;

        public BadgeController(IBadgeProcessor badgeProcessor, IMapper mapper)
        {
            _badgeProcessor = badgeProcessor;
            _mapper = mapper;
        }

        [HttpGet("{id}/badges")]
        public async Task<IActionResult> GetUserBadges(int id) 
        {
            var userBadgeRecords = await _badgeProcessor.GetUserBadges(id);

            var result = _mapper.Map<List<BadgeViewModel>>(userBadgeRecords);

            return Ok(result);
        }

        [HttpGet("test-definitions")]
        public async Task<IActionResult> GetDefinitions()
        {
            var list = await _badgeProcessor.GetAllBadgeDefinitions();
            return Ok(list); 
        }
    }
}
