# Confusing Naming of AllowanceValue Expiration

Allowances are stored as a Temporary ledger entry consisting of an AllowanceValue struct declared as the following:

```rust
#[contracttype]
pub(crate) struct AllowanceValue {
pub amount: i128,
pub live_until_ledger: u32,
}
```

The `AllowanceValue.live_until_ledger` is used to determine whether or not the allowance has expired, and this value can be lower than the TTL of the ledger entry by calling `write_allowance` with a low value passed as the live_until argument or by bumping the TTL of the ledger entry.

Since this struct value is called `live_until_ledger` it may be easy for new smart contract developers to confuse this value with the TTL value of the ledger entry, which is an unsafe way to enforce the expiration.

**Severity:** Info

**Type:** Maintainability

## **File(s)**

rs-soroban-env/soroban-env-host/src/.../allowance.rs

## **Impact**

If future developers confuse the `live_until_ledger` with the TTL of the ledger entry, they may write unsafe code that relies on the TTL of the ledger entry which could cause critical vulnerabilities in their code.

## **Recommendation**

Clarify the distinction between the allowance expiration and the TTL of the AllowanceValue entry by renaming the `live_until_ledger` to something like `allowance_expiration_ledger`, so developers who don't have a thorough understanding of the docs will be less likely to make this mistake.

Also update the params of some of the allowance functions to use `expiration_ledger` instead of `live_until`.

## **Status**

Open (Commit: 2674d86)

## **Developer Response**

TBD
