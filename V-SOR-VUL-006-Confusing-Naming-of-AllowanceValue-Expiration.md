## Confusing Naming of AllowanceValue Expiration

**Severity:** Informational  
**Status:** Open  
**Type:** Maintainability / Documentation  
**Tags:** Maintainability, Documentation, Developer Experience  
**Commit:** 2674d86  

### Affected Files
- `rs-soroban-env/soroban-env-host/src/.../allowance.rs`

### Locations
- N/A

### Impact

If developers mistakenly assume that `live_until_ledger` represents the ledger
entry TTL, they may write unsafe code that relies on ledger expiration semantics
instead of explicit allowance expiration checks. This confusion could result in
critical vulnerabilities in downstream smart contracts.

### Recommendation

Clarify the distinction between allowance expiration and ledger entry TTL by
renaming the `live_until_ledger` field to a more explicit name such as
`allowance_expiration_ledger`.

Additionally, update the parameters of relevant allowance-related functions to
use naming such as `expiration_ledger` instead of `live_until`, reducing the
likelihood of developer confusion and unsafe usage patterns.

### Status

This issue is informational in nature and affects developer experience and
maintainability rather than protocol correctness.
