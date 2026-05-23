# dapps Local Development Notes

- Do not patch `node_modules/@evefrontier/dapp-kit` to change provider behavior. Keep app-specific provider wiring under `src/providers`.
- Use `VITE_APP_ENV=local` as the only switch for localnet-only wallet behavior. Any other value must use the normal `EveFrontierProvider` path from `@evefrontier/dapp-kit`.
- In local mode, the app may register one custom dev wallet initializer from `VITE_PLAYER_PRIVATE_KEY`. Switching this single key switches the local player wallet.
- The local dev wallet is browser-side by design and must only use disposable localnet keys. Do not enable it for testnet, devnet, mainnet, or deployed builds.
- Do not print private keys in logs, tests, command output, or documentation examples. Use placeholders in committed examples.
- Vite reads `VITE_*` variables at dev-server startup. Restart the dapp dev server after changing `VITE_APP_ENV` or `VITE_PLAYER_PRIVATE_KEY`.
- For Supply Terminal localnet work, follow the repo skill at `.agents/skills/supply-terminal-dev/SKILL.md` before ad hoc dapp debugging.
- For interactive Supply Terminal UI checks, use `pnpx playwright open http://127.0.0.1:5173/` after starting the dapp dev server.
- For Playwright spec execution, try `pnpx playwright test <spec-file>` first. If the pnpx runner conflicts with locally installed `@playwright/test`, use repo-local `pnpm exec playwright test <spec-file>` and note the fallback.
