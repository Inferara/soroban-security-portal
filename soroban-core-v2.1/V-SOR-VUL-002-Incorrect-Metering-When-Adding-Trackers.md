# Incorrect Metering When Adding Trackers

The function `add_invoker_contract_auth` undercharges the corresponding computation. In particular, the implementation allocates space for num_entries additional trackers but instead charges for num_entries Val objects. This can be seen in the following code:

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

Note that the call to `charge_bulk_init_cpy` is parameterized by Val when it should be parameterized by InvokerContractAuthorizationTracker.

**Severity:** Low

**Type:** Logic Error

## **File(s)**

rs-soroban-env/soroban-env-host/src/auth.rs

## **Location(s)**

`add_invoker_contract_auth()`

## **Impact**

Since InvocationContractAuthorizationTrackers are considerably larger than Val the budgeting does not properly account for the amount of computation. In practice the users would be charged a large amount for creating a lot of trackers and so the amount this difference could be used to perform a DOS attack is limited.

## **Recommendation**

We recommend changing `Vec::<Val>::charge_bulk_init_cpy(auth_entries.len() as u64, host)?;` to `Vec::<InvokerContractAuthorizationTracker>::charge_bulk_init_cpy(auth_entries.len() as u64, host)?;`

## **Status**

Open (Commit: 2674d86)

## **Developer Response**

This has been acknowledged and a Github Issue has been created.

