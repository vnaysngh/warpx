# WarpX

WarpX is a decentralized exchange (DEX) built on the Ethereum blockchain. It implements a Warp V2 automated market maker that allows users to swap ERC20 tokens.

## Project Structure

This project is a monorepo managed by Turborepo. It contains the following packages:

-   `apps/web`: A Next.js web application that provides the main user interface for the DEX.
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

This will start the Next.js development server at `http://localhost:3000`.

## Packages

### `apps/web`

This is the main web application for the WarpX DEX. It is built with Next.js and uses the following libraries:

-   [Wagmi](https://wagmi.sh/): For interacting with the Ethereum blockchain.
-   [Ethers.js](https://docs.ethers.io/): For interacting with the Ethereum blockchain.
-   [NextUI](https://nextui.org/): For the UI components.

### `packages/core`

This package contains the core smart contracts for the DEX. The contracts are written in Solidity and power the Warp V2 AMM.

-   `WarpFactory.sol`: The factory contract for creating new token pairs.
-   `WarpPair.sol`: The contract for a single token pair.
-   `WarpERC20.sol`: An ERC20 token contract used for testing.

### `packages/periphery`

This package contains the router smart contracts for interacting with the core contracts.

-   `WarpRouter.sol`: The router contract for swapping tokens.
-   `WarpRouter01.sol`: Legacy router interface maintained for compatibility.

## Testing

To run the tests for the smart contracts, use the following command:

```sh
yarn test
```

This will run the Hardhat tests for the `core` and `periphery` packages.
