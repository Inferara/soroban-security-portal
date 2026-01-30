# Bytes operations work as intended

**Minutes Fuzzed:** 480

**Bugs Found:** 0

## **Scope**

We are testing the functions in rs-soroban-env/soroban-env-host based on the bytes.rs tests.

## **Specification**

Here we test a variety of the APIs that are implemented for bytes, such as `bytes_push` and `bytes_len`. For each API, we check that the behavior matches the expected behavior as indicated in the original tests.
