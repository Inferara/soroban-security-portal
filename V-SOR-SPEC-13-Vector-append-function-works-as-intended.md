## Possible Unmetered Clones

In the e2e_invoke.rs file there are some cloning operations that are metered. For example, in the `build_storage_footprint_from_xdr()` function, the cloning of the key variable of type `LedgerKey` is metered:
```rust
Rc::metered_new(key.metered_clone(budget)?, budget)?
```

Whereas other clone operations in the same file are not metered. For example, in the `build_storage_map_from_xdr_ledger_entries()` function, the cloning of the key variable of type `Rc<LedgerKey>` is not metered (other cloning of references are not metered either):
```rust
ttl_map = ttl_map.insert(key.clone(), ee, budget)?;
```

Also in the `invoke_host_function()` function, the cloning of the budget variable of type `Budget` is not metered:
```rust
let host = Host::with_storage_and_budget(storage, budget.clone());
```

**Severity:** Warning  
**Status:** Intended Behavior

### File(s)

rs-soroban-env/soroban-env-host/src/e2e_invoke.rs

### Location(s)

build_storage_map_from_xdr_ledger_entries()
build_storage_footprint_from_xdr()
invoke_host_function()

### Impact

The cost of non-metered operations is paid by nodes and not users.

## Recommendation

Either meter the operations or document in the code why metering them is not necessary.

## Developer Response

Many operations in the code are non-metered even when they are operations which are being run on a node during enforcement time. The developers chose to make some small constant cost operations (such as a clone of a reference cell) unmetered, as the cost of metering would be higher than it is worth and it should not be possible (or at least not practical) to exploit these cheap unmetered operations to perform any real attack.