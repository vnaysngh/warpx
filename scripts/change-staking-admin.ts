import { ethers } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'

type StakingManifest = {
  network: string
  programs: Array<{ contract: string }>
}

const resolveProxyFromManifest = (network: string, baseDir: string): string | null => {
  const files = [
    path.join(baseDir, `${network}.staking.json`),
    path.join(baseDir, `${network.toLowerCase()}.staking.json`)
  ]
  for (const file of files) {
    if (!fs.existsSync(file)) continue
    try {
      const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as StakingManifest
      const program = manifest.programs?.[0]
      if (program && ethers.isAddress(program.contract)) {
        console.log(`[admin] Loaded proxy ${program.contract} from ${file}`)
        return ethers.getAddress(program.contract)
      }
    } catch (error) {
      console.warn(`[admin] Failed to parse ${file}`, error)
    }
  }
  return null
}

async function main() {
  const network = process.env.HARDHAT_NETWORK ?? 'megaethTestnet'
  const rootDir = path.resolve(__dirname, '..')
  const proxyAddress =
    process.env.MEGAETH_STAKING_CONTRACT ??
    resolveProxyFromManifest(network, path.join(rootDir, 'deployments')) ??
    resolveProxyFromManifest(network, path.join(rootDir, 'apps/web/public/deployments'))
  const newAdmin = process.env.MEGAETH_STAKING_NEW_ADMIN

  if (!proxyAddress || !ethers.isAddress(proxyAddress)) {
    throw new Error(
      'Set MEGAETH_STAKING_CONTRACT or ensure deployments/<network>.staking.json exists with a valid proxy address.'
    )
  }
  if (!newAdmin || !ethers.isAddress(newAdmin)) {
    throw new Error('Set MEGAETH_STAKING_NEW_ADMIN to the address that should become proxy admin')
  }

  const [signer] = await ethers.getSigners()
  if (!signer) {
    throw new Error('No signer configured. Set MEGAETH_PRIVATE_KEY for the current proxy admin.')
  }
  const signerAddress = await signer.getAddress()

  console.log(`Current admin signer: ${signerAddress}`)
  console.log(`Proxy: ${proxyAddress}`)
  console.log(`New admin: ${newAdmin}`)

  const proxy = await ethers.getContractAt(
    'packages/periphery/contracts/rewards/WarpStakingRewardsProxy.sol:WarpStakingRewardsProxy',
    proxyAddress,
    signer
  )
  const currentAdmin = await proxy.admin()
  if (currentAdmin.toLowerCase() !== signerAddress.toLowerCase()) {
    throw new Error(`Signer ${signerAddress} is not the current admin (${currentAdmin}).`)
  }

  const tx = await proxy.changeAdmin(newAdmin)
  console.log(`Submitted tx: ${tx.hash}`)
  await tx.wait()
  console.log('Admin updated successfully.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
