# WarpX Mainnet Launch Runbook

This document condenses everything in the repository into a single runbook you can follow while preparing the WarpX automated market maker for an Ethereum mainnet launch. It covers tooling, environment variables, deployable artifacts, scripts, manifests, monitoring utilities, and the order of operations required to ship both the smart contracts and the frontends.

---

## 1. Repository map

| Area | Purpose | Key paths |
| --- | --- | --- |
| Frontends | Next.js apps (DEX + marketing). | `apps/web`, `apps/landing` |
| Solidity contracts | Core Warp V2 AMM, routers, staking, test helpers. | `packages/core`, `packages/periphery`, `packages/warp-lib` |
| SDKs + shared code | Typed helper packages consumed by the web app. | `packages/warp-sdk-core`, `packages/warp-v2-sdk`, `packages/theme` |
| Subgraph | Graph Protocol indexing config + mappings. | `packages/subgraph` |
| Deploy tooling | Hardhat config, scripts for deployment/liquidity/governance. | `hardhat.config.ts`, `scripts/` |
| Manifests | Chain-specific addresses mirrored to the frontend. | `deployments/`, `apps/web/public/deployments/` |
| Tests | Hardhat + UI-aligned spec files. | `packages/*/test`, `test/` |

---

## 2. Prerequisites

- Node.js ≥ 18 and Yarn 1.22 (`corepack enable && corepack prepare yarn@1.22.19 --activate`).
- Git, bash/zsh, and common Unix tooling (curl, jq) for scripts.
- Hardhat CLI (`yarn hardhat`) with a funded deployer key for the target chain.
- Graph CLI + IPFS access for deploying the subgraph (`yarn global add @graphprotocol/graph-cli`).
- Optional: `REPORT_GAS=true` for gas reporter, `matchstick-as` for subgraph tests.

Install dependencies once:

```bash
yarn install
```

---

## 3. Environment & secrets

Create `.env` files at the repo root as well as inside `apps/web` and `apps/landing` if you need per-app overrides. Never commit real keys; update `.env.example` whenever you add a new variable.

### 3.1 Hardhat + scripts

| Variable | Required | Notes |
| --- | --- | --- |
| `MEGAETH_RPC_URL` / `NEXT_PUBLIC_MEGAETH_RPC_URL` | ✅ | Replace with your mainnet RPC when ready. Used by Hardhat and wagmi. |
| `MEGAETH_PRIVATE_KEY` | ✅ | Deployer/signing key for Hardhat scripts (factory, tokens, staking). |
| `MEGAETH_GAS_PRICE` | Optional | Force a gas price when RPC `eth_estimateGas` fails. |
| `HARDHAT_NETWORK` | Optional | Defaults to `megaethTestnet`. Set to `mainnet` (after adding the network to `hardhat.config.ts`). |
| `MEGAETH_DEPLOY_GAS_LIMIT` | Optional | Override gas limits for large deployments. |
| `MEGAETH_FEE_TO_SETTER` | Optional | Factory `feeToSetter`; defaults to deployer. |
| `MEGAETH_WRITE_DEPLOYMENT` | Default `true` | Set to `false` to skip manifest writes. |
| `MEGAETH_DEPLOYMENT_DIR` | Optional | Custom directory for output manifests. |
| `MEGAETH_SYNC_FRONTEND` | Default `true` | Set to `false` to avoid mirroring manifests to `apps/web/public/deployments`. |
| `REPORT_GAS` | Optional | `true` enables `hardhat-gas-reporter`. |
| `COINMARKETCAP_API_KEY` | Optional | Enables USD gas cost display when `REPORT_GAS=true`. |

### 3.2 Liquidity & token scripts

