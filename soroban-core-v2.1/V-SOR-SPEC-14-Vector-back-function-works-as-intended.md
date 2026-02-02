# Vector back function works as intended

Given a random vector, `vec_back()` function accurately returns the last element of the vector.

**Minutes Fuzzed:** 1440

**Bugs Found:** 0

## **File(s)**

rs-soroban-env/soroban-env-host/src/vec.rs

## **Scope**

We are testing type conversion functions in rs-soroban-env/soroban-env-host based on the tests in vec.rs which perform all the possible operations on vector types (e.g. `len()`, `pop()`, `push()`, etc.)

## **Specification**

Given a random vector, `vec_back()` function accurately returns the last element of the vector. In our fuzz test, we have assertions that check the equality of the last element of the random Rust vector and the result of the `vec_back()` of the host vector object converted from the random vector.
