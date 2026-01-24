### V-SOR-APP-VUL-002: Ledger Entries Deleted Arbitrarily

**Severity:** Critical  
**Commit:** 2674d86  
**Type:** Logic Error  
**Status:** Investigated  
**Confirmed Fix At:** N/A  

---

#### File(s)
- stellar-core/src/transactions/InvokeHostFunctionOpFrame.cpp

#### Location(s)
- applyOperation()

---

## Description

During the application of `InvokeHostFunctionOp`, ledger entries declared in
`footprint.readWrite` but not returned by the host as created or modified
entries are automatically erased.

The following logic removes such entries:

```cpp
// Erase every entry not returned.
for (auto const& lk : footprint.readWrite) {
    if (createdAndModifiedKeys.find(lk) == createdAndModifiedKeys.end()) {
        auto ltxe = ltx.load(lk);
        if (ltxe) {
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
