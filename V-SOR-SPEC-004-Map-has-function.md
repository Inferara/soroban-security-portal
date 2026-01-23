## Map has function works as intended

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
Verify that if an `ScMap` is constructed correctly with some initial values, `map_has` will correctly determine whether or not a key is present in the Map.
