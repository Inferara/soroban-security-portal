//! Exports RET_VERSION: the exact `soroban-ret` library version from
//! Cargo.lock. Keeps the version reported by /versions in lockstep with the
//! dependency — bumping Cargo.toml can no longer desynchronize the constant.

fn main() {
    println!("cargo:rerun-if-changed=Cargo.lock");
    let lock = std::fs::read_to_string("Cargo.lock").expect("failed to read Cargo.lock");
    let mut in_ret_package = false;
    let mut version = None;
    for line in lock.lines() {
        let line = line.trim();
        if line == "[[package]]" {
            in_ret_package = false;
        } else if line == "name = \"soroban-ret\"" {
            in_ret_package = true;
        } else if in_ret_package {
            if let Some(v) = line.strip_prefix("version = ") {
                version = Some(v.trim_matches('"').to_string());
                break;
            }
        }
    }
    let version = version.expect("soroban-ret package not found in Cargo.lock");
    println!("cargo:rustc-env=RET_VERSION={}", version);
}
