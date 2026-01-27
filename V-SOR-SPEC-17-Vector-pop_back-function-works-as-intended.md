## Vector pop_back function works as intended

Minutes Fuzzed 1440 Bugs Found 0
Scope We are testing type conversion functions in `rs-soroban-env/soroban-env-host` based on the tests in `vec.rs` which perform all the possible operations on vector types (e.g. `len()`, `pop()`, `push()`, etc.)
Specification Given a random vector, `vec_pop_back()` removes the last element of the vector accurately. In our fuzz test, we check that the length of the vector has decreased by one and the list is not altered in any way except the last element.

**File(s)**  
`rs-soroban-env/soroban-env-host`

**Location(s)**  
`vec.rs` test file  
`vec_pop_back()` function

**Test Duration**  
1440 minutes

**Bugs Found**  
0
