## Map keys/values functions work as intended

**Severity:** Info  
**Minutes Fuzzed:** 300  
**Bugs Found:** 0  
**Type:** Fuzzed Specification  
**Status:** Open  
**File(s):** `rs-soroban-env/soroban-env-host`  
**Location(s):** N/A  
**Confirmed Fix At:** N/A  

We are testing type conversion functions in `rs-soroban-env/soroban-env-host` based on the `map.rs` tests, performing the possible operations on the map types.

### Specification
Verifies that calling `map_keys()` and `map_values()` on any correctly constructed map will return the keys and the values inside the map respectively.
