# Vector push_front function works as intended

Given a random vector, `vec_push_front()` adds one element to the front of the vector (making that element the first element) accurately.

**Minutes Fuzzed:** 1440

**Bugs Found:** 0

## **File(s)**

rs-soroban-env/soroban-env-host/src/vec.rs

## **Scope**

We are testing type conversion functions in rs-soroban-env/soroban-env-host based on the tests in vec.rs which perform all the possible operations on vector types (e.g. `len()`, `pop()`, `push()`, etc.)

## **Specification**

Given a random vector, `vec_push_front()` adds one element to the front of the vector (making that element the first element) accurately. In our fuzz test, we push a random value to the vector and check equality of the first value of the host vector object and the random value and check that the length of the vector has increased by one.