# Denial of Service During Authorization

In Soroban, contracts can request authorization for requests by invoking `request_auth` on an address. If that address corresponds to a contract, the authorization module will invoke the `__check_auth` function of that module which is responsible for accepting or rejecting the requested authorization.

As indicated in the documentation and related examples, it is usually frowned upon for the `__check_auth` function to call `require_auth` on its own address, as this can lead to infinite recursion. The concern here is that an attacker can abuse this frowned upon behavior to cause the algorithm to spent a disproportionate amount of time evaluating authorizations, very little of which is metered to the caller.

In particular, suppose there is a contract whose implementation of `__check_auth` simply calls `require_auth` on its own address. This will lead to repeated invocations of the `require_auth_enforcing` function, which has the following loop:

```rust
for tracker in self.try_borrow_account_trackers(host)?.iter() {
// Tracker can only be borrowed by the authorization manager itself.
// The only scenario in which re-borrow might occur is when
// 'require_auth' is called within '__check_auth' call. The tracker
// that called '__check_auth' would be already borrowed in such
// scenario.
// We allow such call patterns in general, but we don't allow using
// tracker to verify auth for itself, i.e. we don't allow something
// like address.require_auth()->address_contract.__check_auth()
// ->address.require_auth(). Thus we simply skip the trackers that
// have already been borrowed.
if let Ok(mut tracker) = tracker.try_borrow_mut() {
// If tracker has already been used for this frame or the address
// doesn't match, just skip the tracker.
if !host.compare(&tracker.address, &address)?.is_eq() {
continue;
}
match tracker.maybe_authorize_invocation(host, function, !has_active_tracker) {
// If tracker doesn't have a matching invocation,
// just skip it (there could still be another
// tracker that matches it).
Ok(false) => continue,
// Found a matching authorization.
Ok(true) => return Ok(()),
// Found a matching authorization, but another
// requirement hasn't been fulfilled (for
// example, incorrect authentication or nonce).
Err(e) => return Err(e),
}
}
}
```

Informally, this loop iterates over each of the trackers (which are derived from the user provided invocation signature tree) attempting to match the current call to one of the trackers. If the authorization succeeds, the call is allowed as usual. If the call fails, we either continue or propagate an error if one has arisen.

If there is a call to `require_auth` within a `__check_call`, the call `tracker.maybe_authorize_invocation(host, function, !has_active_tracker)` could potentially call `require_auth_enforcing` again, which will again iterate through the trackers. Because each tracker is "borrowed" via that call to `tracker.try_borrow_mut()`, the same tracker cannot be used to match multiple calls to `require_auth` at once. However, specially crafted trackers and a recursive call to `require_auth` in `__check_auth` can still lead to a long (but finite) sequence of calls which can eat up significant resources of Stellar nodes with little cost to the user.

**Severity:** Critical

**Type:** Denial of Service

## **File(s)**

rs-soroban-env/src/auth.rs

## **Location(s)**

`require_auth_enforcing()`

## **Impact**

An attacker could use this vulnerability to perform a denial of service attack.

## **Status**

Invalid (Commit: 2674d86)

## **Developer Response**

It turns out that a failed call to `require_auth` in `__check_auth` will return an Err. As shown in the loop above, Errs are propagated up, meaning the number of iterations of this loop will be linear in the number of trackers. Because constructing a large number of trackers is costly to the attacker in other ways, this would be a costly attack to perform, and thus likely not worth it.
