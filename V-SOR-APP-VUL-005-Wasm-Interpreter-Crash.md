## Wasm Interpreter Crash

**Severity:** High  
**Commit:** 2674d86  
**Type:** Denial of Service  
**Status:** Investigated  
**Confirmed Fix At:** N/A  

**File(s):** N/A  
**Location(s):** N/A  

**Description:**  
A crash occurs in the wasmi fuzz test with Rust nightly 1.76.0, using `wasm_smith` to generate random Wasm objects. The crash occurs in `ty_to_arg()` when converting Wasm function types to random values.

**Error message snippet:**  
```text
==51503== ERROR: libFuzzer: deadly signal
...
fn ty_to_arg(ty: &ValueType) -> Value {
    let mut rng = rand::thread_rng();
    match ty {
        ValueType::I32 => Value::I32(rng.gen::<i32>()),
        ValueType::I64 => Value::I64(rng.gen::<i64>()),
        ValueType::F32 => Value::F32(rng.gen::<f32>().into()),
        ValueType::F64 => Value::F64(rng.gen::<f64>().into()),
        ValueType::FuncRef => Value::from(FuncRef::null()),
        ValueType::ExternRef => Value::from(ExternRef::null()),
        _ => panic!("Unknown type")
    }
}
