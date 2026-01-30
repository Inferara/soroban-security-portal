# Metering Happens after Allocation

The `snapshot()` function in auth.rs first allocates a vector of AccountAuthorizationTrackerSnapshots and then charges for this allocation. This is seen in the following code:

```rust
let len = self.try_borrow_account_trackers(host)?.len();
let mut snapshots: Vec<Option<AccountAuthorizationTrackerSnapshot>> = Vec::with_capacity(len);
Vec::<Option<AccountAuthorizationTrackerSnapshot>>::charge_bulk_init_cpy(
len as u64, host,
)?;
```

In general, this pattern of allowing computation prior to charging for it is dangerous because malicious users could perform a denial of service attack by allocating a very large amount of memory before being charged for it. Thus, we recommend that the implementation charge for the vector being allocated before performing the allocation.

**Severity:** Warning

**Type:** Logic Error

## **File(s)**

rs-soroban-env/soroban-env-host/src/auth.rs

## **Location(s)**

`snapshot()`

## **Impact**

While this pattern is dangerous it is unlikely to be exploited in this scenario since the user would need to spend a lot in the first place to allocate a large number of trackers.

## **Recommendation**

We recommend swapping the `charge_bulk_init_cpy` call with the allocation of snapshots.

## **Status**

Open (Commit: 2674d86)

## **Developer Response**

It doesn't matter much since the capacity is really low, but we can indeed swap these 2 lines. This is not a protocol update.
