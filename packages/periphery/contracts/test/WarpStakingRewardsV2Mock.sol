pragma solidity =0.5.16;

import '../rewards/WarpStakingRewards.sol';

contract WarpStakingRewardsV2Mock is WarpStakingRewards {
    function version() external pure returns (uint256) {
        return 2;
    }
}

