## Invalid Maps will return an Error

**Severity:** Info  
**Minutes Fuzzed:** 600  
**Bugs Found:** 0  
**Type:** Fuzzed Specification  
**Status:** Open  
**File(s):** `rs-soroban-env/soroban-env-host`  
**Location(s):** N/A  
**Confirmed Fix At:** N/A  

We are testing type conversion functions in `rs-soroban-env/soroban-env-host` based on the `map.rs` tests, performing the possible operations on the map types.

### Specification
Verifies that any map initialized with duplicate keys, initialized with keys that are not in ascending order, or containing an invalid value will return an error.
