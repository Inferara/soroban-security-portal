//! Built-in sample contracts, so the UI can offer one-click examples to
//! disassemble (mirrors the soroban-decompiler "fixtures" tab). The WASM is
//! embedded at compile time from `fixtures/`.

use serde::Serialize;

pub struct Fixture {
    pub name: &'static str,
    pub description: &'static str,
    pub wasm: &'static [u8],
}

pub static FIXTURES: &[Fixture] = &[
    Fixture {
        name: "add_u64",
        description: "Minimal arithmetic contract (add, safe_add)",
        wasm: include_bytes!("../fixtures/test_add_u64.wasm"),
    },
    Fixture {
        name: "constructor",
        description: "Constructor + persistent/temporary/instance storage",
        wasm: include_bytes!("../fixtures/contract_with_constructor.wasm"),
    },
    Fixture {
        name: "events",
        description: "Contract events (#[contractevent], publish)",
        wasm: include_bytes!("../fixtures/test_events.wasm"),
    },
    Fixture {
        name: "errors",
        description: "Custom errors (#[contracterror], panic_with_error!)",
        wasm: include_bytes!("../fixtures/test_errors.wasm"),
    },
    Fixture {
        name: "auth",
        description: "Authorization (require_auth)",
        wasm: include_bytes!("../fixtures/test_auth.wasm"),
    },
    Fixture {
        name: "udt",
        description: "User-defined types (structs, enums, unions)",
        wasm: include_bytes!("../fixtures/test_udt.wasm"),
    },
];

pub fn find(name: &str) -> Option<&'static Fixture> {
    FIXTURES.iter().find(|f| f.name == name)
}

#[derive(Serialize)]
pub struct FixtureInfo {
    pub name: &'static str,
    pub description: &'static str,
    pub size: usize,
}

#[derive(Serialize)]
pub struct FixtureListResponse {
    pub fixtures: Vec<FixtureInfo>,
}

pub fn list() -> FixtureListResponse {
    FixtureListResponse {
        fixtures: FIXTURES
            .iter()
            .map(|f| FixtureInfo {
                name: f.name,
                description: f.description,
                size: f.wasm.len(),
            })
            .collect(),
    }
}