| Variable | Used by | Purpose |
| --- | --- | --- |
| `WARPX_AMOUNT`, `ETH_AMOUNT` | `scripts/add-warpx-eth-liquidity.ts` | Desired liquidity to deposit. |
| `LIQUIDITY_DEADLINE_MINUTES` | Add-liquidity scripts | Deadline window for router tx. |
| `SLIPPAGE_PERCENT` | Liquidity scripts | Basis for `amountAMin/amountBMin`. |
| `MORALIS_API_KEY`, `MORALIS_ETH_PRICE_URL` | `apps/web/app/api/eth-price`, `scripts/add-wusd-eth-liquidity.ts` | Fetch live ETH/USD price when seeding stablecoin pools. |
| `ETH_AMOUNT` | `scripts/seed-usd-eth-from-gte.ts`, `scripts/check-gte-price.ts` | Amount of native token used when mirroring GTE prices. |

### 3.3 Governance & staking

| Variable | Used by | Purpose |
| --- | --- | --- |
| `MEGAETH_STAKING_LP_TOKEN` | `yarn deploy-staking` | LP token address users will stake. |
| `MEGAETH_STAKING_REWARD_TOKEN` or `MEGAETH_STAKING_REWARD_SYMBOL` | `yarn deploy-staking` | Reward token (set symbol to auto-resolve from manifest). |
| `MEGAETH_STAKING_OWNER` | `yarn deploy-staking` | Owner who can update config. Defaults to deployer. |
| `MEGAETH_STAKING_DISTRIBUTOR` | `yarn deploy-staking`, `yarn notify-staking` | Authorized notifier address. |
| `MEGAETH_STAKING_PROXY_ADMIN` | `yarn deploy-staking`, `yarn change-staking-admin` | Proxy admin address. |
| `MEGAETH_STAKING_DURATION` | `yarn deploy-staking` | Reward window in seconds. Default 7 days. |
| `MEGAETH_STAKING_LABEL` | `yarn deploy-staking` | Display name in manifests. |
| `MEGAETH_STAKING_CONTRACT` | Notify/admin scripts | Explicit proxy address if not found in manifests. |
| `MEGAETH_STAKING_NOTIFY_AMOUNT` | `yarn notify-staking` | Human-readable token amount to emit per window. |
| `MEGAETH_STAKING_NEW_ADMIN` | `yarn change-staking-admin` | New proxy admin. |
| `WARP_FACTORY_ADDRESS`, `WARP_TREASURY_ADDRESS`, `WARP_PAIR_ADDRESS` | `yarn set-factory-fee-to`, `yarn verify-fee-config` | Treasury + pair scanning. |
| `WARP_FEE_CHECK_START_BLOCK`, `WARP_FEE_CHECK_BLOCK_SPAN` | `yarn verify-fee-config` | Optional scan bounds for LP mints. |

### 3.4 Frontend (`apps/web`)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Required for Wagmi/AppKit initialization. |
| `NEXT_PUBLIC_MEGAETH_NETWORK` | Name of the network whose manifest the UI loads (e.g., `mainnet`). |
| `NEXT_PUBLIC_SUBGRAPH_URL`, `NEXT_PUBLIC_WARP_SUBGRAPH_URL` | GraphQL endpoints for pool + user stats. |
| `SUBGRAPH_AUTH_TOKEN`, `NEXT_PUBLIC_GRAPH_API_KEY` | Optional headers for authenticated subgraph access. |
| `NEXT_PUBLIC_NATIVE_SYMBOL` | Display override for the native asset symbol. |
| `NEXT_PUBLIC_APP_URL` (landing) | Controls the “Launch App” CTA target on the marketing site. |

Keep Moralis + RPC keys available in the frontend environment as well so the Next.js API routes can forward them.

---

## 4. Build, lint, and test

Run these before every release candidate:

```bash
# Development watch mode (both apps)
yarn dev

# Production builds for every workspace
yarn build

# Lint + TS checks
yarn lint
yarn check-types

# Focused frontend checks
yarn workspace web lint
yarn workspace web check-types
yarn workspace landing lint
yarn workspace landing check-types

# Contract tests
yarn hardhat test            # entire suite
yarn test:core:factory       # targeted specs
REPORT_GAS=true yarn hardhat test
yarn hardhat coverage
```

