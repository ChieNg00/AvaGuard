// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Local read-probe smoke fixture only; not a complete ERC-20 or registry.
contract ReadProbeFixture {
    uint256 public immutable totalSupply;
    mapping(address => uint256) public balanceOf;

    constructor(address holder, uint256 supply) {
        require(holder != address(0), "zero holder");
        totalSupply = supply;
        balanceOf[holder] = supply;
    }
}
