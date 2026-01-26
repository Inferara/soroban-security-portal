## Ledger Entries Deleted Arbitrarily

In InvokeHostFunctionOpFrame.cpp, we find the following code:
```cpp
// Erase every entry not returned.
// NB: The entries that haven't been touched are passed through
// from host, so this should never result in removing an entry
// that hasn't been removed by host explicitly.
for (auto const& lk : footprint.readWrite) {
  if (createdAndModifiedKeys.find(lk) == createdAndModifiedKeys.end())
  {
    auto ltxe = ltx.load(lk);
    if (ltxe)
    {
      releaseAssertOrThrow(isSorobanEntry(lk));
      ltx.erase(lk);

      // Also delete associated TTLEntry
      auto ttlLK = getTTLKey(lk);
      auto ttlLtxe = ltx.load(ttlLK);
      releaseAssertOrThrow(ttlLtxe);
      ltx.erase(ttlLK);
    }
  }
}
```

In this code, if a LedgerKey was declared in the `footprint.readWrite` but was not returned by the host as a modified key, then the code deletes the entry.

The array of modified LedgerKeys returned by Soroban is built in contract.rs, specifically in the `extract_ledger_changes()` function, where we can see the following:
```rust
for change in entry_changes {
  // Extract ContractCode and ContractData entry changes first
  if !change.read_only {

    if let Some(encoded_new_value) = change.encoded_new_value {
      modified_entries.push(encoded_new_value.into());
    }
  }
}
```

In this code, if the entry change is `readOnly` then the entry is NOT appended to the `modified_entries` vector. The `entry_changes` vector is built in the e2e_invoke.rs file in the `get_ledger_changes()` function, where at the end we can see the following:
```rust
let maybe_access_type: Option<AccessType> =
  footprint_map.get::<Rc<LedgerKey>>(key, budget)?.copied();

match maybe_access_type {
  Some(AccessType::ReadOnly) => {
    entry_change.read_only = true;
  }

  Some(AccessType::ReadWrite) => {
    if let Some((entry, _)) = entry_with_live_until_ledger {
      let mut entry_buf = vec![];
      metered_write_xdr(budget, entry.as_ref(), &mut entry_buf)?;
      entry_change.encoded_new_value = Some(entry_buf);
    }
  }

  None => {
    return Err(internal_error);
  }
}

changes.push(entry_change);
```

If the key in the `footprint_map` has an AccessType of ReadOnly then the `read_only` flag is set to true.

Now, we have the prerequisites needed to carry the attack of deleting a ledger entry with a LedgerKey key:

- The `footprint.readWrite` array in the context of the InvokeHostFunctionOpFrame.cpp code must contain the key.
- The `footprint_map` in the context of the e2e_invoke.rs code must contain the key but with an access type of `readOnly`.

To better understand, consider the `footprint_map` built using `build_storage_footprint_from_xdr()` in e2e_invoke.rs:
```rust
fn build_storage_footprint_from_xdr(
  budget: &Budget,
  footprint: LedgerFootprint,
) -> Result<Footprint, HostError> {
  let mut footprint_map = FootprintMap::new();

  for key in footprint.read_write.as_vec() {
    Storage::check_supported_ledger_key_type(&key)?;
    footprint_map = footprint_map.insert(
      Rc::metered_new(key.metered_clone(budget)?, budget)?,
      AccessType::ReadWrite,
      budget,
    )?;
  }

  for key in footprint.read_only.as_vec() {
    Storage::check_supported_ledger_key_type(&key)?;
    footprint_map = footprint_map.insert(
      Rc::metered_new(key.metered_clone(budget)?, budget)?,
      AccessType::ReadOnly,
      budget,
    )?;
  }

  Ok(Footprint(footprint_map))
}
```

Basically, it makes a for loop over `footprint.readWrite` and `footprint.read_only` and inserts them in the map. Because the read_write is processed before read_only if they both contain a repeated LedgerKey then the ReadOnly access type will be in the final `footprint_map`.

**Severity:** Critical  
**Status:** Invalid

### File(s)

rs-soroban-env/soroban-env-host/src/e2e_invoke.rs

### Location(s)

build_storage_footprint_from_xdr()

### Impact

An arbitrary Ledger Entry can be deleted from the ledger.

## Recommendation

Process first the `read_only` vector in the `build_storage_footprint_from_xdr()` function and then the `read_write`.

## Why Invalid

Given the severity, we tried to confirm the attack with a test. However, it failed and showed the error `txMalformed`. In the TransactionFrame.cpp we can find the following checking that `footprint.readOnly` and `footprint.readWrite` have no duplicates within and between them:
```cpp
// check for duplicates
UnorderedSet<LedgerKey> set;
auto checkDuplicates =
[&](xdr::xvector<stellar::LedgerKey> const& keys) -> bool {
  for (auto const& lk : keys)
  {
    if (!set.emplace(lk).second)
    {
      getResult().result.code(txMALFORMED);
      return false;
    }
  }
  return true;
};

if (!checkDuplicates(sorobanData.resources.footprint.readOnly) ||
    !checkDuplicates(sorobanData.resources.footprint.readWrite))
{
  return false;
}
```