---

## 5. Deployment manifests and current addresses

All deployment scripts write JSON manifests under `deployments/` and sync them to `apps/web/public/deployments/` so the UI can fetch addresses at runtime.

Testnet reference (`deployments/megaethTestnet*.json`):

| Artifact | Address |
| --- | --- |
| Factory | `0x4C40BA03b676bc14bFC8A7DAeBc361C05CbB6867` |
| Router | `0x687f67Ce9Ec3D221B4A7d0d7D7D1186DFC32a678` |
| WMEGA | `0xA51EbEdb0970133D016444Be0049efFE9257D06A` |
| WARPX | `0x5124C91CDa8dA5C2B0c838C64b25089443f5D109` |
| wUSD | `0x07b1EDd4a0D76D07C5A91B9159D13Cb51C8e4E42` |
| XBTC | `0x463151b80DFf738Bb02BA3B4C9Bd788daeEc751c` |
| Staking proxy | `0x2AE9Efb422d5e7BB7DDF6ea0b94f87114313d1a1` |

For mainnet, target the same filenames (`deployments/mainnet.json`, `mainnet.tokens.json`, etc.) so the UI simply switches by network name. Commit the manifests (but never private keys).

---

## 6. Smart contract deployment

### 6.1 Prepare Hardhat

1. Add a `mainnet` (or the desired chain) section inside `hardhat.config.ts` that mirrors the `megaethTestnet` config but points at your RPC and account list.
2. Export the appropriate `.env` variables (RPC URL, signer key, optional gas price).

### 6.2 Deploy factory + router + wrapped native

Command:

```bash
yarn deploy-router                # alias for hardhat run packages/periphery/deploy/megaeth.ts
```

What happens (`packages/periphery/deploy/megaeth.ts`):

1. Deploys `WarpFactory` with `feeToSetter = MEGAETH_FEE_TO_SETTER || deployer`.
2. Deploys `WMegaETH` (wrapped native placeholder).
3. Deploys `WarpRouter` wired to the factory + wrapped native.
4. Writes `deployments/<network>.json` and mirrors it to the frontend directory unless `MEGAETH_WRITE_DEPLOYMENT=false`.

### 6.3 Deploy protocol tokens

Each script mints ERC20s using `packages/periphery/contracts/test/ERC20Decimals.sol`.

| Script | Command | Defaults |
| --- | --- | --- |
| `scripts/deploy-warpx.ts` | `yarn deploy-warpx` | 1,000,000,000 WARPX (18 decimals). |
| `scripts/deploy-wusd.ts` | `yarn deploy-wusd` | 100,000,000,000 wUSD (6 decimals). |
| `scripts/deploy-xbtc.ts` | `yarn deploy-xbtc` | 21,000,000 XBTC (8 decimals). |

Each script:

- Reads the existing token manifest (`deployments/<network>.tokens.json` and the mirrored frontend file).
- Updates any matching symbols with the new addresses.
- Preserves custom metadata (logos, `isNative`, etc.).
- Emits a deployment summary.

After deploying, transfer tokens from the deployer to the wallets you plan to use for liquidity mining or treasury operations.

**Frontend note:** Update `apps/web/lib/trade/constants.ts` if you want hardcoded fallbacks (token catalog + explorers) to show the new addresses/logos during SSR.

### 6.4 Seed liquidity

1. **WarpX/ETH** – `yarn add-warpx-eth-liquidity`
   - Env: `WARPX_AMOUNT`, `ETH_AMOUNT`, `SLIPPAGE_PERCENT`, `LIQUIDITY_DEADLINE_MINUTES`, optional `MEGAETH_DEPLOY_GAS_LIMIT`.
   - Reads manifests to find the router, tokens, and decimals, then checks balances, approves, and calls `addLiquidityETH`.

