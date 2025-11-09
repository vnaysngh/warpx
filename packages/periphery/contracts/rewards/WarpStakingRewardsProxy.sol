pragma solidity =0.5.16;

contract WarpStakingRewardsProxy {
    bytes32 private constant IMPLEMENTATION_SLOT = keccak256('warpx.staking.proxy.implementation');
    bytes32 private constant ADMIN_SLOT = keccak256('warpx.staking.proxy.admin');

    event Upgraded(address indexed implementation);
    event AdminChanged(address previousAdmin, address newAdmin);

    constructor(address _logic, bytes memory _data) public {
        require(_logic != address(0), 'WarpStakingRewardsProxy: LOGIC_ZERO');
        _setAdmin(msg.sender);
        _setImplementation(_logic);

        if (_data.length > 0) {
            (bool success, ) = _logic.delegatecall(_data);
            require(success, 'WarpStakingRewardsProxy: INIT_FAILED');
        }
    }

    function () external payable {
        _fallback();
    }

    function implementation() external view onlyAdmin returns (address impl) {
        impl = _implementation();
    }

    function admin() external view onlyAdmin returns (address adm) {
        adm = _admin();
    }

    function changeAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), 'WarpStakingRewardsProxy: ADMIN_ZERO');
        emit AdminChanged(_admin(), newAdmin);
        _setAdmin(newAdmin);
    }

    function upgradeTo(address newImplementation) external onlyAdmin {
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);
    }

    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable onlyAdmin {
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);
        (bool success, ) = newImplementation.delegatecall(data);
        require(success, 'WarpStakingRewardsProxy: CALL_FAILED');
    }

    modifier onlyAdmin() {
        require(msg.sender == _admin(), 'WarpStakingRewardsProxy: ONLY_ADMIN');
        _;
    }

    function _implementation() internal view returns (address impl) {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            impl := sload(slot)
        }
    }

    function _admin() internal view returns (address adm) {
        bytes32 slot = ADMIN_SLOT;
        assembly {
            adm := sload(slot)
        }
    }

    function _setImplementation(address newImplementation) private {
        require(newImplementation != address(0), 'WarpStakingRewardsProxy: IMPLEMENTATION_ZERO');
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            sstore(slot, newImplementation)
        }
    }

    function _setAdmin(address newAdmin) private {
        bytes32 slot = ADMIN_SLOT;
        assembly {
            sstore(slot, newAdmin)
        }
    }

    function _fallback() internal {
        require(msg.sender != _admin(), 'WarpStakingRewardsProxy: ADMIN_CANNOT_FALLBACK');
        _delegate(_implementation());
    }

    function _delegate(address impl) internal {
        assembly {
            calldatacopy(0, 0, calldatasize)
            let result := delegatecall(gas, impl, 0, calldatasize, 0, 0)
            returndatacopy(0, 0, returndatasize)
            switch result
            case 0 {
                revert(0, returndatasize)
            }
            default {
                return(0, returndatasize)
            }
        }
    }
}
