# Address-to-string conversions work as intended

**Minutes Fuzzed:** 480

**Bugs Found:** 0

## **Scope**

We are testing type conversion functions in rs-soroban-env/soroban-env-host based on the address.rs tests which take a fixed list of hexadecimal values between 0 and 255 and convert it into a string using the address conversion functions of the host.

## **Specification**

In this case, we test two different features of string-to-address conversion. In the first case, we create a fuzzed address object. We then convert it to a string and back to an address object and assert that the two addresses created are the same. In the second case, we test that invalid address strings always error out (i.e., address strings that are not the correct length).
