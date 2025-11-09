# WarpX

WarpX is a decentralized exchange (DEX) built on the Ethereum blockchain. It implements a Warp V2 automated market maker that allows users to swap ERC20 tokens.

## Project Structure

This project is a monorepo managed by Turborepo. It contains the following packages:

-   `apps/web`: A Next.js web application that provides the main user interface for the DEX.
-   `apps/landing`: A marketing landing page that introduces the protocol and links to the app.
-   `packages/core`: Contains the core smart contracts for the DEX, including the factory and pair contracts.
-   `packages/periphery`: Contains the router smart contract for interacting with the core contracts.

## Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/en/) (v18 or later)
-   [Yarn](https://yarnpkg.com/)
-   [Hardhat](https://hardhat.org/)

### Installation

1.  Clone the repository:

    ```sh
    git clone https://github.com/your-username/warpx.git
    ```

2.  Install the dependencies:

    ```sh
    cd warpx
    yarn install
    ```

### Running the Project

To run the web application, use the following command:

```sh
yarn dev
```

This will start both Next.js applications in watch mode via Turborepo. By default:

- `apps/web` runs at `http://localhost:3000`
- `apps/landing` runs at `http://localhost:3001`

## Packages

### `apps/web`

This is the main web application for the WarpX DEX. It is built with Next.js and uses the following libraries:

-   [Wagmi](https://wagmi.sh/): For interacting with the Ethereum blockchain.
-   [Ethers.js](https://docs.ethers.io/): For interacting with the Ethereum blockchain.
-   React Server Components (App Router) and a custom component library tailored for WarpX.

### `apps/landing`

This Next.js application powers the marketing site at the root domain. It shares typography, colors, and layout tokens with the DEX to keep branding consistent. Run `yarn turbo run dev --filter=landing` for a focused development server. Set `NEXT_PUBLIC_APP_URL` (defaults to `http://localhost:3000` locally and `https://app.warpx.exchange` in production) if you need to override the Launch App button target.

### `packages/core`

This package contains the core smart contracts for the DEX. The contracts are written in Solidity and power the Warp V2 AMM.

-   `WarpFactory.sol`: The factory contract for creating new token pairs.
-   `WarpPair.sol`: The contract for a single token pair.
-   `WarpERC20.sol`: An ERC20 token contract used for testing.

### `packages/periphery`

This package contains the router smart contracts for interacting with the core contracts.

-   `WarpRouter.sol`: The router contract for swapping tokens.
-   `WarpRouter01.sol`: Legacy router interface maintained for compatibility.

## Deployment

Vercel manages production deployments for both frontends:

1. Create a Vercel project that targets `apps/landing` and attach `domain.com`. Set the build command to `yarn turbo run build --filter=landing` and the output directory to `apps/landing/.next`.
2. Create a second Vercel project that targets `apps/web` and attach `app.domain.com`. Use the build command `yarn turbo run build --filter=web` with output directory `apps/web/.next`.
3. Ensure each project runs `yarn install` as the install command so the shared `@warpx/theme` package is available. Only the app workspace needs private RPC keys; keep landing page environment lean.

Preview deployments will spin up independently, mirroring the production domain routing.

### Staking rewards deployment

LP staking contracts live under `packages/periphery/contracts/rewards`. Deploy a proxy + implementation pair and sync the frontend manifest with:

```sh
yarn deploy-staking
```

Set the following environment variables beforehand (all addresses should be checksum formatted):

- `MEGAETH_STAKING_LP_TOKEN` – WarpX LP token address users will stake (required)
- `MEGAETH_STAKING_REWARD_TOKEN` – reward token address (optional if `MEGAETH_STAKING_REWARD_SYMBOL` is provided)
- `MEGAETH_STAKING_REWARD_SYMBOL` – symbol to look up in `*.tokens.json` when the reward token address isn’t provided
- `MEGAETH_STAKING_OWNER` – address that can update durations, reclaim stray tokens, etc. (defaults to deployer)
- `MEGAETH_STAKING_DISTRIBUTOR` – address allowed to call `notifyRewardAmount` (defaults to owner)
- `MEGAETH_STAKING_PROXY_ADMIN` – proxy admin account for upgrades (defaults to deployer)
- `MEGAETH_STAKING_DURATION` – emission window in seconds (defaults to 7 days)
- `MEGAETH_STAKING_LABEL` – UI label for the staking card (optional)

The script writes `/deployments/<network>.staking.json` and mirrors it to `apps/web/public/deployments`, which powers the staking page in the app. After deploying, transfer reward tokens into the staking contract and call `notifyRewardAmount` to start emissions.

To restart emissions without touching the UI, fund the staking proxy with reward tokens and run:

```sh
MEGAETH_STAKING_CONTRACT=0xyourProxy \
MEGAETH_STAKING_NOTIFY_AMOUNT=25000 \
hardhat run scripts/notify-staking-rewards.ts --network megaethTestnet
```

Set `MEGAETH_STAKING_CONTRACT` to the proxy address and `MEGAETH_STAKING_NOTIFY_AMOUNT` to the number of reward tokens (human-readable, the script handles decimals). The signer must be the `rewardsDistributor`.

Additional helper scripts:

- `yarn notify-staking` – shorthand for the command above. Requires `MEGAETH_STAKING_NOTIFY_AMOUNT` (per emission window) and a distributor key in `MEGAETH_PRIVATE_KEY`.
- `yarn change-staking-admin` – rotates the proxy admin address. Provide `MEGAETH_STAKING_NEW_ADMIN` (target address) and run with the current admin key. The script auto-detects the proxy from the manifest if `MEGAETH_STAKING_CONTRACT` isn’t set.

## Testing

To run the tests for the smart contracts, use the following command:

```sh
yarn test
```

This will run the Hardhat tests for the `core` and `periphery` packages.
