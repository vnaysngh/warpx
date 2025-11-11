import { ethers } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'

type FactoryDeployment = {
  factory: string
}

const resolveFactoryFromManifest = (network: string, baseDir: string): string | null => {
  const candidates = [
    path.join(baseDir, `${network}.json`),
    path.join(baseDir, `${network.toLowerCase()}.json`)
  ]
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue
    try {
      const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as FactoryDeployment
      if (manifest?.factory && ethers.isAddress(manifest.factory)) {
        console.log(`[verify-fee] Loaded factory ${manifest.factory} from ${file}`)
        return ethers.getAddress(manifest.factory)
      }
    } catch (err) {
      console.warn(`[verify-fee] Failed to parse ${file}`, err)
    }
  }
  return null
}

async function main() {
  const network = process.env.HARDHAT_NETWORK ?? 'megaethTestnet'
  const rootDir = path.resolve(__dirname, '..')

  const factoryAddress =
    process.env.WARP_FACTORY_ADDRESS ??
    resolveFactoryFromManifest(network, path.join(rootDir, 'deployments')) ??
    resolveFactoryFromManifest(network, path.join(rootDir, 'apps/web/public/deployments'))
  const treasuryAddress = process.env.WARP_TREASURY_ADDRESS
  const pairAddress = process.env.WARP_PAIR_ADDRESS
  const fromBlockEnv = process.env.WARP_FEE_CHECK_START_BLOCK
  const fromBlock = fromBlockEnv ? Number(fromBlockEnv) : undefined
  const chunkSizeEnv = process.env.WARP_FEE_CHECK_BLOCK_SPAN
  const chunkSize = chunkSizeEnv ? Number(chunkSizeEnv) : 50000
  if (chunkSize <= 0 || Number.isNaN(chunkSize)) {
    throw new Error('WARP_FEE_CHECK_BLOCK_SPAN must be a positive number.')
  }

  if (!factoryAddress || !ethers.isAddress(factoryAddress)) {
    throw new Error('Missing factory address. Set WARP_FACTORY_ADDRESS or ensure deployments/<network>.json exists.')
  }
  if (!pairAddress || !ethers.isAddress(pairAddress)) {
    throw new Error('Set WARP_PAIR_ADDRESS to the pair you want to inspect.')
  }
  if (treasuryAddress && !ethers.isAddress(treasuryAddress)) {
    throw new Error('WARP_TREASURY_ADDRESS is set but not a valid address.')
  }

  const provider = ethers.provider

  const factory = await ethers.getContractAt('WarpFactory', factoryAddress)
  const feeTo = await factory.feeTo()

  console.log('--- Factory ---')
  console.log(`Address     : ${factoryAddress}`)
  console.log(`feeTo       : ${feeTo}`)
  console.log(`feeToSetter : ${await factory.feeToSetter()}`)

  if (treasuryAddress) {
    const normalizedFeeTo = ethers.getAddress(feeTo)
    const normalizedTreasury = ethers.getAddress(treasuryAddress)
    console.log(`Matches treasury? ${normalizedFeeTo === normalizedTreasury ? 'YES' : 'NO'}`)
  }

  const pair = await ethers.getContractAt('WarpPair', pairAddress)
  const [reserve0, reserve1] = await pair.getReserves()
  const kLast = await pair.kLast()
  const totalSupply = await pair.totalSupply()

  console.log('\n--- Pair ---')
  console.log(`Address    : ${pairAddress}`)
  console.log(`token0     : ${await pair.token0()}`)
  console.log(`token1     : ${await pair.token1()}`)
  console.log(`reserve0   : ${reserve0}`)
  console.log(`reserve1   : ${reserve1}`)
  console.log(`totalSupply: ${totalSupply}`)
  console.log(`kLast      : ${kLast}`)

  let scanSummary: string | null = null
  if (treasuryAddress) {
    const mintFilter = pair.filters.Transfer(ethers.ZeroAddress, treasuryAddress)
    console.log('\n--- Minted LP to Treasury ---')
    const latestBlock = await provider.getBlockNumber()
    if (fromBlock !== undefined && fromBlock > latestBlock) {
      console.log(`Start block ${fromBlock} is greater than latest block ${latestBlock}; skipping scan.`)
      scanSummary = `Skipped scan: start block ${fromBlock} > latest block ${latestBlock}.`
    } else {
      const scanStart = fromBlock !== undefined ? fromBlock : Math.max(latestBlock - chunkSize, 0)
      const events: any[] = []

      for (let start = scanStart; start <= latestBlock; start = start + chunkSize) {
        const end = Math.min(start + chunkSize - 1, latestBlock)
        const chunk = await pair.queryFilter(mintFilter, start, end)
        events.push(...chunk)
        if (end === latestBlock) break
      }

      if (events.length === 0) {
        console.log('No LP mints to treasury in the selected range.')
      } else {
        events.forEach((evt) => {
          const amount = evt.args?.value ?? evt.args?.amount ?? evt.args?.[2]
          console.log(
            `Block ${evt.blockNumber} | tx ${evt.transactionHash} | amount ${amount?.toString() ?? 'unknown'}`
          )
        })
      }

      const balance = await pair.balanceOf(treasuryAddress)
      console.log(`\nTreasury LP balance: ${balance}`)
      scanSummary =
        fromBlock !== undefined
          ? `Searched mint events starting from block ${scanStart}.`
          : `Searched mint events over roughly ${chunkSize} blocks (from block ${scanStart}).`
    }
  } else {
    console.log('\nSet WARP_TREASURY_ADDRESS to also scan its LP mints/balance.')
  }

  if (scanSummary) {
    console.log(`\n${scanSummary}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
