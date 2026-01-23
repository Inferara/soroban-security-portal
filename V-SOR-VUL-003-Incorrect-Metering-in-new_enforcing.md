## Incorrect Metering in new_enforcing

**Severity:** Warning  
**Commit:** 2674d86  
**Type:** Incorrect Metering  
**Status:** Open  
**File(s):** `rs-soroban-env/soroban-env-host/src/auth.rs`  
**Location(s):** `new_enforcing()`  
**Confirmed Fix At:** N/A  

The function `new_enforcing` in `auth.rs` allocates a vector of `RefCell<AccountAuthorizationTracker>`s of size `num_entries` but only charges for allocating `num_entries * sizeof(AccountAuthorizationTracker)` memory. Thus, the metering does not account for `sizeof(RefCell) * num_entries` memory, which ends up being `8 * num_entries` memory since the `RefCell` includes an additional counter of size `u64` to track references.

### Impact
The host does not account for `8 * num_entries` amount of memory allocated when charging. However, since this is a small constant factor over the existing charge, it shouldn’t allow users to perform denial of service attacks.

### Recommendation
We recommend accounting for the additional memory allocated by charging for `sizeof(RefCell) * num_entries` bytes.

### Developer Response
"That’s a bit of an oversight, but it’s really marginal and updating this would be a protocol change. It’s okay if we miss a few bytes here."
