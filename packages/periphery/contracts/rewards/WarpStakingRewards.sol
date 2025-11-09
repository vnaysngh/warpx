pragma solidity =0.5.16;

import '../interfaces/IERC20.sol';
import '../../../core/contracts/libraries/SafeMath.sol';

contract WarpStakingRewards {
    using SafeMath for uint256;

    IERC20 public rewardsToken;
    IERC20 public stakingToken;

    address public owner;
    address public rewardsDistributor;

    uint256 public periodFinish;
    uint256 public rewardRate;
    uint256 public rewardsDuration;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    bool private initialized;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    event OwnerUpdated(address indexed newOwner);
    event RewardsDistributorUpdated(address indexed newDistributor);
    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);

    modifier onlyOwner() {
        require(msg.sender == owner, 'WarpStakingRewards: ONLY_OWNER');
        _;
    }

    modifier onlyRewardsDistributor() {
        require(msg.sender == rewardsDistributor, 'WarpStakingRewards: ONLY_DISTRIBUTOR');
        _;
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function initialize(
        address _owner,
        address _rewardsToken,
        address _stakingToken,
        uint256 _rewardsDuration,
        address _rewardsDistributor
    ) external {
        require(!initialized, 'WarpStakingRewards: ALREADY_INITIALIZED');
        require(_owner != address(0), 'WarpStakingRewards: OWNER_ZERO');
        require(_rewardsToken != address(0), 'WarpStakingRewards: REWARD_TOKEN_ZERO');
        require(_stakingToken != address(0), 'WarpStakingRewards: STAKING_TOKEN_ZERO');
        require(_rewardsDuration > 0, 'WarpStakingRewards: DURATION_ZERO');

        owner = _owner;
        rewardsToken = IERC20(_rewardsToken);
        stakingToken = IERC20(_stakingToken);
        rewardsDuration = _rewardsDuration;
        rewardsDistributor = _rewardsDistributor == address(0) ? _owner : _rewardsDistributor;
        initialized = true;
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable().sub(lastUpdateTime).mul(rewardRate).mul(1e18) / _totalSupply
            );
    }

    function earned(address account) public view returns (uint256) {
        uint256 accrued = _balances[account]
            .mul(rewardPerToken().sub(userRewardPerTokenPaid[account]))
            / 1e18;
        return accrued.add(rewards[account]);
    }

    function getRewardForDuration() external view returns (uint256) {
        return rewardRate.mul(rewardsDuration);
    }

    function stake(uint256 amount) external updateReward(msg.sender) {
        require(amount > 0, 'WarpStakingRewards: STAKE_ZERO');
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        require(stakingToken.transferFrom(msg.sender, address(this), amount), 'WarpStakingRewards: STAKE_TRANSFER_FAILED');
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public updateReward(msg.sender) {
        require(amount > 0, 'WarpStakingRewards: WITHDRAW_ZERO');
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        require(stakingToken.transfer(msg.sender, amount), 'WarpStakingRewards: WITHDRAW_TRANSFER_FAILED');
        emit Withdrawn(msg.sender, amount);
    }

    function getReward() public updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            require(rewardsToken.transfer(msg.sender, reward), 'WarpStakingRewards: REWARD_TRANSFER_FAILED');
            emit RewardPaid(msg.sender, reward);
        }
    }

    function exit() external {
        withdraw(_balances[msg.sender]);
        getReward();
    }

    function notifyRewardAmount(uint256 reward) external onlyRewardsDistributor updateReward(address(0)) {
        require(reward > 0, 'WarpStakingRewards: REWARD_ZERO');
        if (block.timestamp >= periodFinish) {
            rewardRate = reward / rewardsDuration;
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            rewardRate = reward.add(leftover) / rewardsDuration;
        }

        uint256 balance = rewardsToken.balanceOf(address(this));
        require(rewardRate.mul(rewardsDuration) <= balance, 'WarpStakingRewards: INSUFFICIENT_BALANCE');

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(rewardsDuration);
        emit RewardAdded(reward);
    }

    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        require(tokenAddress != address(stakingToken), 'WarpStakingRewards: STAKING_TOKEN');
        require(tokenAddress != address(rewardsToken), 'WarpStakingRewards: REWARDS_TOKEN');
        require(IERC20(tokenAddress).transfer(owner, tokenAmount), 'WarpStakingRewards: RECOVER_FAILED');
    }

    function setOwner(address _owner) external onlyOwner {
        require(_owner != address(0), 'WarpStakingRewards: OWNER_ZERO');
        owner = _owner;
        emit OwnerUpdated(_owner);
    }

    function setRewardsDistributor(address _rewardsDistributor) external onlyOwner {
        require(_rewardsDistributor != address(0), 'WarpStakingRewards: DISTRIBUTOR_ZERO');
        rewardsDistributor = _rewardsDistributor;
        emit RewardsDistributorUpdated(_rewardsDistributor);
    }

    function setRewardsDuration(uint256 _rewardsDuration) external onlyOwner {
        require(block.timestamp > periodFinish, 'WarpStakingRewards: PERIOD_ACTIVE');
        require(_rewardsDuration > 0, 'WarpStakingRewards: DURATION_ZERO');
        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(_rewardsDuration);
    }
}
