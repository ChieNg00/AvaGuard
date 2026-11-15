// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {DemoBaselineToken, DemoMintPauseToken, DemoTokenProxy, DemoUpgradeableToken} from "../src/DemoTokens.sol";

interface VmDemo {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function expectRevert(bytes calldata) external;
}

contract DemoUpgradeableTokenV2 is DemoUpgradeableToken {
    function version() external pure returns (uint256) {
        return 2;
    }
}

contract DemoTokensTest {
    VmDemo constant vm = VmDemo(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant owner = address(0x101);
    address constant holder = address(0x102);
    address constant spender = address(0x103);
    address constant recipient = address(0x104);
    address constant attacker = address(0x105);

    uint256 constant INITIAL_SUPPLY = 1_000_000 ether;

    function testErc7201SlotConstantMatchesFormula() public pure {
        bytes32 expected = keccak256(abi.encode(uint256(keccak256("avaguard.storage.DemoUpgradeableToken")) - 1))
            & ~bytes32(uint256(0xff));
        assert(expected == 0x4496e5ce33b8ec396139effb46b35a9b5adcd4c1de76653e832c9cd515b29600);
    }

    function testBaselineTokenTransfersAndAllowances() public {
        DemoBaselineToken token = new DemoBaselineToken("AvaGuard Demo Baseline", "AGBASE", holder, INITIAL_SUPPLY);
        assert(keccak256(bytes(token.name())) == keccak256("AvaGuard Demo Baseline"));
        assert(keccak256(bytes(token.symbol())) == keccak256("AGBASE"));
        assert(token.decimals() == 18);
        assert(token.totalSupply() == INITIAL_SUPPLY);
        assert(token.balanceOf(holder) == INITIAL_SUPPLY);

        vm.prank(holder);
        assert(token.transfer(recipient, 250 ether));
        assert(token.balanceOf(recipient) == 250 ether);

        vm.prank(holder);
        assert(token.approve(spender, 100 ether));
        vm.prank(spender);
        assert(token.transferFrom(holder, recipient, 40 ether));
        assert(token.balanceOf(recipient) == 290 ether);
        assert(token.allowance(holder, spender) == 60 ether);

        // No owner() method exists on the baseline ERC-20.
        (bool hasOwner,) = address(token).staticcall(abi.encodeWithSignature("owner()"));
        assert(!hasOwner);
    }

    function testMintPauseTokenCapabilitiesAndAccessControl() public {
        DemoMintPauseToken token =
            new DemoMintPauseToken("AvaGuard Demo MintPause", "AGMP", owner, holder, INITIAL_SUPPLY);
        assert(token.owner() == owner);
        assert(token.totalSupply() == INITIAL_SUPPLY);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        token.mint(attacker, 10 ether);

        vm.prank(owner);
        token.mint(recipient, 500 ether);
        assert(token.balanceOf(recipient) == 500 ether);
        assert(token.totalSupply() == INITIAL_SUPPLY + 500 ether);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        token.pause();

        vm.prank(owner);
        token.pause();
        assert(token.paused());

        vm.prank(holder);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        token.transfer(recipient, 1 ether);

        vm.prank(owner);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        token.mint(recipient, 1 ether);

        vm.prank(owner);
        token.unpause();
        assert(!token.paused());

        vm.prank(holder);
        assert(token.transfer(recipient, 25 ether));
        assert(token.balanceOf(recipient) == 525 ether);
    }

    function testUpgradeableProxyInitializationTokenOpsAndUpgradeAuth() public {
        DemoUpgradeableToken implementation = new DemoUpgradeableToken();

        // Direct initialization on the implementation contract is disabled.
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        implementation.initialize("Direct Impl", "IMPL", attacker, attacker, 1 ether);

        // Direct UUPS upgrade call against the implementation contract fails.
        DemoUpgradeableTokenV2 implV2 = new DemoUpgradeableTokenV2();
        vm.expectRevert(UUPSUpgradeable.UUPSUnauthorizedCallContext.selector);
        implementation.upgradeToAndCall(address(implV2), "");

        bytes memory initData = abi.encodeCall(
            DemoUpgradeableToken.initialize, ("AvaGuard Demo Upgradeable", "AGUP", owner, holder, INITIAL_SUPPLY)
        );
        DemoTokenProxy proxy = new DemoTokenProxy(address(implementation), initData);
        DemoUpgradeableToken token = DemoUpgradeableToken(address(proxy));

        assert(token.owner() == owner);
        assert(keccak256(bytes(token.name())) == keccak256("AvaGuard Demo Upgradeable"));
        assert(keccak256(bytes(token.symbol())) == keccak256("AGUP"));
        assert(token.decimals() == 18);
        assert(token.totalSupply() == INITIAL_SUPPLY);
        assert(token.balanceOf(holder) == INITIAL_SUPPLY);

        // Re-initialization on the proxy is rejected.
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        token.initialize("Reinit", "RE", attacker, attacker, 1 ether);

        // Standard transfer + allowance flows through proxy delegatecall.
        vm.prank(holder);
        assert(token.transfer(recipient, 300 ether));
        vm.prank(holder);
        assert(token.approve(spender, 150 ether));
        vm.prank(spender);
        assert(token.transferFrom(holder, recipient, 50 ether));
        assert(token.balanceOf(recipient) == 350 ether);
        assert(token.allowance(holder, spender) == 100 ether);

        // Insufficient balance uses ERC-6093 error.
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, attacker, 0, 1 ether));
        token.transfer(recipient, 1 ether);

        // Non-owner cannot mint, transfer ownership, or upgrade.
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(DemoUpgradeableToken.UnauthorizedAccount.selector, attacker));
        token.mint(attacker, 10 ether);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(DemoUpgradeableToken.UnauthorizedAccount.selector, attacker));
        token.transferOwnership(attacker);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(DemoUpgradeableToken.UnauthorizedAccount.selector, attacker));
        token.upgradeToAndCall(address(implV2), "");

        // Owner mint and authorized upgrade preserve storage.
        vm.prank(owner);
        token.mint(recipient, 200 ether);
        assert(token.balanceOf(recipient) == 550 ether);

        vm.prank(owner);
        token.upgradeToAndCall(address(implV2), "");
        DemoUpgradeableTokenV2 upgraded = DemoUpgradeableTokenV2(address(proxy));
        assert(upgraded.version() == 2);
        assert(upgraded.owner() == owner);
        assert(upgraded.balanceOf(recipient) == 550 ether);
        assert(upgraded.totalSupply() == INITIAL_SUPPLY + 200 ether);
    }
}
