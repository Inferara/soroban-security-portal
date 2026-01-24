### A.2.2 V-SOR-APP-VUL-003: Denial of Service During Authorization

**Severity:** Critical  
**Commit:** 2674d86  
**Type:** Denial of Service  
**Status:** Investigated  
**Confirmed Fix At:** N/A  

**File(s):**  
`rs-soroban-env/src/auth.rs`  

**Location(s):**  
`require_auth_enforcing()`  

**Description:**  
Contracts can request authorization via `request_auth` on an address. If the address corresponds to a contract, its `__check_auth` function is invoked.  

If `__check_auth` calls `require_auth` on its own address, this can cause repeated invocations of `require_auth_enforcing()`. Each call iterates over account trackers to authorize the invocation:

```rust
for tracker in self.try_borrow_account_trackers(host)?.iter() {
    if let Ok(mut tracker) = tracker.try_borrow_mut() {
        if !host.compare(&tracker.address, &address)?.is_eq() {
            continue;
        }
        match tracker.maybe_authorize_invocation(host, function, !has_active_tracker) {
            Ok(false) => continue,
            Ok(true) => return Ok(()),
            Err(e) => return Err(e),
        }
    }
}
