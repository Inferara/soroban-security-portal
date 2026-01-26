## Cargo Audit Warnings

**Severity:** Info  
**Status:** Acknowledged  
**Tags:** Maintainability, Dependencies, Third-Party Risk  

### Description
`cargo audit` reports warnings for the dependency **bumpalo** due to a potential use-after-free issue related to `Vec::into_iter()`. Additional warnings are also reported for dependencies of the **textplots** package.

These issues originate from third-party dependencies and do not directly impact the core logic of the codebase.

### Affected Files
- `rs-stellar-xdr`
- `rs-soroban-env`

### Affected Locations
- N/A

### Commit
- **Reported At Commit:** `16f4d7c`
- **Confirmed Fix At:** N/A

### Impact
Upgrading the affected dependencies improves maintainability and reduces the risk of potential memory errors introduced by known third-party issues.

### Recommendation
- Run the following command to update **bumpalo** in `rs-stellar-xdr`:
  ```bash
  cargo update -p bumpalo

