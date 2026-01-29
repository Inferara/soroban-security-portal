# Buffer to Xdr conversions cause no crashes

In stellar-core, we are testing to see if converting random cxxbuf objects (which are random arrays containing u8 values) to random objects would cause any crashes on `non_metered_xdr_from_cxx_buf()` functions.

**Minutes Fuzzed:** 4320

**Bugs Found:** 0

## **File(s)**

stellar-core/src/rust/

## **Scope**

The scope of tests on this specification include buffer-to-xdr conversion function `non_metered_xdr_from_cxx_buf()` in stellar-core module.

## **Specification**

In stellar-core, we are testing to see if converting random cxxbuf objects (which are random arrays containing u8 values) to random objects would cause any crashes on `non_metered_xdr_from_cxx_buf()` functions.
