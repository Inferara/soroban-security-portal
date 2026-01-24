Ledger Entries Deleted Arbitrarily

Severity: Critical  
Commit: 2674d86  
Type: Logic Error  
Status: Investigated  
Confirmed Fix At: N/A  

File(s)  
rs-soroban-env/soroban-env-host/src/e2e_invoke.rs  

Location(s)  
build_storage_footprint_from_xdr()  

In `InvokeHostFunctionOpFrame.cpp`, the following logic removes ledger entries that are declared in `footprint.readWrite` but are not returned by the host as modified entries:

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
