## Incorrect Metering When Adding Trackers

**Severity:** Low  
**Status:** Open  
**Tags:** Logic Error, Metering, Undercharging  


### Affected Files
- `rs-soroban-env/soroban-env-host/src/auth.rs`

### Affected Locations
- `add_invoker_contract_auth()`

### Commit
- **Vulnerable Commit:** `2674d86`
- **Confirmed Fix At:** N/A

### Code Snippet
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


