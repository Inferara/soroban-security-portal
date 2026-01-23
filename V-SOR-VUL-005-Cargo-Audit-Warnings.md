## Cargo Audit Warnings

**Severity:** Info  
**Commit:** 16f4d7c  
**Type:** Maintainability  
**Status:** Acknowledged  
**File(s):** `rs-stellar-xdr`, `rs-soroban-env`  
**Location(s):** N/A  
**Confirmed Fix At:** N/A  

`cargo audit` gives a warning for the package `bumpalo` due to a potential use-after-free issue caused by `Vec::into_iter()`.  
It also reports warnings for a couple of dependencies of the package `textplots`.

### Impact
Upgrading the dependencies will improve maintainability by avoiding potential errors caused by these issues.

### Recommendation
- Run `cargo update -p bumpalo` for `rs-stellar-xdr` to avoid the risk of this memory error.  
- Update the packages `textplots` and `colored` for `rs-soroban-env` to resolve warnings for this repository.  

Both projects build and pass all tests with these updates.

### Developer Response
For the `bumpalo` dependency, developers indicated they are not concerned with the issue at this time as it is compile-time.  
For `textplots` and `colored`, these are only `[dev-dependencies]` used for tests.  
As a result, they will address these concerns at the next "protocol boundary".
