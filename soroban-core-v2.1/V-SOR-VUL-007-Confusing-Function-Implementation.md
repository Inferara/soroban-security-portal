# Confusing Function Implementation

In Env, the function `check_val_integrity()` is used to perform validity checks on Vals. The function first calls `Val::is_good()` and then calls `check_obj_integrity()` to (presumably) perform additional validity checks on Vals corresponding to Objects.

The default implementation of `check_obj_integrity()` implementation just returns `Ok(())` without checking anything. This implementation is never used and is replaced in it's only use case in Host. As far as auditors can tell, this "dummy" implementation is never used.

```rust
/// Check that a ['Val'] is good according to the current Env. This is a
/// superset of calling 'Val::good' as it also checks that if the 'Val' is
/// an ['Object'], that the 'Object' is good according to
/// ['Self::check_obj_integrity'].
fn check_val_integrity(&self, val: Val) -> Result<(), Self::Error> {
if !val.is_good() {
return Err(self.error_from_error_val(Error::from_type_and_code(
ScErrorType::Value,
ScErrorCode::InvalidInput,
)));
}
if let Ok(obj) = Object::try_from(val) {
self.check_obj_integrity(obj)
} else {
Ok(())
}
}

/// Check that an Object handle is good according to the current Env. For
/// general Val-validity checking one should use Val::good().
fn check_obj_integrity(&self, _obj: Object) -> Result<(), Self::Error> {
Ok(())
}
```

Furthermore, it should be noted that the docstring for the function `check_val_integrity` references `Val::good` which is not a function in the code base — this should be updated to reference `Val::is_good` which is the name of the function it intends to call. The same is true of the docstring for `check_obj_integrity`.

**Severity:** Info

**Type:** Maintainability

## **File(s)**

rs-soroban-env/soroban-env-common/src/env.rs

## **Location(s)**

`check_obj_integrity()`

## **Impact**

If future developers use Env without reimplementing `check_obj_integrity()`, calling `check_val_integrity()` would just be a wrapper on `Val::is_good()` and would not check the object integrity which contradicts with the docstring in Env.

## **Recommendation**

We suggest to either mark that `check_obj_integrity()` is a dummy implementation or replace it with just a function definition which needs to be implemented explicitly.

## **Status**

Acknowledged (Commit: 9c53940)

## **Developer Response**

Developers pointed out that Env is actually implemented in rs-soroban-guest via a macro definition (as well as in another repository that was out of scope for this audit), so this "dummy" implementation of `check_obj_integrity` is actually used. The docstring issue is valid and developers intend to fix it.