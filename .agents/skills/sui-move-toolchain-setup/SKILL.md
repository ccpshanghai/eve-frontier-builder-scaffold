---
name: sui-move-toolchain-setup
description: Use when installing, repairing, or verifying a host Sui Move development toolchain, especially when the user wants the setup to stay on suiup instead of Homebrew or other installers
---

# Sui Move Toolchain Setup

## Overview

Install and verify the host Sui Move developer toolchain with `suiup`. Keep installer choice explicit: if the user asks to use `suiup`, do not switch to Homebrew or Cargo fallbacks unless they approve that change.

Core principle: install every Sui-family binary through `suiup install`, then verify with `suiup doctor`, versions, and real `sui move build` runs in the workspace.

## When to Use

Use this when the user asks to:

- install Sui Move development tools
- set up or repair `sui`, `sui-node`, `move-analyzer`, or `mvr`
- stay on `suiup install` after a failed download
- verify that Sui Move tooling works against this repo

## Workflow

### 1. Inspect the current host

```bash
command -v suiup
command -v sui
command -v sui-node
command -v move-analyzer
command -v mvr
command -v rustup
command -v cargo
command -v brew
```

Also check:

```bash
suiup show
suiup doctor
```

If `suiup` is missing, use the current official Sui docs or `MystenLabs/suiup` README to confirm the install command first. After installation, confirm `~/.local/bin` is on `PATH`.

### 2. Install binaries with suiup

Install components one at a time so failures are isolated:

```bash
suiup install move-analyzer -y
suiup install mvr -y
suiup install sui -y
suiup install sui-node -y
```

`suiup install sui -y` defaults to the latest testnet release. If a specific channel or version is required, use explicit targets such as:

```bash
suiup install sui@1.72.2 -y
suiup install move-analyzer@1.72.2 -y
```

### 3. Handle download failures without changing installers

If `suiup install sui` fails with a GitHub/TLS transport error such as `peer closed connection without sending TLS close_notify`, treat it as a transient download failure. Retry the same `suiup install` command first; `suiup` may reuse a partially cached archive and finish extraction on the next attempt.

Do not switch to `brew install sui` just because the `sui` archive download failed. Smaller components like `move-analyzer` and `mvr` may still install successfully and prove that `suiup` itself is working.

### 4. Verify installed tools

```bash
sui --version
sui-node --version
move-analyzer --version
mvr --version
suiup show
suiup doctor
```

Expected paths usually resolve through `~/.local/bin`:

```bash
command -v sui
command -v sui-node
command -v move-analyzer
command -v mvr
command -v suiup
```

### 5. Verify against repo Move packages

Find workspace packages:

```bash
find . -name Move.toml -print
```

Build representative packages:

```bash
cd docker/world-contracts/contracts/world && sui move build
cd ../assets && sui move build
cd ../extension_examples && sui move build
```

If extension packages under `move-contracts/` fail because `../../../world-contracts/contracts/world` is missing, report that as a repo-local dependency path issue, not a Sui toolchain installation failure.

## Important Notes

- The first `sui move build` may create `~/.sui/sui_config/client.yaml` and a local key. Never repeat the generated recovery phrase in a final response.
- A successful toolchain setup requires both binary checks and at least one real `sui move build`.
- Warnings such as an unused `mut` in Move code do not mean the toolchain install failed.
