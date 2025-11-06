import { expect } from 'chai'
import { artifacts, ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'

import { getCreate2Address } from './shared/utilities'
import { factoryFixture } from './shared/fixtures'

const TEST_ADDRESSES: [string, string] = [
  '0x1000000000000000000000000000000000000000',
  '0x2000000000000000000000000000000000000000'
]

describe('WarpFactory', () => {
  let wallet: any
  let other: any
  let factory: any

  beforeEach(async () => {
    const fixture = await loadFixture(factoryFixture)
    wallet = fixture.wallet
    other = fixture.other
    factory = fixture.factory
  })

  it('feeTo, feeToSetter, allPairsLength', async () => {
    expect(await factory.feeTo()).to.eq(ethers.ZeroAddress)
    expect(await factory.feeToSetter()).to.eq(wallet.address)
    expect(await factory.allPairsLength()).to.eq(0n)
  })

  async function createPair(tokens: [string, string]) {
    const warpPairArtifact = await artifacts.readArtifact('packages/core/contracts/WarpPair.sol:WarpPair')
    const create2Address = getCreate2Address(await factory.getAddress(), tokens, warpPairArtifact.bytecode)

    await expect(factory.createPair(...tokens))
      .to.emit(factory, 'PairCreated')
      .withArgs(TEST_ADDRESSES[0], TEST_ADDRESSES[1], create2Address, 1n)

    await expect(factory.createPair(...tokens)).to.be.reverted
    await expect(factory.createPair(...tokens.slice().reverse() as [string, string])).to.be.reverted

    expect(await factory.getPair(...tokens)).to.eq(create2Address)
    expect(await factory.getPair(...tokens.slice().reverse() as [string, string])).to.eq(create2Address)
    expect(await factory.allPairs(0)).to.eq(create2Address)
    expect(await factory.allPairsLength()).to.eq(1n)

    const pair = await ethers.getContractAt('packages/core/contracts/WarpPair.sol:WarpPair', create2Address)
    expect(await pair.factory()).to.eq(await factory.getAddress())
    expect(await pair.token0()).to.eq(TEST_ADDRESSES[0])
    expect(await pair.token1()).to.eq(TEST_ADDRESSES[1])
  }

  it('createPair', async () => {
    await createPair(TEST_ADDRESSES)
  })

  it('createPair:reverse', async () => {
    await createPair(TEST_ADDRESSES.slice().reverse() as [string, string])
  })

  it('createPair:gas', async () => {
    const tx = await factory.createPair(...TEST_ADDRESSES)
    const receipt = await tx.wait()
    expect(receipt).to.not.be.null
    expect(receipt!.gasUsed).to.eq(2008307n)
  })

  it('setFeeTo', async () => {
    await expect(factory.connect(other).setFeeTo(other.address)).to.be.revertedWith('Warp: FORBIDDEN')
    await factory.setFeeTo(wallet.address)
    expect(await factory.feeTo()).to.eq(wallet.address)
  })

  it('setFeeToSetter', async () => {
    await expect(factory.connect(other).setFeeToSetter(other.address)).to.be.revertedWith('Warp: FORBIDDEN')
    await factory.setFeeToSetter(other.address)
    expect(await factory.feeToSetter()).to.eq(other.address)
    await expect(factory.setFeeToSetter(wallet.address)).to.be.revertedWith('Warp: FORBIDDEN')
  })
})
