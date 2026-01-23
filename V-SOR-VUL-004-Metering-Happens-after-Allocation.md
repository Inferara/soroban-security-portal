## Metering Happens after Allocation

**Severity:** Warning  
**Commit:** 2674d86  
**Type:** Logic Error  
**Status:** Open  
**File(s):** `rs-soroban-env/soroban-env-host/src/auth.rs`  
**Location(s):** snapshot()  
**Confirmed Fix At:** N/A  

The `snapshot` function in `auth.rs` first allocates a vector of `AccountAuthorizationTrackerSnapshot`s and then charges for this allocation. This is seen in the following code:

```rust
let len = self.try_borrow_account_trackers(host)?.len();
let mut snapshots: Vec<Option<AccountAuthorizationTrackerSnapshot>> = Vec::with_capacity(len);
Vec::<Option<AccountAuthorizationTrackerSnapshot>>::charge_bulk_init_cpy(
    len as u64, host,
)?;
