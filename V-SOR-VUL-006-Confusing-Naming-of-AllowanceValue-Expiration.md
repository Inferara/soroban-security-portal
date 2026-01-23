## Confusing Naming of AllowanceValue Expiration

**Severity:** Info  
**Commit:** 2674d86  
**Type:** Maintainability  
**Status:** Open  
**File(s):** `rs-soroban-env/soroban-env-host/src/.../allowance.rs`  
**Location(s):** N/A  
**Confirmed Fix At:** N/A  

Allowances are stored as a Temporary ledger entry consisting of an `AllowanceValue` struct declared as:

```rust
#[contracttype]
pub(crate) struct AllowanceValue {
    pub amount: i128,
    pub live_until_ledger: u32,
}

