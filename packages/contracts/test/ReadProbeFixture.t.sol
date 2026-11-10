// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ReadProbeFixture} from "../src/ReadProbeFixture.sol";

contract ReadProbeFixtureTest {
    function testFuzz_ReadProbesPreserveSupply(uint256 supply) public {
        ReadProbeFixture token = new ReadProbeFixture(address(this), supply);
        require(token.totalSupply() == supply, "supply");
        require(token.balanceOf(address(this)) == supply, "holder balance");
        require(token.balanceOf(address(0)) == 0, "zero balance");
    }

    function test_RejectZeroHolder() public {
        try new ReadProbeFixture(address(0), 1) {
            revert("accepted zero holder");
        } catch Error(string memory reason) {
            require(keccak256(bytes(reason)) == keccak256("zero holder"), "wrong reason");
        }
    }
}
