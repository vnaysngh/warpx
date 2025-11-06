import { expect } from 'chai'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { AbiCoder, MaxUint256, Signature, keccak256, toUtf8Bytes } from 'ethers'
import { ethers } from 'hardhat'

import { expandTo18Decimals } from './shared/utilities'

const TOTAL_SUPPLY = expandTo18Decimals(10000)
const TEST_AMOUNT = expandTo18Decimals(10)

describe('WarpERC20', () => {
  async function deployTokenFixture() {
    const [wallet, other] = await ethers.getSigners()
    const tokenFactory = await ethers.getContractFactory('packages/core/contracts/test/ERC20.sol:ERC20', wallet)
    const token = (await tokenFactory.deploy(TOTAL_SUPPLY)) as any
    await token.waitForDeployment()
    return { token, wallet, other }
  }

  it('name, symbol, decimals, totalSupply, balanceOf, DOMAIN_SEPARATOR, PERMIT_TYPEHASH', async () => {
    const { token, wallet } = await loadFixture(deployTokenFixture)
    const name = await token.name()
    expect(name).to.eq('Warp LPs')
    expect(await token.symbol()).to.eq('WARP-LP')
    expect(await token.decimals()).to.eq(18)
    expect(await token.totalSupply()).to.eq(TOTAL_SUPPLY)
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY)

    const domainSeparatorDigest = await token.DOMAIN_SEPARATOR()
    const { chainId } = await wallet.provider.getNetwork()
    const computedSeparator = keccak256(
      AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
        [
          keccak256(toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
          keccak256(toUtf8Bytes(name)),
          keccak256(toUtf8Bytes('1')),
          chainId,
          await token.getAddress()
        ]
      )
    )
    expect(await token.PERMIT_TYPEHASH()).to.eq(
      keccak256(toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)'))
    )
    expect(domainSeparatorDigest).to.eq(computedSeparator)
  })

  it('approve', async () => {
    const { token, wallet, other } = await loadFixture(deployTokenFixture)
    await expect(token.approve(other.address, TEST_AMOUNT))
      .to.emit(token, 'Approval')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)
    expect(await token.allowance(wallet.address, other.address)).to.eq(TEST_AMOUNT)
  })

  it('transfer', async () => {
    const { token, wallet, other } = await loadFixture(deployTokenFixture)
    await expect(token.transfer(other.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY - TEST_AMOUNT)
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  })

  it('transfer:fail', async () => {
    const { token, wallet, other } = await loadFixture(deployTokenFixture)
    await expect(token.transfer(other.address, TOTAL_SUPPLY + 1n)).to.be.reverted
    await expect(token.connect(other).transfer(wallet.address, 1n)).to.be.reverted
  })

  it('transferFrom', async () => {
    const { token, wallet, other } = await loadFixture(deployTokenFixture)
    await token.approve(other.address, TEST_AMOUNT)
    await expect(token.connect(other).transferFrom(wallet.address, other.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)
    expect(await token.allowance(wallet.address, other.address)).to.eq(0n)
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY - TEST_AMOUNT)
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  })

  it('transferFrom:max', async () => {
    const { token, wallet, other } = await loadFixture(deployTokenFixture)
    await token.approve(other.address, MaxUint256)
    await expect(token.connect(other).transferFrom(wallet.address, other.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)
    expect(await token.allowance(wallet.address, other.address)).to.eq(MaxUint256)
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY - TEST_AMOUNT)
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  })

  it('permit', async () => {
    const { token, wallet, other } = await loadFixture(deployTokenFixture)
    const nonce = await token.nonces(wallet.address)
    const deadline = MaxUint256
    const name = await token.name()
    const verifyingContract = await token.getAddress()
    const { chainId } = await wallet.provider.getNetwork()
    const signature = await wallet.signTypedData(
      {
        name,
        version: '1',
        chainId,
        verifyingContract
      },
      {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      },
      {
        owner: wallet.address,
        spender: other.address,
        value: TEST_AMOUNT,
        nonce,
        deadline
      }
    )
    const { v, r, s } = Signature.from(signature)

    await expect(token.permit(wallet.address, other.address, TEST_AMOUNT, deadline, v, r, s))
      .to.emit(token, 'Approval')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)
    expect(await token.allowance(wallet.address, other.address)).to.eq(TEST_AMOUNT)
    expect(await token.nonces(wallet.address)).to.eq(nonce + 1n)
  })
})
