import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-ethers'
import '@nomicfoundation/hardhat-chai-matchers'
import '@nomicfoundation/hardhat-network-helpers'
import 'hardhat-gas-reporter'
import 'solidity-coverage'
import * as dotenv from 'dotenv'

dotenv.config()

const optimizerSettings = {
  enabled: true,
  runs: 200
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      { version: '0.5.16', settings: { optimizer: optimizerSettings } },
      { version: '0.6.6', settings: { optimizer: optimizerSettings } },
      { version: '0.6.12', settings: { optimizer: optimizerSettings } }
    ]
  },
  paths: {
    sources: 'packages',
    tests: 'test'
  },
  networks: {
    megaethTestnet: {
      url: process.env.MEGAETH_RPC_URL || 'https://carrot.megaeth.com/rpc',
      accounts: process.env.MEGAETH_PRIVATE_KEY ? [process.env.MEGAETH_PRIVATE_KEY] : [],
      gasPrice: process.env.MEGAETH_GAS_PRICE ? parseInt(process.env.MEGAETH_GAS_PRICE, 10) : undefined
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    showTimeSpent: true
  }
}

export default config
