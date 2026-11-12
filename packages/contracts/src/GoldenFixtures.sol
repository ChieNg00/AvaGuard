// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

// Read-only scoring fixtures. Selector matches do not establish write behavior.
contract NoMetadataToken {
    uint256 public constant totalSupply = 1000;

    function balanceOf(address) external pure returns (uint256) {
        return 0;
    }
}

contract CleanToken is NoMetadataToken {
    string public constant name = "Fixture";
    string public constant symbol = "FIX";
    uint8 public constant decimals = 18;
}

contract MintableToken is CleanToken {
    address public owner;

    function mint(address, uint256) external pure {}
}

contract BlacklistFeeToken is CleanToken {
    address public owner;

    function blacklist(address) external pure {}
    function setFee(uint256) external pure {}
}

contract DecoyConstantToken is CleanToken {
    function example() external pure returns (bytes4) {
        return bytes4(keccak256("mint(address,uint256)"));
    }
}

contract NotErc20Contract {}

contract RenouncedMintToken is MintableToken {}

contract ContractOwnerToken is MintableToken {}

abstract contract FixtureProxy {
    function destination() internal view virtual returns (address);

    fallback() external {
        address implementation = destination();
        assembly {
            calldatacopy(0, 0, calldatasize())
            let success := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            if iszero(success) { revert(0, returndatasize()) }
            return(0, returndatasize())
        }
    }
}

contract UpgradeableToken is FixtureProxy {
    function destination() internal view override returns (address implementation) {
        bytes32 slot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
        assembly { implementation := sload(slot) }
    }
}

contract FixtureBeacon {
    address public implementation;
}

contract BeaconProxyToken is FixtureProxy {
    function destination() internal view override returns (address) {
        bytes32 slot = bytes32(uint256(keccak256("eip1967.proxy.beacon")) - 1);
        address beacon;
        assembly { beacon := sload(slot) }
        return FixtureBeacon(beacon).implementation();
    }
}
