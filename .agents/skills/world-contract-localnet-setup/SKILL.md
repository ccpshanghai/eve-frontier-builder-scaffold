---
name: world-contract-localnet-setup
description: Use when needing to set up a Sui localnet and deploy world-contracts in Docker for local development, or when asked to bootstrap the Sui dev environment with world-contracts
---

# World Contract Localnet Setup

## Overview

Bootstrap a full Sui localnet with world-contracts deployed inside Docker, without requiring Sui tooling outside the container. The process uses the pre-configured Docker environment in `docker/` and the world-contracts repo.

Core principle: **Reference the existing repo docs** for detailed steps; this skill provides the glue knowledge not obvious from reading them sequentially.

## Key References

- **Container setup & lifecycle**: [docker/readme.md](docker/readme.md)
- **Full builder flow (deploy → publish → scripts)**: [docs/builder-flow-docker.md](docs/builder-flow-docker.md)
- **Generate world-contracts .env**: `/workspace/scripts/generate-world-env.sh` (in-container)

## Critical Glue Knowledge

### Bind-mount requirement

The `docker/compose.yml` bind-mounts `./world-contracts` into the container at `/workspace/world-contracts`. Therefore, **world-contracts must be cloned into `docker/world-contracts/` in the project checkout before starting the container**:

```bash
git clone -b v0.0.18 https://github.com/evefrontier/world-contracts.git docker/world-contracts
```

This is NOT explicitly stated in the sequential flow of `docs/builder-flow-docker.md` (which describes cloning inside the container). Cloning in the project checkout ensures the directory is visible both inside and outside the container.

### First run vs subsequent runs

- **First run**: Creates genesis blob, three ed25519 keypairs (`ADMIN`, `PLAYER_A`, `PLAYER_B`), funds from faucet. Indexer database is reset.
- **Subsequent runs**: Re-uses persisted localnet state and keys from Docker volume. Only faucets accounts.

For a fresh chain while keeping keys, use `SUI_FORCE_REGENESIS=true` (see [docker/readme.md — Quick start](docker/readme.md)).

### Workspace layout (inside container)

```
/workspace/
├── builder-scaffold/    # full repo (syncs with project checkout)
└── world-contracts/     # bind mount (syncs with docker/world-contracts/ outside the container)
```

Keys are at `/workspace/builder-scaffold/docker/.env.sui` inside the container and `docker/.env.sui` outside the container.

## Flow

### 1. Clone world-contracts in the project checkout

```bash
git clone -b v0.0.18 https://github.com/evefrontier/world-contracts.git docker/world-contracts
```

### 2. Start the container and deploy

**Option A — Interactive** (follow [docs/builder-flow-docker.md](docs/builder-flow-docker.md)):

Start container, then inside run the deploy steps manually.

**Option B — Automated one-shot**:

```bash
cd docker && docker compose run --rm --service-ports sui-dev bash -c "
/workspace/scripts/generate-world-env.sh /workspace/world-contracts &&
cd /workspace/world-contracts &&
pnpm install &&
pnpm deploy-world localnet &&
pnpm configure-world localnet &&
pnpm create-test-resources localnet
"
```

The `generate-world-env.sh` script copies container-generated keys from `docker/.env.sui` into the world-contracts `.env`.

### 3. Verify

- Keys: `docker/.env.sui`
- Deployment artifacts: `docker/world-contracts/deployments/localnet/`
- RPC: `http://127.0.0.1:9000`
- GraphQL (with indexer): `http://localhost:9125/graphql`

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Cloning world-contracts inside container only (lost on exit) | Clone into `docker/world-contracts/` outside the container; it is bind-mounted |
| Forgetting to run `generate-world-env.sh` before deploy | Deploy scripts read `.env` — generate it first |
| "Unpublished dependencies: World" when publishing custom contracts | Deploy world-contracts first, then pass the pubfile path (see [docker/readme.md — Troubleshooting](docker/readme.md)) |
| Move.lock wrong env | `rm Move.lock && sui move build -e testnet` |
