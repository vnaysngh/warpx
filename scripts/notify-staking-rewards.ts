import { ethers } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'

type StakingManifest = {
  network: string
  programs: Array<{
    contract: string
    stakingToken: string
    rewardsToken: string
    label?: string
  }>
}

const resolveManifestContract = (network: string, fallbackDir: string): string | null => {
  const files = [
    path.join(fallbackDir, `${network}.staking.json`),
    path.join(fallbackDir, `${network.toLowerCase()}.staking.json`)
  ]
  for (const file of files) {
    if (!fs.existsSync(file)) continue
    try {
      const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as StakingManifest
      const program = manifest.programs?.[0]
      if (program && ethers.isAddress(program.contract)) {
        console.log(`[notify] Loaded staking contract ${program.contract} from ${file}`)
        return ethers.getAddress(program.contract)
      }
    } catch (error) {
      console.warn(`[notify] Failed to parse ${file}`, error)
    }
  }
  return null
}

async function main() {
  const network = process.env.HARDHAT_NETWORK ?? 'megaethTestnet'
  const rootDir = path.resolve(__dirname, '..')
  const stakingAddress =
    process.env.MEGAETH_STAKING_CONTRACT ??
    resolveManifestContract(network, path.join(rootDir, 'deployments')) ??
    resolveManifestContract(network, path.join(rootDir, 'apps/web/public/deployments'))

  const rawAmount = process.env.MEGAETH_STAKING_NOTIFY_AMOUNT

  if (!stakingAddress || !ethers.isAddress(stakingAddress)) {
    throw new Error(
      'Set MEGAETH_STAKING_CONTRACT or ensure deployments/<network>.staking.json exists with a valid contract address.'
    )
  }
  if (!rawAmount) {
    throw new Error('Set MEGAETH_STAKING_NOTIFY_AMOUNT to the reward amount (e.g. "25000")')
  }

  const [signer] = await ethers.getSigners()
  if (!signer) {
    throw new Error('No signer configured. Set MEGAETH_PRIVATE_KEY for the distributor account.')
  }
  const distributor = await signer.getAddress()
  console.log(`Distributor: ${distributor}`)
  console.log(`Network: ${network}`)

  const staking = await ethers.getContractAt(
    'packages/periphery/contracts/rewards/WarpStakingRewards.sol:WarpStakingRewards',
    stakingAddress,
    signer
  )
  const rewardsToken = await staking.rewardsToken()
  const rewardsTokenContract = await ethers.getContractAt(
    'packages/periphery/contracts/interfaces/IERC20.sol:IERC20',
    rewardsToken,
    signer
  )

  const decimals = await rewardsTokenContract.decimals()
  const amount = ethers.parseUnits(rawAmount, decimals)

  const balance = await rewardsTokenContract.balanceOf(stakingAddress)
  if (balance < amount) {
    console.warn(
      `[notify] Warning: staking contract holds ${ethers.formatUnits(balance, decimals)} tokens, which is less than the requested ${rawAmount}.`
    )
  }

  console.log(`Calling notifyRewardAmount(${rawAmount}) on ${stakingAddress}`)
  const tx = await staking.notifyRewardAmount(amount)
  console.log(`Submitted tx: ${tx.hash}`)
  await tx.wait()
  console.log('Rewards schedule updated.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
