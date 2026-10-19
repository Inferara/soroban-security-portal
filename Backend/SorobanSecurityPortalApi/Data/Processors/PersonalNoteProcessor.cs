using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class PersonalNoteProcessor : IPersonalNoteProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public PersonalNoteProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<PersonalNoteViewModel?> GetByVulnerability(int vulnerabilityId, int loginId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var vulnerability = await db.Vulnerability
                .AsNoTracking()
                .Where(x => x.Id == vulnerabilityId && !x.IsHidden && !x.IsDeleted)
                .Select(x => new { x.Id, x.Title, x.Description, x.Severity })
                .FirstOrDefaultAsync();

            if (vulnerability == null)
            {
                return null;
            }

            var note = await db.PersonalNote
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.LoginId == loginId && x.VulnerabilityId == vulnerabilityId);

            if (note == null)
            {
                return null;
            }

            return new PersonalNoteViewModel
            {
                Id = note.Id,
                VulnerabilityId = note.VulnerabilityId,
                Content = note.Content,
                CreatedAt = note.CreatedAt,
                UpdatedAt = note.UpdatedAt,
                Title = vulnerability.Title,
                Description = vulnerability.Description,
                Severity = vulnerability.Severity
            };
        }

        public async Task<PersonalNoteViewModel> Upsert(int vulnerabilityId, int loginId, string content)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var vulnerability = await db.Vulnerability
                .AsNoTracking()
                .Where(x => x.Id == vulnerabilityId && !x.IsHidden && !x.IsDeleted)
                .Select(x => new { x.Id, x.Title, x.Description, x.Severity })
                .FirstOrDefaultAsync();

            if (vulnerability == null)
            {
                throw new KeyNotFoundException($"Vulnerability with ID {vulnerabilityId} not found");
            }

            var existing = await db.PersonalNote
                .FirstOrDefaultAsync(x => x.LoginId == loginId && x.VulnerabilityId == vulnerabilityId);

            var now = DateTime.UtcNow;
            if (existing != null)
            {
                existing.Content = content;
                existing.UpdatedAt = now;
                await db.SaveChangesAsync();
            }
            else
            {
                existing = new PersonalNoteModel
                {
                    LoginId = loginId,
                    VulnerabilityId = vulnerabilityId,
                    Content = content,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                db.PersonalNote.Add(existing);

                try
                {
                    await db.SaveChangesAsync();
                }
                catch (DbUpdateException)
                {
                    db.PersonalNote.Remove(existing);

                    // Another concurrent first-save for the same (loginId, vulnerabilityId) won the race
                    // against the unique index. Re-open a clean context and apply the update to that row.
                    await using var retryDb = await _dbFactory.CreateDbContextAsync();
                    var concurrentExisting = await retryDb.PersonalNote
                        .FirstOrDefaultAsync(x => x.LoginId == loginId && x.VulnerabilityId == vulnerabilityId);

                    if (concurrentExisting == null)
                    {
                        throw;
                    }

                    concurrentExisting.Content = content;
                    concurrentExisting.UpdatedAt = DateTime.UtcNow;
                    await retryDb.SaveChangesAsync();
                    existing = concurrentExisting;
                }
            }

            return new PersonalNoteViewModel
            {
                Id = existing.Id,
                VulnerabilityId = existing.VulnerabilityId,
                Content = existing.Content,
                CreatedAt = existing.CreatedAt,
                UpdatedAt = existing.UpdatedAt,
                Title = vulnerability.Title,
                Description = vulnerability.Description,
                Severity = vulnerability.Severity
            };
        }

        public async Task Delete(int noteId, int loginId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var note = await db.PersonalNote
                .FirstOrDefaultAsync(x => x.Id == noteId && x.LoginId == loginId);

            if (note == null)
            {
                throw new KeyNotFoundException($"Personal note with ID {noteId} not found");
            }

            db.PersonalNote.Remove(note);
            await db.SaveChangesAsync();
        }

        public async Task DeleteByVulnerability(int vulnerabilityId, int loginId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var note = await db.PersonalNote
                .FirstOrDefaultAsync(x => x.VulnerabilityId == vulnerabilityId && x.LoginId == loginId);

            if (note == null)
            {
                throw new KeyNotFoundException($"Personal note for vulnerability ID {vulnerabilityId} not found");
            }

            db.PersonalNote.Remove(note);
            await db.SaveChangesAsync();
        }

        public async Task<List<PersonalNoteViewModel>> List(int loginId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var notes = await db.PersonalNote
                .AsNoTracking()
                .Where(x => x.LoginId == loginId)
                .OrderByDescending(x => x.UpdatedAt)
                .ToListAsync();

            if (notes.Count == 0)
            {
                return new List<PersonalNoteViewModel>();
            }

            var vulnerabilityIds = notes
                .Select(x => x.VulnerabilityId)
                .Distinct()
                .ToList();

            var vulnerabilities = await db.Vulnerability
                .AsNoTracking()
                .Where(x => vulnerabilityIds.Contains(x.Id) && !x.IsHidden && !x.IsDeleted)
                .Select(x => new { x.Id, x.Title, x.Description, x.Severity })
                .ToDictionaryAsync(x => x.Id);

            var result = new List<PersonalNoteViewModel>(notes.Count);
            foreach (var note in notes)
            {
                if (!vulnerabilities.TryGetValue(note.VulnerabilityId, out var vulnerability))
                {
                    continue;
                }

                result.Add(new PersonalNoteViewModel
                {
                    Id = note.Id,
                    VulnerabilityId = note.VulnerabilityId,
                    Content = note.Content,
                    CreatedAt = note.CreatedAt,
                    UpdatedAt = note.UpdatedAt,
                    Title = vulnerability.Title,
                    Description = vulnerability.Description,
                    Severity = vulnerability.Severity
                });
            }

            return result;
        }
    }

    public interface IPersonalNoteProcessor
    {
        Task<PersonalNoteViewModel?> GetByVulnerability(int vulnerabilityId, int loginId);
        Task<PersonalNoteViewModel> Upsert(int vulnerabilityId, int loginId, string content);
        Task Delete(int noteId, int loginId);
        Task DeleteByVulnerability(int vulnerabilityId, int loginId);
        Task<List<PersonalNoteViewModel>> List(int loginId);
    }
}
