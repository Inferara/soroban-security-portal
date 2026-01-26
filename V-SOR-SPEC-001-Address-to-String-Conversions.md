## Unchecked Arithmetic in Metered Map

**Severity:** Medium  
**Status:** Fixed  
**Tags:** Unchecked Arithmetic, Resource Management, Budget Bypass  


### Affected Files
- `rs-soroban-env/soroban-env-host/src/host/metered_map.rs`

### Affected Locations
- N/A

### Commit
- **Vulnerable Commit:** `2674d86`
- **Confirmed Fix At:** `c29b5a1`

### Impact
By exploiting unchecked arithmetic, users could theoretically bypass budget limitations by allocating sufficiently large maps and repeatedly adding, deleting, or resizing entries.

This impact is partially mitigated by the fact that allocating such large maps would already incur significant resource costs before an overflow could occur.

### Recommendation
Replace all unchecked arithmetic in the metered map implementation with **checked** or **saturating arithmetic** (e.g., `checked_add` or `saturating_add`) to prevent overflow-related budget bypasses.
