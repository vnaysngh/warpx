import { ethers } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'

const DEFAULT_REWARDS_DURATION = 7 * 24 * 60 * 60 // 7 days

type StakingProgram = {
  label: string
  contract: string
  implementation: string
  stakingToken: string
  rewardsToken: string
  rewardsDuration: number
  owner: string
  rewardsDistributor: string
  proxyAdmin: string
}

type StakingManifest = {
  network: string
  programs: StakingProgram[]
}

const isAddress = (value?: string | null): value is string =>
  Boolean(value && ethers.isAddress(value))

const normalizeAddress = (value: string, label: string) => {
  if (!isAddress(value)) {
    throw new Error(`Missing or invalid ${label}. Received: ${value ?? 'undefined'}`)
  }
  return ethers.getAddress(value)
}

const loadJson = <T>(filePath: string, fallback: T): T => {
  if (!fs.existsSync(filePath)) {
    return fallback
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(raw) as T
  } catch (error) {
    console.warn(`[staking] Failed to parse ${filePath}, regenerating`, error)
    return fallback
  }
}

const writeManifest = (filePath: string, network: string, program: StakingProgram) => {
  const manifest = loadJson<StakingManifest>(filePath, { network, programs: [] })
  const stakingTokenLower = program.stakingToken.toLowerCase()
  const filtered = manifest.programs.filter((entry) => entry.stakingToken.toLowerCase() !== stakingTokenLower)
  manifest.network = network
  manifest.programs = [...filtered, program]
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2))
  console.log(`[staking] Manifest written to ${filePath}`)
}

const findTokenAddress = (symbol: string, network: string, searchDirs: string[]): string | null => {
  for (const dir of searchDirs) {
    const candidate = path.join(dir, `${network}.tokens.json`)
    const lowercaseCandidate = path.join(dir, `${network.toLowerCase()}.tokens.json`)
    const files = [candidate, lowercaseCandidate]
    for (const file of files) {
      if (!fs.existsSync(file)) continue
      try {
        const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
        const token = (manifest.tokens || []).find(
          (entry: any) => typeof entry.symbol === 'string' && entry.symbol.toLowerCase() === symbol.toLowerCase()
        )
        if (token && isAddress(token.address)) {
          console.log(`[staking] Matched ${symbol} in ${file}`)
          return ethers.getAddress(token.address)
        }
      } catch (error) {
        console.warn(`[staking] Unable to inspect ${file}`, error)
      }
    }
  }
  return null
}

async function main() {
  const [deployer] = await ethers.getSigners()
  const deployerAddress = await deployer.getAddress()
  const network = process.env.HARDHAT_NETWORK ?? 'megaethTestnet'

  const rootDir = path.resolve(__dirname, '../../..')
  const deploymentsDir = path.join(rootDir, 'deployments')
  const frontendDir = path.join(rootDir, 'apps/web/public/deployments')

  const stakingTokenEnv = process.env.MEGAETH_STAKING_LP_TOKEN ?? process.env.STAKING_LP_TOKEN
  const stakingToken = normalizeAddress(stakingTokenEnv ?? '', 'MEGAETH_STAKING_LP_TOKEN')

  let rewardsToken: string | null = process.env.MEGAETH_STAKING_REWARD_TOKEN ?? null
  const rewardSymbol = process.env.MEGAETH_STAKING_REWARD_SYMBOL
  if (!rewardsToken && rewardSymbol) {
    rewardsToken = findTokenAddress(rewardSymbol, network, [frontendDir, deploymentsDir])
  }
  if (!rewardsToken) {
    throw new Error(
      'Set MEGAETH_STAKING_REWARD_TOKEN or provide MEGAETH_STAKING_REWARD_SYMBOL that exists in the token manifest.'
    )
  }
  rewardsToken = normalizeAddress(rewardsToken, 'MEGAETH_STAKING_REWARD_TOKEN')

  const proxyAdminEnv = process.env.MEGAETH_STAKING_PROXY_ADMIN ?? process.env.STAKING_PROXY_ADMIN ?? deployerAddress
  const proxyAdmin = normalizeAddress(proxyAdminEnv, 'MEGAETH_STAKING_PROXY_ADMIN')
  const ownerEnv = process.env.MEGAETH_STAKING_OWNER ?? process.env.STAKING_OWNER ?? deployerAddress
  const owner = normalizeAddress(ownerEnv, 'MEGAETH_STAKING_OWNER')
  const distributorEnv = process.env.MEGAETH_STAKING_DISTRIBUTOR ?? process.env.STAKING_DISTRIBUTOR ?? owner
  const rewardsDistributor = normalizeAddress(distributorEnv, 'MEGAETH_STAKING_DISTRIBUTOR')

  const durationSeconds = process.env.MEGAETH_STAKING_DURATION
    ? Number(process.env.MEGAETH_STAKING_DURATION)
    : DEFAULT_REWARDS_DURATION
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('MEGAETH_STAKING_DURATION must be a positive number of seconds')
  }

  const rewardsDuration = BigInt(durationSeconds)
  const label = process.env.MEGAETH_STAKING_LABEL ?? 'WarpX LP Staking'

  console.log('--- WarpX LP Staking Deployment ---')
  console.log(`Network: ${network}`)
  console.log(`Deployer: ${deployerAddress}`)
  console.log(`Proxy admin: ${proxyAdmin}`)
  console.log(`Owner: ${owner}`)
  console.log(`Distributor: ${rewardsDistributor}`)
  console.log(`Staking token: ${stakingToken}`)
  console.log(`Rewards token: ${rewardsToken}`)
  console.log(`Rewards duration: ${rewardsDuration.toString()} seconds`)

  const Staking = await ethers.getContractFactory('WarpStakingRewards')
  const logic = await Staking.deploy()
  await logic.waitForDeployment()
  const implementationAddress = await logic.getAddress()
  console.log(`Implementation deployed at ${implementationAddress}`)

  const initData = Staking.interface.encodeFunctionData('initialize', [
    owner,
    rewardsToken,
    stakingToken,
    rewardsDuration,
    rewardsDistributor
  ])

  const Proxy = await ethers.getContractFactory('WarpStakingRewardsProxy')
  const proxy = await Proxy.deploy(implementationAddress, initData)
  await proxy.waitForDeployment()
  const proxyAddress = await proxy.getAddress()
  console.log(`Proxy deployed at ${proxyAddress}`)

  if (proxyAdmin.toLowerCase() !== deployerAddress.toLowerCase()) {
    console.log(`Transferring proxy admin to ${proxyAdmin}`)
    const tx = await proxy.changeAdmin(proxyAdmin)
    await tx.wait()
  }

  const program: StakingProgram = {
    label,
    contract: proxyAddress,
    implementation: implementationAddress,
    stakingToken,
    rewardsToken,
    rewardsDuration: Number(rewardsDuration),
    owner,
    rewardsDistributor,
    proxyAdmin
  }

  writeManifest(path.join(deploymentsDir, `${network}.staking.json`), network, program)
  writeManifest(path.join(frontendDir, `${network}.staking.json`), network, program)

  console.log('\nDeployment complete. Fund the staking contract with rewards and call notifyRewardAmount() to begin emissions.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

