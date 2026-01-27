## Vector push_back function works as intended

Minutes Fuzzed 1440 Bugs Found 0
Scope We are testing type conversion functions in `rs-soroban-env/soroban-env-host` based on the tests in `vec.rs` which perform all the possible operations on vector types (e.g. `len()`, `pop()`, `push()`, etc.)
Specification Given a random vector and a random value, `vec_push_back()` adds the value to the end of the vector accurately. In our fuzz test, we check that the length of the vector has increased by one and that the added element is equal to the given value.

**File(s)**  
`rs-soroban-env/soroban-env-host`

**Location(s)**  
`vec.rs` test file  
`vec_push_back()` function

**Test Duration**  
1440 minutes

**Bugs Found**  
0
