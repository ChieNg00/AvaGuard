// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {CleanToken, DecoyConstantToken, MintableToken} from "../src/GoldenFixtures.sol";

contract GoldenFixturesTest {
    function testCleanReads() public {
        CleanToken token = new CleanToken();
        require(token.totalSupply() == 1000 && token.balanceOf(address(0)) == 0);
    }

    function testDecoyExposesConstantOnly() public {
        DecoyConstantToken decoy = new DecoyConstantToken();
        require(decoy.example() == MintableToken.mint.selector);
        (bool ok,) = address(decoy).call(abi.encodeCall(MintableToken.mint, (address(1), 1)));
        require(!ok);
    }
}
