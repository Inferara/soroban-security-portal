#!/usr/bin/env bash
# Build missing soroban-ret CLI engine versions and upload them into the
# soroban-ret-web pod's /engines volume, where the service picks them up
# without a restart (see docs/superpowers/specs/2026-07-17-devtools-dynamic-engines-design.md).
#
# Requirements: kubectl (context pointing at the target cluster), curl, jq,
# and either a Linux host with cargo + the x86_64-unknown-linux-musl target
# (rustup target add x86_64-unknown-linux-musl; apt install musl-tools), or
# Docker (used automatically on non-Linux hosts).
#
# Env overrides:
#   NAMESPACE   k8s namespace            (default sorobansecurityportal-ns)
#   APP_LABEL   pod label selector value (default sorobansecurityportal-soroban-ret-web)
#   USE_DOCKER  1 = always build in Docker, 0 = never (default: auto by OS)
set -euo pipefail

NAMESPACE="${NAMESPACE:-sorobansecurityportal-ns}"
APP_LABEL="${APP_LABEL:-sorobansecurityportal-soroban-ret-web}"
TARGET="x86_64-unknown-linux-musl"
ENGINES_DIR="/engines"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURE_DIR="$SCRIPT_DIR/../soroban-ret-web/fixtures"

use_docker() {
  case "${USE_DOCKER:-auto}" in
    1) return 0 ;;
    0) return 1 ;;
    *) [ "$(uname -s)" != "Linux" ] ;;
  esac
}

# build_engine <version> <dest-file>: cargo-install the CLI as a static Linux
# binary and smoke-test it on a fixture contract before returning.
build_engine() {
  local v="$1" dest="$2"
  if use_docker; then
    # rust:alpine targets musl natively. No bind mounts (Git Bash on Windows
    # mangles them): the fixture goes in via stdin, the binary comes out via
    # docker cp. The smoke test runs inside the container because the
    # produced Linux binary can't run on a non-Linux host.
    local cname="ret-engine-build-$v-$$"
    docker run --name "$cname" -i rust:alpine sh -ec "
      cat > /tmp/fixture.wasm
      apk add -q musl-dev
      cargo install soroban-ret-cli --version $v --root /tmp/eng
      /tmp/eng/bin/soroban-ret /tmp/fixture.wasm > /dev/null" \
      < "$FIXTURE_DIR/test_add_u64.wasm"
    docker cp "$cname:/tmp/eng/bin/soroban-ret" "$dest"
    docker rm "$cname" > /dev/null
    chmod 0755 "$dest" 2>/dev/null || true
  else
    local root
    root="$(mktemp -d)"
    cargo install soroban-ret-cli --version "$v" --target "$TARGET" --root "$root"
    "$root/bin/soroban-ret" "$FIXTURE_DIR/test_add_u64.wasm" > /dev/null
    install -m 0755 "$root/bin/soroban-ret" "$dest"
    rm -rf "$root"
  fi
}

pod="$(kubectl -n "$NAMESPACE" get pod -l "app=$APP_LABEL" \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
if [ -z "$pod" ]; then
  echo "ERROR: no pod with label app=$APP_LABEL in namespace $NAMESPACE" >&2
  exit 1
fi
echo "Target pod: $NAMESPACE/$pod"

versions="$(curl -fsSL https://crates.io/api/v1/crates/soroban-ret-cli \
  | jq -r '.versions[] | select(.yanked | not) | .num')"
echo "crates.io soroban-ret-cli versions:" $versions
existing="$(kubectl -n "$NAMESPACE" exec "$pod" -- ls "$ENGINES_DIR" 2>/dev/null || true)"

added=0 skipped=0
for v in $versions; do
  if printf '%s\n' "$existing" | grep -qx "soroban-ret-$v"; then
    echo "skip $v (already uploaded)"
    skipped=$((skipped + 1))
    continue
  fi
  work="$(mktemp -d)"
  echo "building soroban-ret-cli $v ($TARGET)..."
  build_engine "$v" "$work/soroban-ret-$v"
  echo "uploading soroban-ret-$v..."
  # Two-phase upload: the scanner ignores dotfiles, so a partially copied
  # binary can never be picked up; mv within the same filesystem is atomic.
  kubectl -n "$NAMESPACE" cp "$work/soroban-ret-$v" "$pod:$ENGINES_DIR/.soroban-ret-$v.tmp"
  kubectl -n "$NAMESPACE" exec "$pod" -- sh -ec \
    "chmod 0755 $ENGINES_DIR/.soroban-ret-$v.tmp && mv $ENGINES_DIR/.soroban-ret-$v.tmp $ENGINES_DIR/soroban-ret-$v"
  rm -rf "$work"
  added=$((added + 1))
done
echo "Done: $added uploaded, $skipped already present."
