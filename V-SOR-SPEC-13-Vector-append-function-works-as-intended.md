Vector append function works as intended

Minutes Fuzzed 1440 Bugs Found 0
Scope We are testing type conversion functions in `rs-soroban-env/soroban-env-host` based on the tests in `vec.rs` which perform all the possible operations on vector types (e.g. `len()`, `pop()`, `push()`, etc.)
Specification Given two random vectors, `vec_append()` appends two vectors accurately. In our fuzz test, we check that the length of this new vector is equal to the sum of the length of two vectors; and ordering of the elements is the same. For example, we check that the first vector with the length `n` matches with the first `n` elements of the new vector and the rest matches with the second vector.

**File(s)**  
`rs-soroban-env/soroban-env-host`

**Location(s)**  
`vec.rs` test file  
`vec_append()` function

**Test Duration**  
1440 minutes

**Bugs Found**  
0