2. **wUSD/ETH** – `yarn add-wusd-eth-liquidity`
   - Pulls real-time ETH price from Moralis (`MORALIS_API_KEY`).
   - Calculates wUSD amount to match the live price so the initial pool is anchored to market rates.
   - Writes logs showing the ratio and final reserves.

3. **MEGA (or any ERC20)/ETH from GTE** – `yarn seed-warpx-liquidity`
   - Uses `scripts/seed-usd-eth-from-gte.ts` to read reserves from the `GTE` factory and price your deposit exactly.
   - Run `npx hardhat run scripts/check-gte-price.ts --network mainnet` first to confirm the amounts.

All liquidity scripts expect the deployer wallet to already hold the ERC20s. Use the matching `scripts/check-*.ts` utilities to verify addresses when in doubt.

### 6.5 Deploy staking rewards

1. Export the staking env vars (LP token, reward token or symbol, owner, distributor, proxy admin, duration, label).
2. Run:

   ```bash
   yarn deploy-staking
   ```

   The script:
   - Deploys `WarpStakingRewards` implementation + proxy.
   - Initializes the proxy with owner/distributor/stakingToken/rewardToken/duration.
   - Transfers proxy admin if requested.
   - Writes `<network>.staking.json` in `deployments/` and mirrors it to the frontend.

3. Fund the staking contract with reward tokens and start emissions:

   ```bash
   MEGAETH_STAKING_NOTIFY_AMOUNT=25000 yarn notify-staking
   ```

4. Rotate admin when needed:

   ```bash
   MEGAETH_STAKING_NEW_ADMIN=0x... yarn change-staking-admin
   ```

### 6.6 Treasury, fee, and governance scripts

- `yarn set-factory-fee-to`: Sets `feeTo` on the factory; signer must be the current `feeToSetter`.
- `yarn verify-fee-config`: Confirms the factory + pair config, optionally scans for LP tokens minted to the treasury.
- `scripts/check-pair-tokens.ts`: Inspect `token0/token1` metadata for any pair.
- `scripts/check-wmegaeth-symbol.ts`: Smoke test the wrapped native token metadata.
- `scripts/check-old-warpx.ts`: Inspect the previous WarpX token if you need to confirm decimals or names before migrating balances.

### 6.7 Diagnostics, analytics, and price feeds

- `scripts/check-all-pairs.mjs`: Lists every pair from a factory.
- `scripts/find-all-pair-creation-blocks.mjs`, `scripts/find-factory-deploy-block.sh`, `scripts/find-factory-deployment.sh`: Help pin down deployment blocks when updating the subgraph start block.
- `scripts/verify-liquidity-add-math.mjs`, `scripts/verify-swap-math.mjs`, `scripts/diagnose-swap-issue.mjs`, `scripts/reverse-calculate-input.mjs`: Offline math verifiers for constant-product behavior when debugging liquidity discrepancies.
- `scripts/fetch-chainlink-feed.ts` and `scripts/fetch-pyth-eth.ts`: Query on-chain price feeds for ETH/USD sanity checks.
- `scripts/match-amm-price.ts`: Template script for matching another AMM’s price when porting liquidity.
- `apps/web/scripts/fetchPairReserves.mjs`: CLI helper to read reserves for any pair defined in your manifest.

Document the outputs of these scripts when assembling the launch report so reviewers have a clear record of prices and reserves.

---

## 7. Frontend readiness (`apps/web`)

1. Update `apps/web/public/deployments/<network>.json`, `<network>.tokens.json`, and `<network>.staking.json` with the mainnet addresses produced during deployment.
2. Ensure environment variables are set (WalletConnect project ID, RPC URL, subgraph endpoints, native symbol, Moralis key).
3. Update `apps/web/lib/trade/constants.ts` with the real addresses/logos you want bundled at build time.
4. Run the full UI pipeline:

   ```bash
   yarn workspace web dev          # Smoke test
   yarn workspace web build
   yarn workspace web start        # Production preview
   ```

