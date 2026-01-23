## Map keys are stored in sorted order

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
To ensure determinism when accessing map elements by their index, verify that map entries are stored in sorted order based on their keys. We check that integer keys are stored in ascending order of the value of the integer and that keys of different types are sorted by the pre-defined ordering of the different types.
