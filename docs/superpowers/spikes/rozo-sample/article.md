# Rozo — Hacken Security Audit

**Audited project:** Rozo (ROZO Intents) · **Auditor:** Hacken (Felipe Donato / Kerem Solmaz) · **Date:** April 13, 2026

## Summary

Hacken performed a smart-contract security audit of the Rozo Intents V2 Soroban contracts — the Token Forwarder and Intent Bridge — targeting commit `1c2f003`. The review identified 8 findings (1 medium, 2 low, 5 observations), all of which were resolved by the Rozo team. No critical or high-severity issues were found. The contracts implement an intent-based stablecoin bridge between Stellar and other chains, with escrow-based cross-chain settlement and bidirectional token forwarding.

## Scope

- **Repository:** `https://github.com/RozoAI/rozo-intents-contracts/tree/main`
- **Commit:** `1c2f003`
- **Platform:** Stellar (Soroban)
- **Language:** Rust
- **Contracts in scope:**
  - `v2/stellar/forwarder/src/lib.rs` — Token Forwarder
  - `v2/stellar/intent_bridge/src/lib.rs` — Intent Bridge
- **Requirements:** `https://docs.rozo.ai`, README.md
- **Test coverage:** 97.69% line coverage

## Findings

### Fee-on-Transfer Tokens Can Break Intent Accounting

**Severity:** Medium

The Intent Bridge records `source_amount` as the canonical escrowed amount but does not verify the actual token amount received by the contract after `transfer()`. Because the contract accepts arbitrary token contract addresses, a non-standard token may transfer less than the requested amount while still succeeding. The bridge then stores the nominal `source_amount`, but later `fill()` and `refund()` attempt to transfer the full recorded amount out, which can fail due to insufficient balance, rendering the affected intent non-functional.

```rust
// intent_bridge/src/lib.rs - create_intent()
let token_client = token::Client::new(&env, &source_token);
token_client.transfer(&sender, &env.current_contract_address(), &source_amount);

// intent_bridge/src/lib.rs - fill()
token_client.transfer(&env.current_contract_address(), &relayer, &intent.source_amount);

// intent_bridge/src/lib.rs - refund()
token_client.transfer(&env.current_contract_address(), &intent.sender, &intent.source_amount);
```

**Recommendation:** Restrict supported assets through an on-chain allowlist, or verify the actual post-transfer balance delta and store the amount actually received.

```rust
// Option B - Balance delta:
let balance_before = token_client.balance(&env.current_contract_address());
token_client.transfer(&sender, &env.current_contract_address(), &source_amount);
let balance_after = token_client.balance(&env.current_contract_address());
let actual_received = balance_after - balance_before;
```

### Missing Destination Field Validation Allows Malformed Intents On-Chain

**Severity:** Note

`create_intent()` does not validate several user-supplied destination-side metadata fields. `destination_amount` accepts zero and negative `i128` values (while `source_amount` is validated with `<= 0`). `destination_chain` and `destination_address` accept empty strings with no non-empty check enforced. Malformed destination metadata can be committed on-chain and emitted in events, allowing malformed intents to enter the bridge flow with nonsensical routing or amount information.

```rust
if source_amount <= 0 { return Err(Error::ZeroAmount); }  // validated
if memo.len() > 28 { return Err(Error::MemoTooLong); }    // validated
// destination_amount: no validation
// destination_chain: no validation
// destination_address: no validation
```

**Recommendation:** Add input validation for destination-side fields in `create_intent()`:

```rust
if destination_amount <= 0 {
    return Err(Error::ZeroAmount);
}
if destination_chain.len() == 0 || destination_address.len() == 0 {
    return Err(Error::EmptyDestination);
}
```

### Missing Existence Check in remove_memo_mapping Emits Spurious Events

**Severity:** Note

`remove_memo_mapping()` calls `persistent().remove()` without checking whether the mapping exists. Although `Error::MemoNotFound` was defined for this case, it is never used. A `MemoMappingRemovedEvent` is emitted even when nothing was actually removed, introducing spurious event entries.

```rust
// No existence check:
env.storage().persistent().remove(&DataKey::MemoMapping(memo.clone()));
// Event emitted regardless:
env.events().publish((symbol_short!("memo_rm"),), event);
```

**Recommendation:** Verify the mapping exists before removal:

```rust
if !env.storage().persistent().has(&DataKey::MemoMapping(memo.clone())) {
    return Err(Error::MemoNotFound);
}
```

### Unused Error Variants Reduce ABI Clarity

**Severity:** Note

