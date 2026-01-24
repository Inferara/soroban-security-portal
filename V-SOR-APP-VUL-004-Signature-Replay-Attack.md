### A.2.3 V-SOR-APP-VUL-004: Signature Replay Attack

**Severity:** High  
**Commit:** 16f4d7c  
**Type:** Data Validation  
**Status:** Investigated  
**Confirmed Fix At:** N/A  

**File(s):**  
`rs-stellar-xdr/src/next/generated.rs`  

**Location(s):** N/A  

**Description:**  
`SorobanAddressCredentials` contains a signature expiration ledger and a nonce for each signature. These credentials are stored temporarily on the ledger and erased after expiration.  

If the signature is not hashed with a timestamp, an attacker could reuse an expired signature to replay a previous transaction.

**Impact:**  
A reusable signature could allow attackers to replay transactions and potentially steal funds.

**Recommendation:**  
Hash the signature with a timestamp for each transaction, so reuse after expiration can be detected even if the previous nonce/expiration has been erased.

**Why Invalid:**  
Developers confirmed that the signature is already hashed with a timestamp, preventing this attack.
