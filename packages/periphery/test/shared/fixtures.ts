import { Wallet, Contract } from 'ethers'
import { Web3Provider } from 'ethers/providers'
import { deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from './utilities'

import WarpFactory from '../../../../artifacts/packages/core/contracts/WarpFactory.sol/WarpFactory.json'
import WarpPairArtifact from '../../../../artifacts/packages/core/contracts/WarpPair.sol/WarpPair.json'

import ERC20 from '../../../../artifacts/packages/periphery/contracts/test/ERC20.sol/ERC20.json'
import WETH9 from '../../../../artifacts/packages/periphery/contracts/test/WETH9.sol/WETH9.json'
import WarpV1Exchange from '../../buildV1/WarpV1Exchange.json'
import WarpV1Factory from '../../buildV1/WarpV1Factory.json'
import WarpRouter01 from '../../../../artifacts/packages/periphery/contracts/WarpRouter01.sol/WarpRouter01.json'
import WarpMigrator from '../../../../artifacts/packages/periphery/contracts/WarpMigrator.sol/WarpMigrator.json'
import WarpRouter02 from '../../../../artifacts/packages/periphery/contracts/WarpRouter.sol/WarpRouter.json'
import RouterEventEmitter from '../../../../artifacts/packages/periphery/contracts/test/RouterEventEmitter.sol/RouterEventEmitter.json'

const overrides = {
  gasLimit: 9999999
}

interface V2Fixture {
  token0: Contract
  token1: Contract
  WETH: Contract
  WETHPartner: Contract
  factoryV1: Contract
  factoryV2: Contract
  router01: Contract
  router02: Contract
  routerEventEmitter: Contract
  router: Contract
  migrator: Contract
  WETHExchangeV1: Contract
  pair: Contract
  WETHPair: Contract
}

export async function v2Fixture(provider: Web3Provider, [wallet]: Wallet[]): Promise<V2Fixture> {
  // deploy tokens
  const tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
  const tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
  const WETH = await deployContract(wallet, WETH9)
  const WETHPartner = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])

  // deploy V1
  const factoryV1 = await deployContract(wallet, WarpV1Factory, [])
  await factoryV1.initializeFactory((await deployContract(wallet, WarpV1Exchange, [])).address)

  // deploy V2
  const factoryV2 = await deployContract(wallet, WarpFactory, [wallet.address])

  // deploy routers
  const router01 = await deployContract(wallet, WarpRouter01, [factoryV2.address, WETH.address], overrides)
  const router02 = await deployContract(wallet, WarpRouter02, [factoryV2.address, WETH.address], overrides)

  // event emitter for testing
  const routerEventEmitter = await deployContract(wallet, RouterEventEmitter, [])

  // deploy migrator
  const migrator = await deployContract(wallet, WarpMigrator, [factoryV1.address, router01.address], overrides)

  // initialize V1
  await factoryV1.createExchange(WETHPartner.address, overrides)
  const WETHExchangeV1Address = await factoryV1.getExchange(WETHPartner.address)
  const WETHExchangeV1 = new Contract(WETHExchangeV1Address, JSON.stringify(WarpV1Exchange.abi), provider).connect(
    wallet
  )

  // initialize V2
  await factoryV2.createPair(tokenA.address, tokenB.address)
  const pairAddress = await factoryV2.getPair(tokenA.address, tokenB.address)
  const pair = new Contract(pairAddress, JSON.stringify(WarpPairArtifact.abi), provider).connect(wallet)

  const token0Address = await pair.token0()
  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  await factoryV2.createPair(WETH.address, WETHPartner.address)
  const WETHPairAddress = await factoryV2.getPair(WETH.address, WETHPartner.address)
  const WETHPair = new Contract(WETHPairAddress, JSON.stringify(WarpPairArtifact.abi), provider).connect(wallet)

  return {
    token0,
    token1,
    WETH,
    WETHPartner,
    factoryV1,
    factoryV2,
    router01,
    router02,
    router: router02, // the default router, 01 had a minor bug
    routerEventEmitter,
    migrator,
    WETHExchangeV1,
    pair,
    WETHPair
  }
}
