# Spiko – Halborn Stellar Contracts Audit Findings

Audit report: [Stellar Contracts – Spiko](https://www.halborn.com/audits/spiko/stellar-contracts-879885)
Prepared by: Halborn
Date of Engagement: September 16th, 2025 – September 17th, 2025
Assessed Commit: [`b66c29e`](https://github.com/spiko-tech/stellar-contracts/tree/b66c29e5820c5d50f1654a7817537007cca8e5fb)

---

### Redemption execution burns from user account instead of redemption contract

Severity: Critical
BVSS: [AO:A/AC:L/AX:L/R:N/S:U/C:N/A:N/I:H/D:H/Y:N (9.4)](https://www.halborn.com/bvss?q=AO%3AA%2FAC%3AL%2FAX%3AL%2FR%3AN%2FS%3AU%2FC%3AN%2FA%3AN%2FI%3AH%2FD%3AH%2FY%3AN)
Status: Solved – 09/21/2025

The `execute_redemptions()` function in the Redemption contract incorrectly passes the user's address (`from`) as the account to burn tokens from, rather than the Redemption contract's own address. When a user calls `redeem()` on the Token contract, their tokens are transferred to the Redemption contract's balance as an escrow. The subsequent `execute_redemptions()` call is then expected to burn those escrowed tokens from the Redemption contract's balance. However, the vulnerable code passes `&from` (the original user address) as the burn target instead of `&redemption_contract_address`.

This means the burn is attempted against the user's account rather than the Redemption contract's escrowed balance. As a result, pending redemptions cannot be executed and the escrowed funds become permanently locked in the Redemption contract.

File(s)
`contracts/redemption/src/contract.rs`

Location(s)
`execute_redemptions()`

The vulnerable code at commit [`b66c29e`](https://github.com/spiko-tech/stellar-contracts/blob/b66c29e5820c5d50f1654a7817537007cca8e5fb/contracts/redemption/src/contract.rs):

```rust
let client: TokenClient<'_> = TokenClient::new(e, &token);
client.burn(&from, &amount, &redemption_contract_address);
```

**## Recommendation**

Correct the burn call to target the Redemption contract's own address instead of the user's address, so that the escrowed tokens held by the Redemption contract are burned upon execution.

**## Remediation**

This finding has been addressed in commit [`c84bf5d`](https://github.com/spiko-tech/stellar-contracts/commit/c84bf5d45ecfd093fdb68d199f878ba2ad38e3a1). The fix changes the burn call to pass `&redemption_contract_address` as the account to burn from:

```rust
client.burn(
    &redemption_contract_address,
    &amount,
    &redemption_contract_address,
);
```

---

### Admin can renounce and leave contract without admin

Severity: Low
BVSS: [AO:S/AC:L/AX:L/R:N/S:U/C:N/A:N/I:C/D:N/Y:N (2.0)](https://www.halborn.com/bvss?q=AO%3AS%2FAC%3AL%2FAX%3AL%2FR%3AN%2FS%3AU%2FC%3AN%2FA%3AN%2FI%3AC%2FD%3AN%2FY%3AN)
Status: Solved – 09/21/2025

The `PermissionManager` contract inherits a default `renounce_admin()` function from the `AccessControl` trait. If the current admin calls this function, the admin role is permanently removed with no recovery mechanism. Since the `PermissionManager` is the central access-control registry for the entire Spiko contract suite (controlling `MINTER_ROLE`, `BURNER_ROLE`, `WHITELISTED_ROLE`, `REDEMPTION_EXECUTOR_ROLE`, etc.), losing the admin would permanently brick all privileged operations across all contracts.

File(s)
`contracts/permission-manager/src/contract.rs`

Location(s)
`renounce_admin()`

**## Recommendation**

Override the default `renounce_admin()` implementation in `PermissionManager` to prevent it from being called, or replace it with an explicit admin rotation/proposal-accept process that requires a new admin to be designated before the current one can step down.

**## Remediation**

This finding has been addressed in commit [`0b0a20b`](https://github.com/spiko-tech/stellar-contracts/commit/0b0a20bbbd1f400b48f1cb087b864e0c62dd5b89). The fix overrides `renounce_admin()` in the `AccessControl` implementation for `PermissionManager` to unconditionally panic:

```rust
fn renounce_admin(_: &Env) {
    panic!("Cannot renounce admin");
}
```

---

### Idempotency keys and zero-amount / empty-batch operations can be consumed without effective work

Severity: Informational
BVSS: [AO:A/AC:L/AX:H/R:N/S:U/C:N/A:N/I:L/D:N/Y:N (0.8)](https://www.halborn.com/bvss?q=AO%3AA%2FAC%3AL%2FAX%3AH%2FR%3AN%2FS%3AU%2FC%3AN%2FA%3AN%2FI%3AL%2FD%3AN%2FY%3AN)
Status: Solved – 09/21/2025

Several functions in the Token contract (`mint()`, `mint_batch()`, `burn()`, `burn_batch()`, `transfer()`, `safe_transfer()`) do not validate that the operation amount is strictly positive, and the batch variants do not validate that the operations list is non-empty. Because idempotency keys are consumed at the end of each call, a caller can permanently consume an idempotency key by submitting a zero-amount or empty-batch operation that produces no real state change. This wastes idempotency keys and emits misleading events.

File(s)
`contracts/token/src/contract.rs`

Location(s)
`mint()`
`mint_batch()`
`burn()`
`burn_batch()`
`transfer()`
`safe_transfer()`

**## Recommendation**

Add guards at the start of each operation to reject zero-amount values and empty batch lists before any idempotency key is consumed or any event is emitted.

**## Remediation**

This finding has been addressed in commit [`0df70f8`](https://github.com/spiko-tech/stellar-contracts/commit/0df70f854207f4650cb2bf0ea22673dea1e4cc14). The fix adds the following assertions to the relevant functions:

```rust
assert!(amount > 0, "Invalid zero-amount mint");
```

```rust
assert!(operations.len() > 0, "Empty batch");
```

---

### Initialize placed outside constructor without variable inputs

Severity: Informational
BVSS: [AO:A/AC:L/AX:L/R:N/S:U/C:N/A:N/I:N/D:N/Y:N (0.0)](https://www.halborn.com/bvss?q=AO%3AA%2FAC%3AL%2FAX%3AL%2FR%3AN%2FS%3AU%2FC%3AN%2FA%3AN%2FI%3AN%2FD%3AN%2FY%3AN)
Status: Solved – 09/21/2025

The `PermissionManager` contract exposes a separate public `initialize()` function that sets the role admin mapping (`WHITELISTED_ROLE` → `WHITELISTER_ROLE`). This logic takes no variable inputs and is fixed at compile time, yet it is placed outside the `__constructor`. This creates an unnecessary public entrypoint that must be called as a separate transaction after deployment, introducing a deployment sequencing risk: if `initialize()` is not called immediately after deployment, the contract is left in a partially configured state. Any actor who calls `initialize()` before the deployer can set the role admin mapping, and the function could also be called again after initial setup (depending on the underlying `set_role_admin` guard).

File(s)
`contracts/permission-manager/src/contract.rs`

Location(s)
`initialize()`
`__constructor()`

**## Recommendation**

Move the fixed, non-parameterized initialization logic (i.e., `set_role_admin`) into the `__constructor` so that the contract is fully configured atomically at deployment time, eliminating the separate `initialize()` entrypoint.

**## Remediation**

This finding has been addressed in commit [`e1745b7`](https://github.com/spiko-tech/stellar-contracts/commit/e1745b7f9b165fbcd06d4c2d34637fd973ed4862). The fix removes the standalone `initialize()` function and moves the role admin setup into `__constructor()` using `set_role_admin_no_auth()`:

```rust
pub fn __constructor(e: &Env, admin: Address) {
    access_control::set_admin(e, &admin);
    access_control::set_role_admin_no_auth(e, &WHITELISTED_ROLE, &WHITELISTER_ROLE);
}
```

---

### Insufficient in-code documentation

Severity: Informational
BVSS: [AO:A/AC:L/AX:L/R:N/S:U/C:N/A:N/I:N/D:N/Y:N (0.0)](https://www.halborn.com/bvss?q=AO%3AA%2FAC%3AL%2FAX%3AL%2FR%3AN%2FS%3AU%2FC%3AN%2FA%3AN%2FI%3AN%2FD%3AN%2FY%3AN)
Status: Solved – 09/21/2025

The Token and Redemption contracts lack inline documentation (Rust doc comments) for their public functions. Without documentation describing the purpose, arguments, error conditions, and access control requirements of each function, developers integrating with or auditing the contracts face a higher risk of misconfiguration and misuse.

File(s)
`contracts/token/src/contract.rs`
`contracts/redemption/src/contract.rs`

**## Recommendation**

Add Rust doc comments (`///`) to all public contract functions, documenting at minimum: the function's purpose, its arguments, its error/panic conditions, and any role or authorization requirements.

**## Remediation**

This finding has been addressed in commit [`5a7fd0b`](https://github.com/spiko-tech/stellar-contracts/commit/5a7fd0b53b2119dc938f33c600524087c416b2b4). The fix adds comprehensive `///` doc comments to the public functions in both `contracts/redemption/src/contract.rs` and `contracts/token/src/contract.rs`, covering arguments, errors, and access control requirements.
