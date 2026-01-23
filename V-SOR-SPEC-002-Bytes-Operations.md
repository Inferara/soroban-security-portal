## Bytes operations work as intended

**Severity:** Info  
**Minutes Fuzzed:** 480  
**Bugs Found:** 0  
**Type:** Fuzzed Specification  
**Status:** Open  
**File(s):** `rs-soroban-env/soroban-env-host`  
**Location(s):** N/A  
**Confirmed Fix At:** N/A  

We are testing the functions in `rs-soroban-env/soroban-env-host` based on the `bytes.rs` tests.

### Specification
We test a variety of the APIs implemented for bytes, such as `bytes_push` and `bytes_len`.  
For each API, we check that the behavior matches the expected behavior as indicated in the original tests.
