## Primitive u64 conversion works as intended

**Minutes Fuzzed:** 480  
**Bugs Found:** 0  

### Scope
We are testing type conversion functions in `rs-soroban-env/soroban-env-host` based on the
`basic.rs` tests which take a fixed primitive value (like `u64`, `i64`), convert it into a host
value, convert it back, and check equality.

### Specification
Given any integer within a set of `u64` integers, converting it into a host value and converting
it back does not change its value.
