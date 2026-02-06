# Signature Replay Attack

SorobanAddressCredentials contains a signature expiration ledger and a nonce for each signature. These credentials are only stored on the ledger as temporary values so they will be completely erased once they expire. As a result, if the signature itself isn't hashed with an expiration date or timestamp, there would be no way to know if an attacker reuses a previous signature that has expired off of the ledger to replay a previous transaction on behalf of a user who had executed that transaction in the past.

**Severity:** High

**Type:** Data Validation

## **File(s)**

rs-stellar-xdr/src/next/generated.rs

## **Impact**

If this signature can be reused for a replay attack, this could allow attackers to steal funds etc. If the signature cannot be reused, then there is no vulnerability.

## **Recommendation**

Hash the signature with some timestamp for the transaction, so that if the signature is reused later in time, it is possible to know that the signature has expired, even if the previous nonce/expiration timestamp have been erased from the ledger.

## **Status**

Invalid (Commit: 16f4d7c)

## **Developer Response**

Developers have indicated that the signature is already hashed with a timestamp that would prevent such an attack.