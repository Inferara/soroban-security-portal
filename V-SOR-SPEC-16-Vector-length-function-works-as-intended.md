# Vector length function works as intended

Given a random vector, `vec_len()` function returns the random vector's length accurately.

**Minutes Fuzzed:** 1440

**Bugs Found:** 0

## **File(s)**

rs-soroban-env/soroban-env-host/src/vec.rs

## **Scope**

We are testing type conversion functions in rs-soroban-env/soroban-env-host based on the tests in vec.rs which perform all the possible operations on vector types (e.g. `len()`, `pop()`, `push()`, etc.)

## **Specification**

Given a random vector, `vec_len()` function, which checks a given vector's length returns the random vector's length accurately. In our fuzz test, we have assertions that check the equality of the length of the random Rust vector and the length of the host vector object converted from the random vector.