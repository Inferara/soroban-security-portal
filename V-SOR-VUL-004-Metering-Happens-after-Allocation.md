## Metering Happens After Allocation

**Severity:** Warning  
**Status:** Open  
**Tags:** Logic Error, Metering Order, DoS Risk  

### Affected Files
- `rs-soroban-env/soroban-env-host/src/auth.rs`

### Affected Locations
- `snapshot()`

### Commit
- **Vulnerable Commit:** `2674d86`
- **Confirmed Fix At:** N/A

### Code Snippet
```rust
let len = self.try_borrow_account_trackers(host)?.len();
let mut snapshots: Vec<Option<AccountAuthorizationTrackerSnapshot>> =
    Vec::with_capacity(len);
Vec::<Option<AccountAuthorizationTrackerSnapshot>>::charge_bulk_init_cpy(
    len as u64,
    host,
)?;
