# Vector append function works as intended

Given two random vectors, `vec_append()` appends two vectors accurately.

**Minutes Fuzzed:** 1440

**Bugs Found:** 0

## **File(s)**

rs-soroban-env/soroban-env-host/src/vec.rs

## **Scope**

We are testing type conversion functions in rs-soroban-env/soroban-env-host based on the tests in vec.rs which perform all the possible operations on vector types (e.g. `len()`, `pop()`, `push()`, etc.)

## **Specification**

Given two random vectors, `vec_append()` appends two vectors accurately. In our fuzz test, we check that the length of this new vector is equal to the sum of the length of two vectors; and ordering of the elements is the same. For example, we check that the first vector with the length n matches with the first n elements of the new vector and the rest matches with the second vector.