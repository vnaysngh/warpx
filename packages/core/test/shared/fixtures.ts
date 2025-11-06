import { Contract } from 'ethers'
import { ethers } from 'hardhat'

import { expandTo18Decimals } from './utilities'

type FactoryFixtureResult = {
  factory: Contract
  wallet: Awaited<ReturnType<typeof ethers.getSigners>>[number]
  other: Awaited<ReturnType<typeof ethers.getSigners>>[number]
}

export async function factoryFixture(): Promise<FactoryFixtureResult> {
  const [wallet, other] = await ethers.getSigners()
  const factoryContract = await ethers.getContractFactory('packages/core/contracts/WarpFactory.sol:WarpFactory', wallet)
  const factory = await factoryContract.deploy(wallet.address)
  await factory.waitForDeployment()
  return { factory, wallet, other }
}

type PairFixtureResult = FactoryFixtureResult & {
  token0: Contract
  token1: Contract
  pair: Contract
}

export async function pairFixture(): Promise<PairFixtureResult> {
  const { factory, wallet, other } = await factoryFixture()

  const erc20Factory = await ethers.getContractFactory('packages/core/contracts/test/ERC20.sol:ERC20', wallet)
  const tokenA = await erc20Factory.deploy(expandTo18Decimals(10000))
  const tokenB = await erc20Factory.deploy(expandTo18Decimals(10000))
  await tokenA.waitForDeployment()
  await tokenB.waitForDeployment()

  const tokenAAddress = await tokenA.getAddress()
  const tokenBAddress = await tokenB.getAddress()

  const createPairTx = await factory.createPair(tokenAAddress, tokenBAddress)
  await createPairTx.wait()
  const pairAddress = await factory.getPair(tokenAAddress, tokenBAddress)

  const pair = await ethers.getContractAt('packages/core/contracts/WarpPair.sol:WarpPair', pairAddress, wallet)

  const token0Address = await pair.token0()
  const token0 = tokenAAddress.toLowerCase() === token0Address.toLowerCase() ? tokenA : tokenB
  const token1 = tokenAAddress.toLowerCase() === token0Address.toLowerCase() ? tokenB : tokenA

  return { factory, wallet, other, token0, token1, pair }
}
