# Wasm Interpreter Crash

This issue concerns a crash found in wasmi fuzz test only in the Rust build rustc 1.76.0-nightly (49b3924bd 2023-11-27). In the fuzz test, we use wasm_smith module to generate random Wasm objects and call each function of the Wasm object with random inputs.

When the fuzz test is run, it crashes with the following error in `ty_to_arg()` which matches the function types (wasmi::ValueType) to random values (wasmi::Value):

```
==51503== ERROR: libFuzzer: deadly signal
#0 0x105166800 in __sanitizer_print_stack_trace+0x28 (librustc-nightly_rt.asan.dylib:arm64+0x5a800)
#1 0x1035d4ee8 in fuzzer::PrintStackTrace()+0x30 (wasmi:arm64+0x101320ee8)
#2 0x1035c7ae0 in fuzzer::Fuzzer::CrashCallback()+0x54 (wasmi:arm64+0x101313ae0)
#3 0x1894b1a20 in _sigtramp+0x34 (libsystem_platform.dylib:arm64+0x3a20)
#4 0x5e240001023b15f4 (<unknown module>)
#5 0x1023c48d0 in wasmi::ty_to_arg::h9b94c1055ba765db wasmi.rs:81
#6 0x1023ca5f0 in wasmi::_::__libfuzzer_sys_run::h026c7b6edd18f6e4 wasmi.rs:129
#7 0x1023c8098 in rust_fuzzer_test_input lib.rs:297
#8 0x1035c0790 in std::panicking::try::do_call::ha9a3096c9643ba55+0xac (wasmi:arm64+0x10130c790)
#9 0x1035c6c24 in __rust_try+0x20 (wasmi:arm64+0x101312c24)
#10 0x1035c5b9c in LLVMFuzzerTestOneInput+0x1d0 (wasmi:arm64+0x101311b9c)
#11 0x1035c944c in fuzzer::Fuzzer::ExecuteCallback(unsigned char const*, unsigned long)+0x150 (wasmi:arm64+0x10131544c)
#12 0x1035c8ac8 in fuzzer::Fuzzer::RunOne(unsigned char const*, unsigned long, bool, fuzzer::InputInfo*, bool, bool*)+0x48 (wasmi:arm64+0x101314ac8)
#13 0x1035cb088 in fuzzer::Fuzzer::ReadAndExecuteSeedCorpora(std::__1::vector<fuzzer::SizedFile, std::__1::allocator<fuzzer::SizedFile>>&)+0x7d4 (wasmi:arm64+0x101317088)
#14 0x1035cb24c in fuzzer::Fuzzer::Loop(std::__1::vector<fuzzer::SizedFile, std::__1::allocator<fuzzer::SizedFile>>&)+0xd0 (wasmi:arm64+0x10131724c)
#15 0x1035ee9e0 in fuzzer::FuzzerDriver(int*, char***, int (*)(unsigned char const*, unsigned long))+0x1e68 (wasmi:arm64+0x10133a9e0)
#16 0x1035fc59c in main+0x24 (wasmi:arm64+0x10134859c)
#17 0x189109054 (<unknown module>)
#18 0x5c44fffffffffffc (<unknown module>)

NOTE: libFuzzer has rudimentary signal handlers.
Combine libFuzzer with AddressSanitizer or similar for better crash reports.
SUMMARY: libFuzzer: deadly signal
MS: 0 ; base unit: 0000000000000000000000000000000000000000
0x2d,0x2a,0xa,0xff,0x57,
-*\012\377W
artifact_prefix='/Users/kadron/Work/Veridise/Audits/Stellar/soroban-env-rs-veridise-fork/soroban-env-host/fuzz/artifacts/wasmi/'; Test unit written to /Users/kadron/Work/Veridise/Audits/Stellar/soroban-env-rs-veridise-fork/soroban-env-host/fuzz/artifacts/wasmi/crash-9fe80a366cd6dda4a7b1f6ba1246274f2bf47e1d
Base64: LSoK/1c=
```

`ty_to_arg()` function extended from original wasmi fuzz test:

```rust
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
```

**Severity:** High

**Type:** Denial of Service

## **Impact**

Being able to crash a node consistently could allow an attacker to perform a denial of service attack.

## **Status**

Invalid (Commit: 2674d86)

## **Developer Response**

After further investigation, it appears the issue is caused by some issue in this particular nightly version of Rust in `rng.gen()` and is not caused by any vulnerability in the developer's code.
