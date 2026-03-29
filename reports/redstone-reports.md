
# RedStone: Stellar Connector – Vulnerability Report

Audit Source: https://sorobansecurity.com/report/68  
Audit Firm: Veridise  
Audit Date: October 2025  

---

## Address normalization via to_ascii_lowercase() allows unauthorized signature validation

The RedStone oracle system validates data package signatures by recovering the signer’s address from ECDSA signatures and checking if that address belongs to the authorized signer list configured in `Config`. The signature recovery process in `Crypto::recover_address()` recovers the public key from a signature, hashes it with Keccak256, and extracts the last 20 bytes to form an Ethereum-style address. This raw 20-byte address is then wrapped in a `SignerAddress` type via `SignerAddress::from(Vec<u8>)`.

The vulnerability exists in `SignerAddress::new()` at `signer_address.rs`. This function incorrectly applies `to_ascii_lowercase()` to the raw byte array representing the numeric address value. The `to_ascii_lowercase()` method treats any byte in the ASCII uppercase letter range (0x41-0x5A) as an ASCII character and transforms it to the corresponding lowercase value by adding 32 (0x20).

Since an Ethereum address is a 20-byte numeric value, not an ASCII-encoded string, applying ASCII case normalization corrupts the address data. When the recovered address contains any bytes in the range 0x41-0x5A, these bytes are modified, producing a different address than what was actually recovered from the signature.

File(s)  
`rust-sdk/crates/redstone/src/types/signer_address.rs`

Location(s)  
`SignerAddress::new()`

Severity: Low  
Type: Logic Error  
Status: Fixed  

Commit(s)  
This finding has been addressed in commit ID [e24a58a](https://github.com/redstone-finance/rust-sdk/pull/60).

Impact  
If an attacker controls a private key whose address matches the corrupted form of a legitimate signer’s address, they can create valid signatures that pass validation.

```rust
#[test]
fn test_signer_address_to_ascii_lowercase_issue() {

    let legitimate_signer_raw_address: [u8; 20] = hex!("8bb8f32df04c8b654987daaed53d6b6091e3b774");

    let malicious_signer_raw_address: [u8; 20] = hex!("8bb8f32df06c8b656987daaed53d6b6091e3b774");

    assert_ne!(legitimate_signer_raw_address, malicious_signer_raw_address);

    let legitimate_signer_address_converted: SignerAddress =
        legitimate_signer_raw_address.to_vec().into();

    let malicious_signer_address_converted: SignerAddress =
        malicious_signer_raw_address.to_vec().into();

    assert_eq!(
        legitimate_signer_address_converted,
        malicious_signer_address_converted
    );
}
````

## **Recommendation**

Remove the `to_ascii_lowercase()` call from `SignerAddress::new()` and ensure tests validate correct behavior.

## **Developer Response**

The developers implemented the suggested recommendation.

---

## Null byte injection enables feed ID spoofing

The RedStone adapter contract processes oracle price data in `get_prices_from_payload()` by calling `process_payload()`. This function returns validated price data containing `FeedValue` structs with a `FeedId` field.

The `feed_to_string()` function converts a `FeedId` to a `String` by splitting the byte array at the first null byte (0x00) and converting only the prefix. This assumes feed identifiers contain no null bytes in the middle of valid data.

If a `FeedId` contains embedded null bytes, the function truncates early, causing different feed IDs to resolve to the same string.

File(s)
`redstone-oracles-monorepo/.../utils.rs`

Location(s)
`feed_to_string()`

Severity: Low
Type: Logic Error
Status: Fixed

Commit(s)
This finding has been addressed in commit ID [e78b841](https://github.com/redstone-finance/redstone-oracles-monorepo/commit/e78b8415759bb7d8d0b31972051836451016a729).

Impact
An attacker can spoof legitimate feed IDs and overwrite valid price data.

```rust
#[test]
fn test_feed_to_string_simple() {
    let env = Env::default();

    let btc_feed_id_array: [u8; 32] = [
        66, 84, 67, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    let btc_feed_id = FeedId::from(btc_feed_id_array);
    let convert_btc_feed_id_to_string = feed_to_string(&env, btc_feed_id);

    let non_btc_feed_id_array: [u8; 32] = [
        66, 84, 67, 0, 67, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    let non_btc_feed_id = FeedId::from(non_btc_feed_id_array);
    let convert_non_btc_feed_id_to_string = feed_to_string(&env, non_btc_feed_id);

    assert_eq!(
        convert_btc_feed_id_to_string,
        convert_non_btc_feed_id_to_string
    );
}
```

## **Recommendation**

Validate that null bytes only appear as trailing padding and reject malformed `FeedId` values.

## **Developer Response**

The developers updated the implementation to trim correctly and prevent collisions.

---

## Two-step ownership transfer pattern not followed

The ownership transfer process is implemented as a single-step operation, immediately transferring ownership without requiring confirmation from the new owner.

File(s)
`redstone-oracles-monorepo/.../ownable.rs`

Location(s)
`ownership transfer logic`

Severity: Warning
Type: Usability Issue
Status: Fixed

Commit(s)
This finding has been addressed in commit ID [e7a9bc2](https://github.com/redstone-finance/redstone-oracles-monorepo/commit/e7a9bc257e364cff3b0e9c74ec3894c2ac95f4c8).

Impact
Mistakes in ownership transfer (e.g., incorrect address) can result in permanent loss of control.

## **Recommendation**

Implement a two-step ownership transfer requiring explicit acceptance by the new owner.

## **Developer Response**

The developers implemented the suggested recommendation.

---

## Missing ECDSA signature parameter validation

The implementation validates ECDSA signatures but does not enforce full parameter checks required by FIPS 186-5.

Specifically, it does not ensure:

* `r != 0`
* `s != 0`
* `r < n`

File(s)
`rust-sdk/crates/redstone/src/crypto/mod.rs`

Location(s)
`Crypto::recover_address()`

Severity: Warning
Type: Data Validation
Status: Fixed

Commit(s)
This finding has been addressed in commit IDs [3257c1a](https://github.com/redstone-finance/rust-sdk/pull/62) and [be93165](https://github.com/redstone-finance/rust-sdk/pull/63).

Impact

* Signature malleability
* Potential replay attacks
* Acceptance of invalid or forged signatures

## **Recommendation**

Implement explicit validation of `r` and `s` parameters according to FIPS 186-5.

## **Developer Response**

The developers implemented the suggested recommendation.

---

## Informational: Code Quality and Best Practice Issues

Multiple minor issues were identified:

1. Typographical error in error message:

   * `"Number to big"` instead of `"Number too big"`

2. Use of `init()` instead of `__constructor()` for contract initialization

File(s)

* `redstone-oracles-monorepo/.../lib.rs`
* `rust-sdk/crates/redstone/src/types/mod.rs`

Severity: Info
Type: Maintainability
Status: Acknowledged

Impact

* Reduced clarity
* Potential initialization front-running risk

## **Recommendation**

* Fix typo in error message
* Use `__constructor()` for contract initialization

## **Developer Response**

The developers acknowledged the issue but chose not to implement changes.
