# Vector pop_front function works as intended

Given a random vector, `vec_pop_front()` removes the first element of the vector accurately.

**Minutes Fuzzed:** 1440

**Bugs Found:** 0

## **File(s)**

rs-soroban-env/soroban-env-host/src/vec.rs

## **Scope**

We are testing type conversion functions in rs-soroban-env/soroban-env-host based on the tests in vec.rs which perform all the possible operations on vector types (e.g. `len()`, `pop()`, `push()`, etc.)

## **Specification**

Given a random vector, `vec_pop_front()` removes the first element of the vector accurately. In our fuzz test, we check that the length of the vector has decreased by one and the list is not altered in any way except the first element.
