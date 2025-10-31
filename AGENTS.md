# Repository Guidelines

## Project Structure & Module Organization
The monorepo uses Turborepo workspaces. The primary UI lives in `apps/web` (Next.js 16). Solidity sources and Hardhat tests are split between `packages/core` (factory, pair, ERC20) and `packages/periphery` (routers and examples). Deployment utilities sit in `scripts/` and persistent contract data in `deployments/`. Build artifacts (`artifacts/`, `cache/`) are generated—do not hand edit them.

## Build, Test & Development Commands
Use `yarn dev` for a full-stack watch mode (`turbo run dev`; web serves at http://localhost:3000). `yarn build` runs every package’s production build and should stay green before merging. Run `yarn lint` and `yarn check-types` to keep ESLint and TypeScript checks clean. Smart-contract suites execute with `yarn hardhat test`, and `yarn hardhat coverage` is available when you need Solidity coverage. The script `yarn deploy-more-tokens` broadcasts extra token deployments to the MegaETH testnet; run it only after exporting the required env vars.

## Coding Style & Naming Conventions
TypeScript follows Prettier defaults (two-space indentation, single quotes) enforced via `yarn format`. Keep React components PascalCase and colocate feature hooks or utilities beside their usage in `apps/web`. Solidity contracts should retain the Warp naming conventions; make filenames match the contract they contain and prefer internal comments over inline explanations. Keep environment-specific values in `.env` files referenced by Turborepo.

## Testing Guidelines
Contract tests live under each package’s `test/` directory and follow the `*.spec.ts` naming convention. Extend the shared fixtures in `test/shared/` instead of creating ad-hoc deployments. Tests should reset the Hardhat network between cases and include revert expectations for failure paths. Use `REPORT_GAS=true yarn hardhat test` to capture gas metrics when optimizing migrations.

## Commit & Pull Request Guidelines
Recent history favors concise, lower-case summaries (e.g., `add liquidity validation`). Write imperative, ≤72-character subjects and expand context in the body when touching multiple packages. Pull requests should link the relevant issue or spec, enumerate testing performed (`yarn build`, `yarn hardhat test`, etc.), and attach UI screenshots for web-facing changes. Mention required environment differences (RPC URLs, private keys) so reviewers can reproduce behavior locally.

## Security & Environment Notes
Secrets load through `.env` files consumed by Hardhat (`MEGAETH_RPC_URL`, `MEGAETH_PRIVATE_KEY`, `MEGAETH_GAS_PRICE`). Never commit these files; use `.env.example` updates when adding new variables. Review third-party dependencies before upgrades, especially anything touching wallet integrations in `apps/web` or deployment flows in `scripts/`.
