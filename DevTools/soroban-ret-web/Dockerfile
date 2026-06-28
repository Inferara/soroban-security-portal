# syntax=docker/dockerfile:1

# ---- Build stage: compile the service binary ----
FROM rust:1.96-bookworm AS build
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY fixtures ./fixtures
RUN cargo build --release --bin soroban-ret-web

# ---- Slim runtime (no Rust toolchain): compile endpoint disabled ----
# Build with:  docker build --target runtime-slim -t soroban-ret-web:slim .
# ~80MB image; Upload / By-Address / Samples modes work, Compile mode is off.
FROM debian:bookworm-slim AS runtime-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/target/release/soroban-ret-web /usr/local/bin/soroban-ret-web
ENV DEVTOOLS_NO_COMPILE=true \
    DEVTOOLS_BIND=0.0.0.0 \
    DEVTOOLS_PORT=8787 \
    RUST_LOG=info
EXPOSE 8787
ENTRYPOINT ["soroban-ret-web"]

# ---- Full runtime (default): keeps the Rust toolchain for the /compile endpoint ----
# We keep the full Rust toolchain because /compile shells out to
# `cargo build --target wasm32-unknown-unknown` to turn user Rust into a Soroban
# WASM contract. The compile skeleton is scaffolded and pre-warmed at build time
# so the first user request is fast.
FROM rust:1.96-bookworm AS runtime
RUN rustup target add wasm32-unknown-unknown \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/target/release/soroban-ret-web /usr/local/bin/soroban-ret-web

ENV DEVTOOLS_COMPILE_DIR=/opt/compile-skeleton \
    DEVTOOLS_SOROBAN_SDK_VERSION=22.0.8 \
    DEVTOOLS_BIND=0.0.0.0 \
    DEVTOOLS_PORT=8787 \
    RUST_LOG=info

# Pre-warm: scaffold the skeleton project and (optionally) build it once so
# soroban-sdk and the wasm32 dependency graph are cached in the image layer.
# Set --build-arg PREWARM=false to skip the slow SDK build (e.g. in CI/PR
# validation); the service then warms on startup and readiness gates traffic.
ARG PREWARM=true
RUN set -eux; \
    mkdir -p "$DEVTOOLS_COMPILE_DIR/src"; \
    printf '[package]\nname = "devtools_contract"\nversion = "0.0.0"\nedition = "2021"\npublish = false\n\n[lib]\ncrate-type = ["cdylib", "rlib"]\n\n[dependencies]\nsoroban-sdk = "%s"\n\n[profile.release]\nopt-level = "z"\noverflow-checks = true\nstrip = "symbols"\npanic = "abort"\ncodegen-units = 1\nlto = true\n' "$DEVTOOLS_SOROBAN_SDK_VERSION" > "$DEVTOOLS_COMPILE_DIR/Cargo.toml"; \
    printf '#![no_std]\nuse soroban_sdk::{contract, contractimpl, Env};\n#[contract]\npub struct Contract;\n#[contractimpl]\nimpl Contract { pub fn hello(_e: Env) -> u32 { 0 } }\n' > "$DEVTOOLS_COMPILE_DIR/src/lib.rs"; \
    if [ "$PREWARM" = "true" ]; then \
      cd "$DEVTOOLS_COMPILE_DIR" && cargo build --release --target wasm32-unknown-unknown; \
    else \
      echo "PREWARM=false: skipping SDK pre-warm (service warms on startup)"; \
    fi

EXPOSE 8787
ENTRYPOINT ["soroban-ret-web"]
