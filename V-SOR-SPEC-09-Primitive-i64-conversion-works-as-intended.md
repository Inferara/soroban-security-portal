Primitive i64 conversion works as intended

We are testing type conversion functions in `rs-soroban-env/soroban-env-hos` based on the `basic.rs` tests which take a fixed primitive value (like `u64`, `i64`, etc.), convert it into a host value, convert it back and check equality.

Given any integer within a set of `i64` integers, converting it into a host value and converting it back does not change its value.

## Metadata
**Scope**  
Type conversion functions in `rs-soroban-env/soroban-env-host`

**Test File**  
`basic.rs`

**Test Duration**  
480 minutes fuzzed

**Bugs Found**  
0