Several error variants are defined but never returned: Intent Bridge has `Error::AlreadyInitialized` (1) and `Error::InvalidDeadlineDuration` (11) — the constructor uses `panic!()` instead. Token Forwarder has `Error::MemoNotFound` (5) which was defined but unused.

**Recommendation:** Remove unused variants or wire them into the code paths (e.g., use `Error::InvalidDeadlineDuration` in the constructor with a `Result` return type instead of `panic!()`).

### Outdated soroban-sdk Dependency Contains Three Known CVEs

**Severity:** Note

Both contracts pin `soroban-sdk = "22.0.0"`, which is affected by three published CVEs: CVE-2026-24889 (medium, overflow in `Bytes::slice`/`Vec::slice`/`Prng::gen_range`, fixed >= 22.0.9), CVE-2026-26267 (high, `#[contractimpl]` resolves inherent over trait impl bypassing auth, fixed >= 22.0.10), and CVE-2026-32322 (medium 5.3, `Fr` scalar field equality bypasses modular reduction, fixed >= 22.0.11). The vulnerable code paths are not exercised in current contracts, but the dependency ships known vulnerable code.

**Recommendation:** Upgrade to `soroban-sdk >= 22.0.11` and recompile/redeploy.

### Immutable Role Configuration Prevents On-Chain Key Rotation After Deployment

**Severity:** Note

Both contracts set privileged roles at deployment that cannot be updated post-deployment. Intent Bridge's `Messenger` and `Relayer` and Token Forwarder's `Admin` are immutable — no setter functions exist. Additionally, Intent Bridge's `deadline_duration` is set once and cannot be tuned. If any privileged key must change, a full contract redeployment is required. Pending intents in the old bridge contract remain bound to the old configuration.

```rust
// intent_bridge/src/lib.rs: __constructor
env.storage().instance().set(&DataKey::Messenger, &messenger);
env.storage().instance().set(&DataKey::Relayer, &relayer);
// No set_messenger() or set_relayer() function exists

// forwarder/src/lib.rs: __constructor
env.storage().instance().set(&DataKey::Admin, &admin);
// set_proxy_address() exists, but no set_admin() function is implemented
```

**Recommendation:** Evaluate whether post-deployment role rotation is needed for operational resilience. If so, introduce a privileged admin role with setter functions (ideally using a two-step transfer pattern). If immutability is intentional, document it explicitly as a design decision and define the expected redeployment procedure.

### Missing Persistent TTL Extension on Memo Mappings Can Cause Silent Routing Failure

**Severity:** Low

`set_memo_mapping()` writes memo-to-address mappings to persistent storage but never calls `extend_ttl()`. Unlike the Intent Bridge which extends persistent entry TTL on every `create_intent`/`fill`/`refund`, the Token Forwarder never extends memo mapping TTL. After sufficient inactivity, memo mapping entries age into archival, causing memo lookup to fail and G→C wallet routing to break.

```rust
// forwarder/src/lib.rs: set_memo_mapping()
env.storage().persistent().set(&DataKey::MemoMapping(memo.clone()), &destination);
// No extend_ttl()
```

**Recommendation:** Add TTL extension on memo mapping writes and reads:

```rust
let key = DataKey::MemoMapping(memo.clone());
env.storage().persistent().set(&key, &destination);
env.storage().persistent().extend_ttl(&key, MEMO_TTL_THRESHOLD, MEMO_TTL_EXTEND);
```

### Missing Instance Storage TTL Extension Can Cause Temporary Contract Unavailability

**Severity:** Low

Neither contract calls `env.storage().instance().extend_ttl()`. Instance storage holds critical configuration values (Messenger, Relayer, DeadlineDuration in Intent Bridge; Admin, ProxyAddress in Token Forwarder). On Soroban, instance storage is subject to TTL expiration — when TTL reaches zero, the contract instance is archived at the protocol level and normal invocations fail. For the Intent Bridge, this means `fill()` and `refund()` can fail while intents are in `PENDING` status, leaving funds temporarily inaccessible. Instance storage is restorable via `RestoreFootprintOp`, so no permanent fund loss occurs.

```rust
// intent_bridge/src/lib.rs: __constructor
env.storage().instance().set(&DataKey::Messenger, &messenger);
env.storage().instance().set(&DataKey::Relayer, &relayer);
env.storage().instance().set(&DataKey::DeadlineDuration, &deadline_duration);
// No env.storage().instance().extend_ttl() anywhere in the contract
```

**Recommendation:** Add instance TTL extension to functions that keep the contract operational:

```rust
const INSTANCE_TTL_THRESHOLD: u32 = 120960; // 7 days
const INSTANCE_TTL_EXTEND: u32 = 241920;    // 14 days

env.storage().instance().extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND);
```
