import { ethers } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'

type DeploymentAddresses = {
  factory: string
  router: string
  wmegaeth: string
}

const deploymentSummary = (addresses: DeploymentAddresses) => {
  console.log(
    JSON.stringify(
      {
        network: process.env.HARDHAT_NETWORK,
        ...addresses
      },
      null,
      2
    )
  )
}

async function main() {
  const signers = await ethers.getSigners()
  if (signers.length === 0) {
    throw new Error(
      'No signer configured for deployment. Set MEGAETH_PRIVATE_KEY in .env or configure accounts for the megaethTestnet network.'
    )
  }

  const [deployer] = signers
  const deployerAddress = await deployer.getAddress()
  const feeToSetter = process.env.MEGAETH_FEE_TO_SETTER ?? deployerAddress

  console.log(`Using deployer ${deployerAddress}`)
  console.log(`Factory feeToSetter ${feeToSetter}`)

  const Factory = await ethers.getContractFactory('WarpFactory')
  const factory = await Factory.deploy(feeToSetter)
  await factory.waitForDeployment()
  const factoryAddress = await factory.getAddress()
  console.log(`Factory deployed at ${factoryAddress}`)

  const WMegaETH = await ethers.getContractFactory('WMegaETH')
  const wmegaeth = await WMegaETH.deploy()
  await wmegaeth.waitForDeployment()
  const wmegaethAddress = await wmegaeth.getAddress()
  console.log(`WMegaETH deployed at ${wmegaethAddress}`)

  const Router = await ethers.getContractFactory('WarpRouter')
  const router = await Router.deploy(factoryAddress, wmegaethAddress)
  await router.waitForDeployment()
  const routerAddress = await router.getAddress()
  console.log(`Router deployed at ${routerAddress}`)

  deploymentSummary({
    factory: factoryAddress,
    router: routerAddress,
    wmegaeth: wmegaethAddress
  })

  const shouldPersist = process.env.MEGAETH_WRITE_DEPLOYMENT !== 'false'
  if (shouldPersist) {
    const deploymentsDir = process.env.MEGAETH_DEPLOYMENT_DIR
      ? path.resolve(process.env.MEGAETH_DEPLOYMENT_DIR)
      : path.resolve(__dirname, '../../..', 'deployments')
    fs.mkdirSync(deploymentsDir, { recursive: true })
    const network = process.env.HARDHAT_NETWORK ?? 'local'
    const filePath = path.join(deploymentsDir, `${network}.json`)
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          network,
          factory: factoryAddress,
          router: routerAddress,
          wmegaeth: wmegaethAddress,
          feeToSetter: feeToSetter
        },
        null,
        2
      )
    )
    console.log(`Deployment manifest written to ${filePath}`)

    if (process.env.MEGAETH_SYNC_FRONTEND !== 'false') {
      const frontendDir = path.resolve(__dirname, '../../..', 'apps/frontend/public/deployments')
      try {
        fs.mkdirSync(frontendDir, { recursive: true })
        const frontendPath = path.join(frontendDir, `${network}.json`)
        fs.writeFileSync(
          frontendPath,
          JSON.stringify(
            {
              network,
              factory: factoryAddress,
              router: routerAddress,
              wmegaeth: wmegaethAddress,
              feeToSetter
            },
            null,
            2
          )
        )
        console.log(`Frontend manifest synced to ${frontendPath}`)
      } catch (syncError) {
        console.warn('Unable to sync frontend deployment manifest:', syncError)
      }
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