5. Vercel deployment (two projects recommended):
   - `apps/web`: build command `yarn turbo run build --filter=web`, output `apps/web/.next`.
   - `apps/landing`: build command `yarn turbo run build --filter=landing`, output `apps/landing/.next`.

6. Sync static assets:
   - Token logos live under `apps/web/public/logos/`. Add your mainnet logos before deploying.
   - `apps/web/public/deployments` must contain the latest manifests or the UI falls back to `sample-*.json`.

---

## 8. Landing site (`apps/landing`)

The marketing site points to the DEX via `NEXT_PUBLIC_APP_URL` (defaults to `http://localhost:3000`). Set it to the production app domain before launching. Build/test commands mirror the main app:

```bash
yarn workspace landing dev
yarn workspace landing build
yarn workspace landing start
```

---

## 9. Subgraph & analytics (`packages/subgraph`)

1. Update `packages/subgraph/subgraph.yaml` with the mainnet factory address and a start block that predates factory deployment. Use the helper scripts (`find-factory-deploy-block.sh`, `find-all-pair-creation-blocks.mjs`) to discover the exact block.
2. Update the Graph Protocol network name if you’re leaving MegaETH testnet (currently `network: megaeth-testnet`).
3. Run:

   ```bash
   yarn workspace @warpx/subgraph codegen
   yarn workspace @warpx/subgraph build
   yarn workspace @warpx/subgraph test            # requires matchstick-as
   yarn workspace @warpx/subgraph deploy:local    # optional dry run
   graph deploy <account>/<name> --node ... --ipfs ...  # production deploy
   ```

4. Point `NEXT_PUBLIC_SUBGRAPH_URL` and `NEXT_PUBLIC_WARP_SUBGRAPH_URL` at the deployed Graph endpoints (or your own Graph Node). If you require authentication, set `SUBGRAPH_AUTH_TOKEN` / `NEXT_PUBLIC_GRAPH_API_KEY` so the hooks in `apps/web/hooks/usePools*.ts` can forward the headers.

---

## 10. Launch checklist

Use this as your final pass when moving from staging to mainnet. Check off each line with the corresponding evidence (tx hashes, screenshots, logs).

1. **Prep**
   - [ ] Update `hardhat.config.ts` with the mainnet RPC entry.
   - [ ] Confirm `.env` files contain the production RPCs, keys, WalletConnect ID, Moralis key, subgraph URLs.
   - [ ] `yarn install` (ensure lockfile hasn’t drifted).

2. **Smart contracts**
   - [ ] `yarn build` (compiles contracts + frontends via Turborepo).
   - [ ] `yarn hardhat test` and `yarn hardhat coverage`.
   - [ ] `yarn deploy-router` (record tx hashes, addresses written to `deployments/mainnet.json`).
   - [ ] `yarn deploy-warpx`, `yarn deploy-wusd`, `yarn deploy-xbtc` (record addresses, transfer balances to treasury/multisig).
   - [ ] Run liquidity scripts (`yarn add-warpx-eth-liquidity`, `yarn add-wusd-eth-liquidity`, `yarn seed-warpx-liquidity` or equivalents) until pools are seeded and verified on the block explorer.
   - [ ] `yarn deploy-staking`, followed by `yarn notify-staking`.
   - [ ] `yarn set-factory-fee-to` to reroute protocol fees to the treasury.
   - [ ] Capture outputs from the verification scripts (`yarn verify-fee-config`, `scripts/check-all-pairs.mjs`, `apps/web/scripts/fetchPairReserves.mjs`) and attach them to the launch notes.

3. **Manifests & frontend hooks**
   - [ ] Copy the updated manifests into `apps/web/public/deployments`.
   - [ ] Update `apps/web/lib/trade/constants.ts` token catalog if needed.
   - [ ] Commit the manifest + constant changes.

4. **Subgraph**
   - [ ] Update `subgraph.yaml` (addresses/start block).
   - [ ] `yarn workspace @warpx/subgraph build/test`.
   - [ ] Deploy to your Graph Node and note the endpoint URL.
   - [ ] Update frontend envs to consume the new endpoint.

