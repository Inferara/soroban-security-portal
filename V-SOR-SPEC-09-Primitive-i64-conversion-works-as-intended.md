# Primitive i64 conversion works as intended

Given any integer within a set of i64 integers, converting it into a host value and converting it back does not change its value.

**Minutes Fuzzed:** 480

**Bugs Found:** 0

## **File(s)**

rs-soroban-env/soroban-env-host/src/basic.rs

## **Scope**

We are testing type conversion functions in rs-soroban-env/soroban-env-host based on the basic.rs tests which take a fixed primitive value (like u64, i64, etc.), convert it into a host value, convert it back and check equality.

## **Specification**

Given any integer within a set of i64 integers, converting it into a host value and converting it back does not change its value.
