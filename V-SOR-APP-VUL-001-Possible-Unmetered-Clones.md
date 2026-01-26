## Possible Unmetered Clones

**Severity:** Warning  
**Commit:** 2674d86  
**Type:** Incorrect Metering  
**Status:** Intended Behavior  

The `e2e_invoke.rs` file contains cloning operations where some are metered and others are not.

In the `build_storage_footprint_from_xdr` function, the cloning of the `key` variable of type
`LedgerKey` is metered, as shown below:

```rust
Rc::metered_new(key.metered_clone(budget)?, budget)?
