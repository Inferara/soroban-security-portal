# Non-Custodial Signer Solution - Crossmint

Halborn performed a security assessment of the Signer-Frames, Crossmint-SDK, Crossbit-main, and TEE-ts repositories for Crossmint's Non-Custodial Signer Solution.

## **Host MitM and Insecure Default Target Origin**

The host application could potentially intercept messages or spoof the origin if not properly restricted. Halborn identified that the default origin for `postMessage` calls within the signer frames was too permissive (e.g., using `*`), allowing a man-in-the-middle attacker or a malicious host page to inject or steal cross-origin data and compromise user sessions.

### Commit
`0ce33ca`

### File(s)
`packages/client/window/src/index.ts`

### Location(s)
`Line 123`

## **Recommendation**

Restrict the `targetOrigin` in all `window.postMessage` calls to the specific, trusted domain of the parent or child window. Implement a robust Content Security Policy (CSP) that defines allowed origins for frame communication.

## **Status**

Solved. Remediated in [PR 23](https://github.com/Crossmint/open-signer/pull/23), [PR 20](https://github.com/Crossmint/open-signer/pull/20), and Crossmint-SDK [PR 1265](https://github.com/Crossmint/crossmint-sdk/pull/1265).

---

## **Environment Parameter Tampering via URL Override**

An attacker can override configuration parameters through query strings (e.g., `?environment=development`), causing the backend to operate in an unintended environment. This could expose sensitive functionality or disable production security safeguards by tricking the application into using test or staging configurations.

### Commit
`a2efd29`

### File(s)
`apps/crossmint-nextjs/src/api/wallets/ncs.controller.ts`

### Location(s)
`Query parameter parsing logic`

## **Recommendation**

Strictly validate all environment parameters and ensure they cannot be overridden via user-controlled input like URL query strings. Use server-side environment variables that are immutable at runtime for critical environment configurations.

## **Status**

Solved. Remediated in [PR 35](https://github.com/Crossmint/signer-frames/pull/35) and [PR 1204](https://github.com/Crossmint/crossmint-sdk/pull/1204).

---

## **Lack of Content Security Policy and Frame-Ancestor Protection**

The absence of a Content Security Policy (CSP) and clickjacking protections (e.g., `X-Frame-Options` or `frame-ancestors` directive) permits the application to be embedded in hostile iframes. This could lead to clickjacking attacks, arbitrary script execution, and data theft by malicious parent pages.

### Commit
`a2efd29`

### File(s)
`apps/crossmint-nextjs/src/api/wallets/ncs.controller.ts`

### Location(s)
`Response headers configuration`

## **Recommendation**

Implement a strict Content Security Policy (CSP) that includes the `frame-ancestors` directive to whitelist trusted domains that are allowed to embed the signer frames. Set the `X-Frame-Options` header to `SAMEORIGIN` or `DENY` where appropriate.

## **Status**

Solved. Remediated in [PR 28](https://github.com/Crossmint/open-signer/pull/28).

---

## **Potential Arbitrary JavaScript Injection**

Unescaped user input is reflected into the HTML of the signer frames, enabling the execution of attacker-supplied JavaScript. Improper control of `injectedGlobals` or other shared properties could lead to a full compromise of the victim’s browser session within the WebView context.

### Commit
`0ce33ca`

### File(s)
`packages/client/window/src/index.ts`

### Location(s)
`Global variable injection logic`

## **Recommendation**

Ensure all user-supplied data is properly sanitized and escaped before being reflected in HTML or used to define global variables. Use safe APIs for injecting data into the window context and avoid direct string concatenation for script tags.

## **Status**

Solved. Remediated in [PR 1268](https://github.com/Crossmint/crossmint-sdk/pull/1268).

---

## **Potential Authentication Bypass with ACCESS_SECRET Unset**

When the `ACCESS_SECRET` shared secret is missing or unset in the configuration, the server skips verification of the authentication signature. This allows an unauthenticated caller to impersonate any user by simply omitting the secret or providing an empty value, bypassing the intended security controls.

### Commit
`a2efd29`

### File(s)
`apps/crossmint-nextjs/src/api/wallets/ncs.controller.ts`

### Location(s)
`Authentication middleware`

## **Recommendation**

Enforce the presence of `ACCESS_SECRET` and ensure the authentication logic fails securely if the secret is missing or incorrectly configured. Never allow authentication to succeed in a "null" or "unset" state for the shared secret.

## **Status**

Solved. Remediated in [PR 29](https://github.com/Crossmint/open-signer/pull/29).

---

## **Log Injection and Use of X-Forwarded-For**

User-controlled strings are logged without sanitization, and the application relies on the `X-Forwarded-For` header for identifying client IPs without proper validation. Attackers can forge IP addresses, insert fake log entries, and mislead incident responders or automated monitoring systems.

### Commit
`a2efd29`

### File(s)
`apps/crossmint-nextjs/src/api/wallets/ncs.controller.ts`

### Location(s)
`Logging and IP detection logic`

## **Recommendation**

Sanitize all user-controlled data before logging to prevent log injection attacks. Avoid relying on the `X-Forwarded-For` header for security-critical decisions unless it is provided by a trusted proxy that is verified to strip attacker-supplied values.

## **Status**

Solved. Remediated in [PR 30](https://github.com/Crossmint/open-signer/pull/30).

---

## **Excessive Exposure of Key Shares**

Key fragments and shares are exposed in the browser's memory after successful derivation. A potential attacker who has compromised the user's computer (e.g., via malware) could extract these shares from a memory dump or via debuggers, potentially reconstructing the private key.

### Commit
`0ce33ca`

### File(s)
`packages/client/window/src/index.ts`

### Location(s)
`Memory management during key derivation`

## **Recommendation**

Minimize the time key material spends in memory and explicitly zero out or overwrite memory locations containing sensitive keys immediately after use. Use more secure storage methods if persistence is required, or keep keys within isolated environments like Web Workers where possible.

## **Status**

Solved. Remediated in [PR 14](https://github.com/Crossmint/open-signer/pull/14), [PR 15](https://github.com/Crossmint/open-signer/pull/15), and [PR 19](https://github.com/Crossmint/open-signer/pull/19).

---

## **Insecure Storage of Cryptographic Keys in localStorage**

Cryptographic keys and sensitive session data are persisted in `localStorage`. Persisting keys client-side in an unencrypted or loosely protected format exposes them to theft via cross-site scripting (XSS) attacks or physical access to the device, undermining the non-custodial security model.

### Commit
`0ce33ca`

### File(s)
`packages/client/window/src/index.ts`

### Location(s)
`Persistence layer`

## **Recommendation**

Avoid storing sensitive cryptographic keys in `localStorage`. Use more secure browser storage mechanisms like `IndexedDB` with encryption, or leverage the `Web Crypto API` to keep keys in a non-exportable state.

## **Status**

Solved. Remediated in [PR 14](https://github.com/Crossmint/open-signer/pull/14).

---

## **Hardcoded and Weak Secret**

The application uses a hardcoded or low-entropy static secret for certain internal authentication or encryption tasks. Static secrets are easily discovered during reverse engineering, and weak secrets enable attackers to brute-force credentials offline in a short period.

### Commit
`a2efd29`

### File(s)
`libraries/products/wallets/ncs/src/secrets.ts`

### Location(s)
`Static secret definition`

## **Recommendation**

Replace hardcoded secrets with dynamic, high-entropy values sourced from a secure environment variable or a dedicated secret management service. Ensure all cryptographic secrets meet industry standards for entropy and length.

## **Status**

Solved. Remediated in [PR 19635](https://github.com/Paella-Labs/crossbit-main/pull/19620).

---

## **Potential XSS and Reverse-Tabnabbing**

Unsanitized URL parameters and unguarded `target="_blank"` links allow for script injection and phishing attacks. Malicious sites can use `window.opener` to redirect the parent tab to a fraudulent page (reverse-tabnabbing) when the user clicks an external link within the signer frame.

### Commit
`0ce33ca`

### File(s)
`packages/client/window/src/ui/Links.tsx`

### Location(s)
`Anchor tag rendering`

## **Recommendation**

Always use `rel="noopener noreferrer"` for all `target="_blank"` links to prevent reverse-tabnabbing. Sanitize all URL parameters before using them in the UI to prevent DOM-based XSS attacks.

## **Status**

Solved. Remediated in [PR 1272](https://github.com/Crossmint/crossmint-sdk/pull/1272).

---

## **IDOR in Public Key Derivation**

Predictable identifiers are used in the public key derivation requests, potentially allowing one tenant or user to request another user's key material. This horizontal privilege escalation could allow attackers to derive public keys they should not have access to.

### Commit
`a2efd29`

### File(s)
`apps/crossmint-nextjs/src/api/wallets/ncs.controller.ts`

### Location(s)
`Key derivation endpoint`

## **Recommendation**

Implement strict authorization checks to ensure that the calling user or tenant is authorized to access the requested key material. Use non-predictable, cryptographically strong identifiers (e.g., UUIDs) for sensitive resources.

## **Status**

Not Applicable / Solved. Remediated in the shared NCS logic.

---

## **Lack of Rate Limiting**

The NCS endpoints lack adequate rate limiting for authentication attempts and API requests. This facilitates credential-stuffing attacks, brute-force attempts on secrets, and potential resource exhaustion (Denial of Service).

### Commit
`a2efd29`

### File(s)
`apps/crossmint-nextjs/src/api/wallets/ncs.controller.ts`

### Location(s)
`API routes configuration`

## **Recommendation**

Implement rate limiting at both the API Gateway and the application level for all sensitive endpoints. Use a combination of IP-based and user-based limits to mitigate automated attacks.

## **Status**

Solved. Remediated in [PR 19622](https://github.com/Paella-Labs/crossbit-main/pull/19622).

---

## **Attestation Response Replay Attack**

Previously captured attestation tokens can be replayed to gain illegitimate trust and bypass integrity checks. The lack of a nonce or timestamp validation in the attestation process allows an attacker to reuse a valid challenge-response from a previous session.

### Commit
`a2efd29`

### File(s)
`libraries/products/wallets/ncs/src/attestation.ts`

### Location(s)
`Attestation verification logic`

## **Recommendation**

Include a unique, short-lived nonce in each attestation challenge and verify that the response contains the expected nonce. Implement timestamp checks to ensure attestation tokens have a limited validity window.

## **Status**

Solved. Remediated in [PR 39](https://github.com/Crossmint/open-signer/pull/39).

---

## **Potential Timing-Attack on Shared-Secret Comparison**

The application uses a standard string comparison for validating the shared secret, which is measurable and susceptible to timing attacks. By analyzing the time differences in processing, an attacker could potentially reveal partial bytes of the secret over many attempts.

### Commit
`a2efd29`

### File(s)
`libraries/products/wallets/ncs/src/auth.ts`

### Location(s)
`Secret comparison logic`

## **Recommendation**

Use a constant-time comparison function (e.g., `crypto.timingSafeEqual` in Node.js) for all security-critical comparisons, especially shared secrets and cryptographic hashes.

## **Status**

Solved. Remediated in [PR 16](https://github.com/Crossmint/open-signer/pull/16).

---

## **Lack of Message Origin Validation**

The application processes `postMessage` events without strictly verifying the sender's domain (origin). This allows malicious third-party sites that have embedded the crossmint frame to trigger privileged actions or manipulate the internal state via cross-site request forgery.

### Commit
`0ce33ca`

### File(s)
`packages/client/window/src/index.ts`

### Location(s)
`Message event listener`

## **Recommendation**

Always check the `event.origin` property in `postMessage` event listeners and only process messages from a predefined whitelist of trusted origins.

## **Status**

Risk Accepted. Crossmint has documented the trade-offs and implemented alternative mitigations where full origin validation was not feasible.

---

## **Master Keys Not Explicitly Removed from Memory**

Sensitive master keys remain in RAM after their primary use is completed. In the event of a memory dump, crash report, or a successful exploit allowing local memory access, these keys could be exposed to an attacker.

### Commit
`a2efd29`

### File(s)
`libraries/products/wallets/ncs/src/keys.ts`

### Location(s)
`Key lifecycle management`

## **Recommendation**

Explicitly clear or zero out memory containing master keys as soon as they are no longer needed for a specific cryptographic operation.

## **Status**

Solved.

---

## **Too Much Data Shared in Attestation**

The attestation payload includes unnecessary user attributes and system metadata, increasing the privacy risk and the potential blast radius if the payload is intercepted or leaked.

### Commit
`a2efd29`

### File(s)
`libraries/products/wallets/ncs/src/attestation.ts`

### Location(s)
`Attestation payload construction`

## **Recommendation**

Follow the principle of least privilege and only include the minimum necessary data in the attestation payload. Remove any personally identifiable information (PII) or internal system details that are not strictly required for verification.

## **Status**

Solved.

---

## **Missing event.source Validation Allows Same-Origin Message Spoofing**

The application fails to validate the `event.source` property of incoming messages. Attackers executing code within the same domain (e.g., via a different iframe or a subdomain) could forge trusted messages that appear to come from the application's own frame.

### Commit
`0ce33ca`

### File(s)
`packages/client/window/src/index.ts`

### Location(s)
`Message event listener`

## **Recommendation**

Validate that the `event.source` matches the expected window object (e.g., the parent window or a specific reference) in addition to verifying the `event.origin`.

## **Status**

Solved. Remediated in [PR 1282](https://github.com/Crossmint/crossmint-sdk/pull/1282).

---

## **Weak Randomness**

The application uses non-cryptographic random generators (like `Math.random()`) to produce sensitive tokens or identifiers. This makes the generated values predictable, reducing the effort required for an attacker to perform brute-force or prediction attacks.

### Commit
`a2efd29`

### File(s)
`libraries/products/wallets/ncs/src/utils.ts`

### Location(s)
`Random value generation`

## **Recommendation**

Use cryptographically secure pseudo-random number generators (CSPRNG) like `crypto.getRandomValues()` in the browser or the `crypto` module in Node.js for all security-relevant values.

## **Status**

Solved. Remediated in [PR 1276](https://github.com/Crossmint/crossmint-sdk/pull/1276).

---

## **Excessive Error Information Exposed to Caller**

The application exposes detailed stack traces, internal configuration values, and implementation details in its error responses. This information can be used by an attacker to map the internal architecture and identify further vulnerabilities.

### Commit
`a2efd29`

### File(s)
`apps/crossmint-nextjs/src/api/wallets/ncs.controller.ts`

### Location(s)
`Global error handler`

## **Recommendation**

Implement a generic error handling strategy that returns only sanitized, non-descriptive error messages to the client while logging the full details internally for debugging.

## **Status**

Solved. Remediated in [PR 31](https://github.com/Crossmint/open-signer/pull/31).

---

## **Sensitive Data Logged to Console**

Debug logging statements output secrets, keys, and session data directly to the browser console. This risks inadvertent disclosure if an attacker convinces a user to share their console logs or if logs are captured by monitoring tools.

### Commit
`0ce33ca`

### File(s)
`packages/client/window/src/index.ts`

### Location(s)
`Console logging statements`

## **Recommendation**

Remove all sensitive data from console logs and ensure that logging is disabled or strictly limited in production environments.

## **Status**

Solved. Remediated in [PR 33], [PR 5], and [PR 19620].

---

## **DoS via Uncontrolled Memory Allocation**

Large input sizes provided to certain endpoints can cause high memory consumption, potentially leading to a Denial of Service (DoS) by crashing the worker processes or exhausting system resources.

### Commit
`a2efd29`

### File(s)
`apps/crossmint-nextjs/src/api/wallets/ncs.controller.ts`

### Location(s)
`Request body parsing`

## **Recommendation**

Implement size limits for all incoming requests and use streaming parsers for large data sets to avoid loading the entire payload into memory at once.

## **Status**

Solved. Remediated in [PR 34](https://github.com/Crossmint/open-signer/pull/34).

---

## **Other Documentation Issues**

Halborn identified several areas in the technical documentation that were either incomplete, outdated, or lacked sufficient detail regarding security best practices for integrators. Incomplete documentation can lead to insecure implementation of the Non-Custodial Signer Solution by third-party developers.

### Commit
`6f01641`

### File(s)
`README.md`

### Location(s)
`Technical documentation`

## **Recommendation**

Review and update the technical documentation to ensure all security-critical information is accurate, up-to-date, and clearly explained. Provide comprehensive implementation guides and security checklists for developers integrating the NCS solution.

## **Status**

Solved.

---

## **Potential Production DoS Bug**

A concurrency flaw in the handling of signing requests could allow a high-rate attacker to exhaust worker threads or locks, significantly degrading the availability of the service.

### Commit
`a2efd29`

### File(s)
`libraries/products/wallets/ncs/src/signing.ts`

### Location(s)
`Concurrency control logic`

## **Recommendation**

Optimize the concurrency logic and implement request queuing or backpressure mechanisms to handle high loads gracefully without exhausting system resources.

## **Status**

Solved.

---

## **Over-Privileged ACCESS_SECRET**

The `ACCESS_SECRET` shared secret grants broader access permissions than are strictly required for its intended use case, increasing the potential impact if the secret were to be compromised.

### Commit
`a2efd29`

### File(s)
`apps/crossmint-nextjs/src/api/wallets/ncs.controller.ts`

### Location(s)
`Permission check logic`

## **Recommendation**

Implement more granular access controls and scope the permissions granted by secrets to the minimum necessary for the specific function they are authorizing.

## **Status**

Solved.

---

## **Deterministic Generation of Master Keys**

Master keys are derived deterministically from a set of inputs including the private key, `authId`, and `signerId`. While this allows for reproducible key generation across different sessions, it could potentially weaken the uniqueness of keys across different deployments or user contexts.

### Commit
`a2efd29`

### File(s)
`libraries/products/wallets/ncs/src/keys.ts`

### Location(s)
`Key derivation algorithm`

## **Recommendation**

Consider adding more entropy or unique salt values to the key derivation process to ensure that master keys are as unique as possible.

## **Status**

Risk Accepted. Crossmint clarified that deterministic generation is a core requirement for their platform architecture and the underlying private keys are isolated in a TEE.
.
