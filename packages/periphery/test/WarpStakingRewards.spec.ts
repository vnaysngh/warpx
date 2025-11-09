import { expect } from 'chai'
import { ethers } from 'hardhat'
import { time } from '@nomicfoundation/hardhat-network-helpers'

const REWARDS_DURATION = 7n * 24n * 60n * 60n
const STAKE_AMOUNT = ethers.parseEther('100')
const REWARD_AMOUNT = ethers.parseEther('700')
const TEST_ERC20 = 'packages/periphery/contracts/test/ERC20.sol:ERC20'

describe('WarpStakingRewards', () => {
  async function deployFixture() {
    const [proxyAdmin, owner, distributor, alice, bob] = await ethers.getSigners()

    const Token = await ethers.getContractFactory(TEST_ERC20)
    const stakingToken = await Token.deploy(ethers.parseEther('1000000'))
    await stakingToken.waitForDeployment()

    const rewardsToken = await Token.deploy(ethers.parseEther('1000000'))
    await rewardsToken.waitForDeployment()

    const Staking = await ethers.getContractFactory('WarpStakingRewards')
    const logic = await Staking.deploy()
    await logic.waitForDeployment()

    const initData = Staking.interface.encodeFunctionData('initialize', [
      owner.address,
      await rewardsToken.getAddress(),
      await stakingToken.getAddress(),
      REWARDS_DURATION,
      distributor.address
    ])

    const Proxy = await ethers.getContractFactory('WarpStakingRewardsProxy')
    const proxy = await Proxy.connect(proxyAdmin).deploy(await logic.getAddress(), initData)
    await proxy.waitForDeployment()

    const staking = Staking.attach(await proxy.getAddress())

    await stakingToken.transfer(alice.address, STAKE_AMOUNT)
    await stakingToken.transfer(bob.address, STAKE_AMOUNT)

    return {
      proxyAdmin,
      owner,
      distributor,
      alice,
      bob,
      stakingToken,
      rewardsToken,
      staking,
      proxy
    }
  }

  it('initializes through proxy', async () => {
    const { staking, owner, distributor, stakingToken, rewardsToken, alice } = await deployFixture()
    const stakingReader = staking.connect(alice)
    expect(await stakingReader.owner()).to.equal(owner.address)
    expect(await stakingReader.rewardsDistributor()).to.equal(distributor.address)
    expect(await stakingReader.stakingToken()).to.equal(await stakingToken.getAddress())
    expect(await stakingReader.rewardsToken()).to.equal(await rewardsToken.getAddress())
    expect(await stakingReader.rewardsDuration()).to.equal(REWARDS_DURATION)
  })

  it('stakes WarpX LPs and accrues rewards linearly', async () => {
    const { staking, stakingToken, rewardsToken, distributor, alice } = await deployFixture()
    const stakingFromAlice = staking.connect(alice)
    await stakingToken.connect(alice).approve(await staking.getAddress(), STAKE_AMOUNT)
    await stakingFromAlice.stake(STAKE_AMOUNT)

    await rewardsToken.transfer(await staking.getAddress(), REWARD_AMOUNT)
    await staking.connect(distributor).notifyRewardAmount(REWARD_AMOUNT)

    const elapsed = 24n * 60n * 60n
    await time.increase(Number(elapsed))

    const earned = await stakingFromAlice.earned(alice.address)
    const expected = (REWARD_AMOUNT * elapsed) / REWARDS_DURATION
    const tolerance = ethers.parseUnits('0.002', 18)
    expect(earned).to.be.gte(expected - tolerance)
    expect(earned).to.be.lte(expected)

    const rewardTx = await stakingFromAlice.getReward()
    await expect(rewardTx).to.emit(staking, 'RewardPaid')
    const rewardBalance = await rewardsToken.balanceOf(alice.address)
    expect(rewardBalance).to.be.gte(expected - tolerance)
    expect(rewardBalance).to.be.lte(expected + tolerance)
  })

  it('withdraws staked tokens and resets balance', async () => {
    const { staking, stakingToken, rewardsToken, distributor, alice } = await deployFixture()
    const stakingFromAlice = staking.connect(alice)
    await stakingToken.connect(alice).approve(await staking.getAddress(), STAKE_AMOUNT)
    await stakingFromAlice.stake(STAKE_AMOUNT)

    await rewardsToken.transfer(await staking.getAddress(), REWARD_AMOUNT)
    await staking.connect(distributor).notifyRewardAmount(REWARD_AMOUNT)
    await time.increase(7 * 24 * 60 * 60)

    await expect(stakingFromAlice.withdraw(STAKE_AMOUNT))
      .to.emit(staking, 'Withdrawn')
      .withArgs(alice.address, STAKE_AMOUNT)

    expect(await stakingFromAlice.balanceOf(alice.address)).to.equal(0n)
    expect(await stakingFromAlice.totalSupply()).to.equal(0n)
  })

  it('enforces distributor role on reward notifications', async () => {
    const { staking, rewardsToken, distributor, owner } = await deployFixture()
    const stakingAddress = await staking.getAddress()
    await rewardsToken.transfer(stakingAddress, REWARD_AMOUNT)

    await expect(staking.connect(owner).notifyRewardAmount(REWARD_AMOUNT)).to.be.revertedWith(
      'WarpStakingRewards: ONLY_DISTRIBUTOR'
    )
    await expect(staking.connect(distributor).notifyRewardAmount(REWARD_AMOUNT)).to.emit(staking, 'RewardAdded')
  })

  it('upgrades implementation while keeping balances', async () => {
    const { staking, proxy, stakingToken, rewardsToken, distributor, alice } = await deployFixture()
    const stakingFromAlice = staking.connect(alice)
    await stakingToken.connect(alice).approve(await staking.getAddress(), STAKE_AMOUNT)
    await stakingFromAlice.stake(STAKE_AMOUNT)

    await rewardsToken.transfer(await staking.getAddress(), REWARD_AMOUNT)
    await staking.connect(distributor).notifyRewardAmount(REWARD_AMOUNT)

    const StakingV2 = await ethers.getContractFactory('WarpStakingRewardsV2Mock')
    const v2 = await StakingV2.deploy()
    await v2.waitForDeployment()

    await proxy.upgradeTo(await v2.getAddress())

    const upgraded = StakingV2.attach(await proxy.getAddress())
    expect(await upgraded.connect(alice).version()).to.equal(2n)
    expect(await upgraded.connect(alice).balanceOf(alice.address)).to.equal(STAKE_AMOUNT)
  })
})
