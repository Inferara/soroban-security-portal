## Non-metered Xdr functions work as intended

**Severity:** Info  
**Minutes Fuzzed:** 4320  
**Bugs Found:** 0  
**Type:** Fuzzed Specification  
**Status:** Open  
**File(s):** `stellar-core`  
**Location(s):** N/A  
**Confirmed Fix At:** N/A  

The scope of the tests include the non-metered functions `non_metered_xdr_to_rust_buf()` and `non_metered_xdr_from_cxx_buf()` in the `stellar-core` module.

### Specification
In `stellar-core`, we are testing the XDR conversion in non-metered functions (`non_metered_xdr_to_rust_buf()` and `non_metered_xdr_from_cxx_buf()`) by generating random `ScVal` objects defined in `generated.rs` and testing to see whether the read/write depth limits are enforced and whether the objects pre and post conversion are the same.
