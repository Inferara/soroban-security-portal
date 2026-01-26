## Metering Happens After Allocation

**Severity:** Warning  
**Status:** Open  
**Tags:** Logic Error, Metering Order, DoS Risk  

### Description
The `snapshot` function in `auth.rs` allocates a vector of `AccountAuthorizationTrackerSnapshot` entries before charging for the allocation. The allocation is performed first, followed by a metering charge, as shown in the code below.

Allowing memory allocation to occur before charging is generally unsafe, as malicious users could attempt to allocate large amounts of memory prior to being charged, potentially enabling denial-of-service (DoS) attacks.

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
