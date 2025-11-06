import { expect } from 'chai'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { ethers } from 'hardhat'

import { encodePrice, expandTo18Decimals, mineBlock } from './shared/utilities'
import { pairFixture } from './shared/fixtures'

const MINIMUM_LIQUIDITY = 1000n
const SINGLE_SWAP_OUTPUT = 1662497915624478906n

describe('WarpPair', () => {
  let wallet: any
  let other: any
  let factory: any
  let token0: any
  let token1: any
  let pair: any

  beforeEach(async () => {
    const fixture = await loadFixture(pairFixture)
    wallet = fixture.wallet
    other = fixture.other
    factory = fixture.factory
    token0 = fixture.token0
    token1 = fixture.token1
    pair = fixture.pair
  })

  it('mint', async () => {
    const token0Amount = expandTo18Decimals(1)
    const token1Amount = expandTo18Decimals(4)
    await token0.transfer(await pair.getAddress(), token0Amount)
    await token1.transfer(await pair.getAddress(), token1Amount)

    const expectedLiquidity = expandTo18Decimals(2)
    await expect(pair.mint(wallet.address))
      .to.emit(pair, 'Transfer')
      .withArgs(ethers.ZeroAddress, ethers.ZeroAddress, MINIMUM_LIQUIDITY)
      .to.emit(pair, 'Transfer')
      .withArgs(ethers.ZeroAddress, wallet.address, expectedLiquidity - MINIMUM_LIQUIDITY)
      .to.emit(pair, 'Sync')
      .withArgs(token0Amount, token1Amount)
      .to.emit(pair, 'Mint')
      .withArgs(wallet.address, token0Amount, token1Amount)

    expect(await pair.totalSupply()).to.eq(expectedLiquidity)
    expect(await pair.balanceOf(wallet.address)).to.eq(expectedLiquidity - MINIMUM_LIQUIDITY)
    expect(await token0.balanceOf(await pair.getAddress())).to.eq(token0Amount)
    expect(await token1.balanceOf(await pair.getAddress())).to.eq(token1Amount)
    const reserves = await pair.getReserves()
    expect(reserves[0]).to.eq(token0Amount)
    expect(reserves[1]).to.eq(token1Amount)
  })

  async function addLiquidity(token0Amount: bigint, token1Amount: bigint) {
    await token0.transfer(await pair.getAddress(), token0Amount)
    await token1.transfer(await pair.getAddress(), token1Amount)
    await pair.mint(wallet.address)
  }

  const rawSwapTestCases: Array<[number, number, number, string]> = [
    [1, 5, 10, '1662497915624478906'],
    [1, 10, 5, '453305446940074565'],
    [2, 5, 10, '2851015155847869602'],
    [2, 10, 5, '831248957812239453'],
    [1, 10, 10, '906610893880149131'],
    [1, 100, 100, '987158034397061298'],
    [1, 1000, 1000, '996006981039903216']
  ]

  const swapTestCases: Array<[bigint, bigint, bigint, bigint]> = rawSwapTestCases.map(
    ([swapAmount, token0Amount, token1Amount, expectedOutput]) => [
      expandTo18Decimals(swapAmount),
      expandTo18Decimals(token0Amount),
      expandTo18Decimals(token1Amount),
      BigInt(expectedOutput)
    ]
  )

  const rawOptimisticCases: Array<[string, number, number]> = [
    ['997997998000000000', 5, 10],
    ['997997998000000000', 10, 5],
    ['997997998000000000', 10, 10],
    ['997997998000000000', 100, 100],
    ['997997998000000000', 1000, 1000]
  ]

  const optimisticTestCases: Array<[bigint, bigint, bigint]> = rawOptimisticCases.map(
    ([sqrtPrice, token0Amount, token1Amount]) => [
      BigInt(sqrtPrice),
      expandTo18Decimals(token0Amount),
      expandTo18Decimals(token1Amount)
    ]
  )

  swapTestCases.forEach(([swapAmount, token0Amount, token1Amount, expectedOutputAmount]) => {
    it(`getInputPrice:${swapAmount.toString()}:${token0Amount.toString()}:${token1Amount.toString()}`, async () => {
      await addLiquidity(token0Amount, token1Amount)
      await token0.transfer(await pair.getAddress(), swapAmount)
      await expect(pair.swap(expectedOutputAmount, 0n, wallet.address, '0x'))
        .to.emit(token0, 'Transfer')
        .withArgs(wallet.address, await pair.getAddress(), swapAmount)
        .to.emit(token1, 'Transfer')
        .withArgs(await pair.getAddress(), wallet.address, expectedOutputAmount)
        .to.emit(pair, 'Sync')
        .withArgs(token0Amount + swapAmount, token1Amount - expectedOutputAmount)
        .to.emit(pair, 'Swap')
        .withArgs(wallet.address, swapAmount, 0n, 0n, expectedOutputAmount, wallet.address)
    })
  })

  optimisticTestCases.forEach(([sqrtPrice, token0Amount, token1Amount]) => {
    it(`swap:gas:${sqrtPrice.toString()}:${token0Amount.toString()}:${token1Amount.toString()}`, async () => {
      await addLiquidity(token0Amount, token1Amount)
      await token0.transfer(await pair.getAddress(), swapTestCases[0][0])
      const tx = await pair.swap(0n, swapTestCases[0][3], wallet.address, '0x')
      const receipt = await tx.wait()
      expect(receipt).to.not.be.null
      expect(receipt!.gasUsed).to.eq(73102n)
    })
  })

  it('swap:token0', async () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0Amount, token1Amount)
    await token0.transfer(await pair.getAddress(), expandTo18Decimals(1))
    await expect(pair.swap(SINGLE_SWAP_OUTPUT, 0n, wallet.address, '0x'))
      .to.emit(pair, 'Swap')
      .withArgs(wallet.address, expandTo18Decimals(1), 0n, SINGLE_SWAP_OUTPUT, 0n, wallet.address)
  })

  it('swap:token1', async () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0Amount, token1Amount)
    await token1.transfer(await pair.getAddress(), expandTo18Decimals(1))
    await expect(pair.swap(0n, SINGLE_SWAP_OUTPUT, wallet.address, '0x'))
      .to.emit(pair, 'Swap')
      .withArgs(wallet.address, 0n, expandTo18Decimals(1), 0n, SINGLE_SWAP_OUTPUT, wallet.address)
  })

  it('swap:gas:token0', async () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0Amount, token1Amount)
    await token0.transfer(await pair.getAddress(), expandTo18Decimals(1))
    const tx = await pair.swap(SINGLE_SWAP_OUTPUT, 0n, wallet.address, '0x')
    const receipt = await tx.wait()
    expect(receipt).to.not.be.null
    expect(receipt!.gasUsed).to.eq(73102n)
  })

  it('swap:gas:token1', async () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0Amount, token1Amount)
    await token1.transfer(await pair.getAddress(), expandTo18Decimals(1))
    const tx = await pair.swap(0n, SINGLE_SWAP_OUTPUT, wallet.address, '0x')
    const receipt = await tx.wait()
    expect(receipt).to.not.be.null
    expect(receipt!.gasUsed).to.eq(73102n)
  })

  it('burn', async () => {
    const token0Amount = expandTo18Decimals(3)
    const token1Amount = expandTo18Decimals(3)
    await addLiquidity(token0Amount, token1Amount)

    const expectedLiquidity = expandTo18Decimals(3)
    await pair.transfer(await pair.getAddress(), expectedLiquidity - MINIMUM_LIQUIDITY)
    await expect(pair.burn(wallet.address))
      .to.emit(pair, 'Transfer')
      .withArgs(wallet.address, await pair.getAddress(), expectedLiquidity - MINIMUM_LIQUIDITY)
      .to.emit(token0, 'Transfer')
      .withArgs(await pair.getAddress(), wallet.address, token0Amount - MINIMUM_LIQUIDITY)
      .to.emit(token1, 'Transfer')
      .withArgs(await pair.getAddress(), wallet.address, token1Amount - MINIMUM_LIQUIDITY)
      .to.emit(pair, 'Burn')
      .withArgs(wallet.address, token0Amount - MINIMUM_LIQUIDITY, token1Amount - MINIMUM_LIQUIDITY, wallet.address)

    expect(await pair.balanceOf(wallet.address)).to.eq(0n)
    expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY)
    expect(await token0.balanceOf(await pair.getAddress())).to.eq(MINIMUM_LIQUIDITY)
    expect(await token1.balanceOf(await pair.getAddress())).to.eq(MINIMUM_LIQUIDITY)
  })

  it('price{0,1}CumulativeLast', async () => {
    const token0Amount = expandTo18Decimals(3)
    const token1Amount = expandTo18Decimals(3)
    await addLiquidity(token0Amount, token1Amount)

    const latestBlock = await ethers.provider.getBlock('latest')
    if (!latestBlock) {
      throw new Error('failed to fetch block')
    }
    const blockTimestamp = latestBlock.timestamp
    const initialPrice = encodePrice(token0Amount, token1Amount)

    expect(await pair.price0CumulativeLast()).to.eq(0n)
    expect(await pair.price1CumulativeLast()).to.eq(0n)
    expect((await pair.getReserves())[2]).to.eq(blockTimestamp)

    await mineBlock(blockTimestamp + 1)
    await pair.sync()

    expect(await pair.price0CumulativeLast()).to.eq(initialPrice[0])
    expect(await pair.price1CumulativeLast()).to.eq(initialPrice[1])
    expect((await pair.getReserves())[2]).to.eq(blockTimestamp + 1)

    const swapAmount = expandTo18Decimals(3)
    await token0.transfer(await pair.getAddress(), swapAmount)
    await mineBlock(blockTimestamp + 10)
    await pair.swap(0n, expandTo18Decimals(1), wallet.address, '0x')

    expect(await pair.price0CumulativeLast()).to.eq(initialPrice[0] * 10n)
    expect(await pair.price1CumulativeLast()).to.eq(initialPrice[1] * 10n)
    expect((await pair.getReserves())[2]).to.eq(blockTimestamp + 10)

    await mineBlock(blockTimestamp + 20)
    await pair.sync()

    const newPrice = encodePrice(expandTo18Decimals(6), expandTo18Decimals(2))
    expect(await pair.price0CumulativeLast()).to.eq(initialPrice[0] * 10n + newPrice[0] * 10n)
    expect(await pair.price1CumulativeLast()).to.eq(initialPrice[1] * 10n + newPrice[1] * 10n)
    expect((await pair.getReserves())[2]).to.eq(blockTimestamp + 20)
  })

  it('feeTo:off', async () => {
    const token0Amount = expandTo18Decimals(1000)
    const token1Amount = expandTo18Decimals(1000)
    await addLiquidity(token0Amount, token1Amount)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = 996006981039903216n
    await token1.transfer(await pair.getAddress(), swapAmount)
    await pair.swap(expectedOutputAmount, 0n, wallet.address, '0x')

    const expectedLiquidity = expandTo18Decimals(1000)
    await pair.transfer(await pair.getAddress(), expectedLiquidity - MINIMUM_LIQUIDITY)
    await pair.burn(wallet.address)
    expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY)
  })

  it('feeTo:on', async () => {
    await factory.setFeeTo(other.address)

    const token0Amount = expandTo18Decimals(1000)
    const token1Amount = expandTo18Decimals(1000)
    await addLiquidity(token0Amount, token1Amount)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = 996006981039903216n
    await token1.transfer(await pair.getAddress(), swapAmount)
    await pair.swap(expectedOutputAmount, 0n, wallet.address, '0x')

    const expectedLiquidity = expandTo18Decimals(1000)
    await pair.transfer(await pair.getAddress(), expectedLiquidity - MINIMUM_LIQUIDITY)
    await pair.burn(wallet.address)
    expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY + 374625795658571n)
    expect(await pair.balanceOf(other.address)).to.eq(374625795658571n)
    expect(await token0.balanceOf(await pair.getAddress())).to.eq(1000n + 374252525546167n)
    expect(await token1.balanceOf(await pair.getAddress())).to.eq(1000n + 375000280969452n)
  })
})
