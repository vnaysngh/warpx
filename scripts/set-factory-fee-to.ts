import { ethers } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'

type FactoryDeployment = {
  network: string
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
        console.log(`[feeTo] Loaded factory ${manifest.factory} from ${file}`)
        return ethers.getAddress(manifest.factory)
      }
    } catch (error) {
      console.warn(`[feeTo] Failed to parse ${file}`, error)
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

  if (!factoryAddress || !ethers.isAddress(factoryAddress)) {
    throw new Error(
      'Set WARP_FACTORY_ADDRESS or ensure deployments/<network>.json includes a valid `factory` field.'
    )
  }
  if (!treasuryAddress || !ethers.isAddress(treasuryAddress)) {
    throw new Error('Set WARP_TREASURY_ADDRESS to the target fee recipient address.')
  }

  const [signer] = await ethers.getSigners()
  if (!signer) {
    throw new Error('No signer available. Configure MEGAETH_PRIVATE_KEY for the feeToSetter account.')
  }

  const signerAddress = await signer.getAddress()
  console.log(`[feeTo] Signer:   ${signerAddress}`)
  console.log(`[feeTo] Factory:  ${factoryAddress}`)
  console.log(`[feeTo] Treasury: ${treasuryAddress}`)

  const factory = await ethers.getContractAt('WarpFactory', factoryAddress, signer)
  const setter = await factory.feeToSetter()
  if (setter.toLowerCase() !== signerAddress.toLowerCase()) {
    throw new Error(`Signer ${signerAddress} is not the current feeToSetter (${setter}).`)
  }

  const currentFeeTo = await factory.feeTo()
  if (currentFeeTo.toLowerCase() === treasuryAddress.toLowerCase()) {
    console.log('[feeTo] Treasury already set. Nothing to do.')
    return
  }

  const tx = await factory.setFeeTo(treasuryAddress)
  console.log(`[feeTo] Submitted tx: ${tx.hash}`)
  await tx.wait()
  console.log('[feeTo] feeTo updated successfully.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
