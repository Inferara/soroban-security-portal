# Unchecked Arithmetic in Metered Map

The Soroban Host uses metered data structures to account for computation from smart contracts. One data structure used is called a Metered Map which is a Map for which all the usual operations are augmented to track computation and memory allocations.

However, the arithmetic used to track the resources used by the metered map operations are not checked. In Rust, by default, arithmetic can overflow without throwing an error and by using unchecked arithmetic when tracking resources can potentially allow users to bypass their resource limits via overflow.

**Severity:** Medium

**Type:** Unchecked Arithmetic

## **File(s)**

rs-soroban-env/soroban-env-host/src/host/metered_map.rs

## **Impact**

By using unchecked arithmetic users could, in principle, bypass their budget limitations by allocating sufficiently large maps and adding to/deleting/resizing existing maps.

The impact is mitigated by the fact that the user must first successfully allocate a map of large enough size to allow the budget to potentially overflow which would cost the user a significant amount in the first place.

## **Recommendation**

We recommend changing all arithmetic in the map to use saturating addition or checked addition.

## **Status**

Fixed (Commit: c29b5a1, Original: 2674d86)

## **Developer Response**

The developers have acknowledged this issue and plan to fix it.
