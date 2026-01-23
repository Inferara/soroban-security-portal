## Map insert/delete functions work as intended

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
Verifies that calling `map_put()` and `map_del()` on any properly constructed mapping will correctly insert and delete elements respectively. We check that calling `map_put()` with a key not present in the map will insert the value at the new key and that calling `map_del()` with a key present in the map will remove that entry from the map.
