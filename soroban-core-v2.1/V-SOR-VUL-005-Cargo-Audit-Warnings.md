# Cargo Audit Warnings

`cargo audit` gives a warning for the package bumpalo due to a potential use after free due to an issue with `Vec::into_iter()`. It also gives warnings for a couple dependencies of the package textplots.

**Severity:** Info

**Type:** Maintainability

## **File(s)**

rs-stellar-xdr, rs-soroban-env

## **Impact**

Upgrading the dependencies will improve maintainability by avoiding the potential errors caused by these issues.

## **Recommendation**

Run `cargo update -p bumpalo` for rs-stellar-xdr avoid the risk of this memory error.

Updating the packages textplots and colored for rs-soroban-env will resolve the warnings for this repository.

Both projects build and pass all tests with these updates.

## **Status**

Acknowledged (Commit: 16f4d7c)

## **Developer Response**

For the bumpalo dependency, developer's indicated they are not concerned with the issue at this time as it is compile-time. As for textplots and colored, these are only [dev-dependencies] which are used for tests. As a result they will wait to address these concerns at the next "protocol boundary".

