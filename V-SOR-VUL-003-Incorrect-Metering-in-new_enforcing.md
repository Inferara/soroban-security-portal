## Incorrect Metering in `new_enforcing`

**Severity:** Warning  
**Status:** Open  
**Tags:** Incorrect Metering, Memory Accounting  

### Affected Files
- `rs-soroban-env/soroban-env-host/src/auth.rs`

### Affected Locations
- `new_enforcing()`

### Commit
- **Vulnerable Commit:** `2674d86`
- **Confirmed Fix At:** N/A

### Impact
The host does not account for an additional `8 * num_entries` bytes of memory when charging. However, since this represents a small constant factor over the existing charge, it is unlikely to enable denial-of-service attacks.

### Recommendation
Update the metering logic to account for the additional memory allocated by `RefCell` by charging for `sizeof(RefCell) * num_entries` bytes.
