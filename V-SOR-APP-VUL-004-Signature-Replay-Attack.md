##  Signature Replay Attack

**Severity:** High  
**Commit:** 16f4d7c  
**Type:** Data Validation  
**Status:** Investigated  
**Confirmed Fix At:** N/A  

**File(s):**  
`rs-stellar-xdr/src/next/generated.rs`  

**Location(s):** N/A  

**Impact:**  
A reusable signature could allow attackers to replay transactions and potentially steal funds.

**Recommendation:**  
Hash the signature with a timestamp for each transaction, so reuse after expiration can be detected even if the previous nonce/expiration has been erased.

**Why Invalid:**  
Developers confirmed that the signature is already hashed with a timestamp, preventing this attack.