5. **Frontend QA**
   - [ ] `yarn workspace web build && yarn workspace web start`.
   - [ ] `yarn workspace landing build && yarn workspace landing start`.
   - [ ] End-to-end smoke test: connect wallet, swap, add/remove liquidity, claim staking rewards, verify contract addresses and explorers are correct.

6. **Production deploy**
   - [ ] Trigger Vercel deploys (landing + app). Capture build logs.
   - [ ] Update DNS/aliases if needed.

7. **Post-launch monitoring**
   - [ ] Run `scripts/fetch-chainlink-feed.ts` and `scripts/fetch-pyth-eth.ts` to confirm feeds behave as expected on mainnet.
   - [ ] Execute `apps/web/scripts/fetchPairReserves.mjs` for the critical pools and archive the outputs.
   - [ ] Keep `yarn verify-fee-config` handy to audit treasury inflows after trades start settling.

---

## 11. Reference: utility scripts

| Command | Description |
| --- | --- |
| `yarn deploy-router` | Deploys factory + router + wrapped native and writes manifests. |
| `yarn deploy-warpx` / `yarn deploy-wusd` / `yarn deploy-xbtc` | Deploy ERC20 tokens and sync token manifests. |
| `yarn add-warpx-eth-liquidity` | Adds initial WARPX/ETH liquidity at a custom ratio. |
| `yarn add-wusd-eth-liquidity` | Seeds wUSD/ETH liquidity at live market price (Moralis). |
| `yarn seed-warpx-liquidity` | Mirrors another AMM (GTE) price when seeding liquidity. |
| `yarn deploy-staking` / `yarn notify-staking` / `yarn change-staking-admin` | Full staking rewards lifecycle. |
| `yarn set-factory-fee-to` | Updates the factory treasury address. |
| `yarn verify-fee-config` | Audits the fee recipient, LP mints, reserves. |
| `yarn deploy-wusd` README (`scripts/README-wUSD.md`) | Walkthrough for deploying + seeding the dummy stablecoin. |
| `scripts/README-USD-ETH.md` | Step-by-step tutorial for matching GTE’s USD/ETH prices. |
| `npx hardhat run scripts/check-gte-price.ts --network <network>` | Quick check of the current GTE USD/ETH price before adding liquidity. |
| `MEGAETH_STAKING_NOTIFY_AMOUNT=... yarn notify-staking` | Adds rewards for the next emission window. |
| `PAIR_ADDRESS=0x... npx hardhat run scripts/check-pair-tokens.ts` | Dumps metadata for any pair. |
| `PAIR_TOKEN_A=USDC PAIR_TOKEN_B=ETH yarn workspace web fetch-reserves` | Reads reserves through the viem script. |

Keep this table handy for on-call rotations so anyone can rehydrate state, diagnose pool math, or re-run deployments quickly.

---

## 12. Support files worth bookmarking

- `AGENTS.md`: High-level governance, coding style, and deployment policies (mirrored at the top of the CLI session).
- `apps/web/lib/config/deployment.ts` / `staking.ts`: Show how the UI loads manifests; useful when debugging stale addresses.
- `packages/periphery/deploy/*.ts`: Single source of truth for deployment logic. Review these before running in production to understand parameter ordering and logging.
- `packages/subgraph/subgraph.yaml`: Update addresses/start blocks whenever you redeploy contracts.
- `scripts/README-USD-ETH.md` and `scripts/README-wUSD.md`: Long-form documentation for the two most common liquidity provisioning flows.

---

With everything above in place, the team can execute a mainnet go-live with predictable steps, verifiable outputs (tx hashes, manifests, Graph endpoints), and clear rollback strategies. Use the checklist as a living document—append tx hashes, block numbers, and screenshot links as you work through the launch so the entire org has a single source of truth for what shipped.***
