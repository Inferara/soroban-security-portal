## Tuple value conversion works as intended

Minutes Fuzzed 480 Bugs Found 0
Scope We are testing type conversion functions in `rs-soroban-env/soroban-env-host` based on the `basic.rs` tests which take a fixed primitive value (like `u64`, `i64`), convert it into a host value, convert it back and check equality.
Specification Given any tuple containing `u64` and `i64` integers, converting it into a host value and converting it back does not change its value.

**File(s)**  
`rs-soroban-env/soroban-env-host`

**Location(s)**  
`basic.rs` test file

**Test Duration**  
480 minutes

**Bugs Found**  
0
