## Incorrect Metering When Adding Trackers

**Severity:** Low  
**Commit:** 2674d86  
**Type:** Logic Error  
**Status:** Open  
**File(s):** `rs-soroban-env/soroban-env-host/src/auth.rs`  
**Location(s):** `add_invoker_contract_auth()`  
**Confirmed Fix At:** N/A  

The function `add_invoker_contract_auth` undercharges the corresponding computation. In particular, the implementation allocates space for `num_entries` additional trackers but instead charges for `num_entries` `Val` objects. This can be seen in the following code:

```rust
let auth_entries =
    host.visit_obj(auth_entries, |e: &HostVec| e.to_vec(host.budget_ref()))?;
let mut trackers: std::cell::RefMut<'_, Vec<InvokerContractAuthorizationTracker>> =
    self.try_borrow_invoker_contract_trackers_mut(host)?;
Vec::<Val>::charge_bulk_init_cpy(auth_entries.len() as u64, host)?;
trackers.reserve(auth_entries.len());
for e in auth_entries {
    trackers.push(InvokerContractAuthorizationTracker::new(host, e)?)
}
```

Note that the call to `charge_bulk_init_cpy` is parameterized by `Val` when it should be parameterized by `InvokerContractAuthorizationTracker`.

### Impact
Since `InvocationContractAuthorizationTrackers` are considerably larger than `Val`, the budgeting does not properly account for the amount of computation. In practice, users would be charged a large amount for creating a lot of trackers, so the amount this difference could be used to perform a DOS attack is limited.

### Recommendation
We recommend changing:

```rust
Vec::<Val>::charge_bulk_init_cpy(auth_entries.len() as u64, host)?;
```

to

```rust
Vec::<InvokerContractAuthorizationTracker>::charge_bulk_init_cpy(auth_entries.len() as u64, host)?;
```

### Developer Response
This has been acknowledged and a GitHub Issue has been created.

