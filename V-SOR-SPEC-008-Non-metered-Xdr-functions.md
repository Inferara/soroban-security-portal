# Non-metered Xdr functions work as intended

In stellar-core, we are testing the XDR conversion in non-metered functions by generating random ScVal objects and testing to see whether the read/write depth limits are enforced and whether the objects pre and post conversion are the same.

**Minutes Fuzzed:** 4320

**Bugs Found:** 0

## **File(s)**

stellar-core/src/rust/

## **Scope**

The scope of the tests include the non-metered functions (`non_metered_xdr_to_rust_buf()` and `non_metered_xdr_from_cxx_buf()`) in stellar-core module.

## **Specification**

In stellar-core, we are testing the XDR conversion in non-metered functions (`non_metered_xdr_to_rust_buf()` and `non_metered_xdr_from_cxx_buf()`) by generating random ScVal objects defined in generated.rs and testing to see whether the read/write depth limits are enforced and whether the objects pre and post conversion are the same.
