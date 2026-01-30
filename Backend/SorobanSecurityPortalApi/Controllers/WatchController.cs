using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using System.Linq;
using System.Threading.Tasks;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WatchController : ControllerBase
    {
        private readonly Db _db;
        public WatchController(Db db)
        {
            _db = db;
        }

        [HttpPost]
        public async Task<IActionResult> Watch([FromBody] WatchDto dto)
        {
            var exists = await _db.Watch.AnyAsync(w => w.UserId == dto.UserId && w.EntityId == dto.EntityId && w.EntityType == dto.EntityType);
            if (exists)
                return BadRequest("Already watching.");

            var watch = new WatchModel { UserId = dto.UserId, EntityId = dto.EntityId, EntityType = dto.EntityType };
            _db.Watch.Add(watch);
            await _db.SaveChangesAsync();
            return Ok();
        }

        [HttpDelete]
        public async Task<IActionResult> Unwatch([FromBody] WatchDto dto)
        {
            var watch = await _db.Watch.FirstOrDefaultAsync(w => w.UserId == dto.UserId && w.EntityId == dto.EntityId && w.EntityType == dto.EntityType);
            if (watch == null)
                return NotFound();

            _db.Watch.Remove(watch);
            await _db.SaveChangesAsync();
            return Ok();
        }

        [HttpGet("count")]
        public async Task<IActionResult> GetWatchCount(int entityId, string entityType)
        {
            var count = await _db.Watch.CountAsync(w => w.EntityId == entityId && w.EntityType == entityType);
            return Ok(count);
        }

        [HttpGet("user")]
        public async Task<IActionResult> GetWatchedEntities(int userId)
        {
            var watches = await _db.Watch.Where(w => w.UserId == userId).ToListAsync();
            return Ok(watches);
        }
    }

    public class WatchDto
    {
        public int UserId { get; set; }
        public int EntityId { get; set; }
        public string EntityType { get; set; }
    }
}
