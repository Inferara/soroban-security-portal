## Address-to-string conversions work as intended

**Severity:** Info  
**Minutes Fuzzed:** 480  
**Bugs Found:** 0  
**Type:** Fuzzed Specification  
**Status:** Open  
**File(s):** `rs-soroban-env/soroban-env-host`  
**Location(s):** N/A  
**Confirmed Fix At:** N/A  

We are testing type conversion functions in `rs-soroban-env/soroban-env-host` based on the `address.rs` tests which take a fixed list of hexadecimal values between 0 and 255 and convert it into a string using the address conversion functions of the host.

### Specification
Two features of string-to-address conversion are tested:

1. A fuzzed address object is created, converted to a string, and then converted back to an address object. The two addresses are asserted to be the same.  
2. Invalid address strings (not the correct length) are tested to ensure they always error out.
