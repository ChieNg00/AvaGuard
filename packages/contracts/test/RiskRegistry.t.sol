// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {RiskRegistry} from "../src/RiskRegistry.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {UpgradeableToken, MintableToken, CleanToken} from "../src/GoldenFixtures.sol";

interface VmRegistry {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function expectRevert(bytes calldata) external;
    function roll(uint256) external;
    function expectEmit(bool, bool, bool, bool, address) external;
    function store(address, bytes32, bytes32) external;
    function etch(address, bytes calldata) external;
}

contract RiskRegistryTest {
    VmRegistry constant vm = VmRegistry(address(uint160(uint256(keccak256("hevm cheat code")))));
    RiskRegistry registry;
    address constant publisher = address(17);
    address constant successor = address(19);
    RiskRegistry.Publication p;
    address proxy;
    bytes32 constant implSlot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);

    function setUp() public {
        vm.roll(100);
        registry = new RiskRegistry(address(this));
        registry.setAttester(publisher, true);
        proxy = address(new UpgradeableToken());
        address impl = address(new MintableToken());
        vm.store(proxy, implSlot, bytes32(uint256(uint160(impl))));
        p = RiskRegistry.Publication(proxy, 0, proxy.codehash, impl, keccak256("report"), 1, 100, keccak256("snapshot"));
    }

    function publish() internal {
        vm.prank(publisher);
        registry.publish(p);
    }

    function testOwnerAndPublisherAreIndependent() public {
        vm.expectRevert(RiskRegistry.UnauthorizedAttester.selector);
        registry.publish(p);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, publisher));
        vm.prank(publisher);
        registry.setAttester(successor, true);
    }

    function testRevocationAppliesToNextPublication() public {
        publish();
        registry.setAttester(publisher, false);
        p.reportHash = keccak256("new");
        vm.expectRevert(RiskRegistry.UnauthorizedAttester.selector);
        publish();
        require(registry.reportCount(proxy) == 1);
    }

    function testOwnershipNeedsAcceptance() public {
        registry.transferOwnership(successor);
        require(registry.owner() == address(this) && registry.pendingOwner() == successor);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, successor));
        vm.prank(successor);
        registry.setAttester(successor, true);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, publisher));
        vm.prank(publisher);
        registry.acceptOwnership();
        vm.prank(successor);
        registry.acceptOwnership();
        require(registry.owner() == successor && registry.pendingOwner() == address(0));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(this)));
        registry.setAttester(publisher, false);
        vm.prank(successor);
        registry.setAttester(publisher, false);
        require(!registry.attesters(publisher));
    }

    function testScoreAbove100() public {
        p.score = 101;
        vm.expectRevert(RiskRegistry.InvalidScore.selector);
        publish();
    }

    function testNoCodeEvenWithMatchingHash() public {
        p.target = publisher;
        p.codehash = publisher.codehash;
        vm.expectRevert(RiskRegistry.EmptyTarget.selector);
        publish();
    }

    function testWrongLiveCodehash() public {
        p.codehash = keccak256("wrong");
        vm.expectRevert(RiskRegistry.CodehashMismatch.selector);
        publish();
    }

    function testFutureSnapshot() public {
        p.blockNumber++;
        vm.expectRevert(RiskRegistry.FutureSnapshot.selector);
        publish();
    }

    function testPublicationFieldsAndEvent() public {
        p.score = 100;
        vm.expectEmit(true, true, true, true, address(registry));
        emit RiskRegistry.ReportPublished(
            p.target,
            p.reportHash,
            publisher,
            p.score,
            p.codehash,
            p.implementation,
            p.rulesetVersion,
            p.blockNumber,
            p.blockHash,
            block.timestamp
        );
        publish();
        RiskRegistry.Commitment memory c = registry.latestReport(proxy);
        require(keccak256(abi.encode(c.report)) == keccak256(abi.encode(p)));
        require(c.attester == publisher && c.publishedAt == block.timestamp);
    }

    function testGlobalDuplicateCannotOverwrite() public {
        publish();
        p.target = address(new CleanToken());
        p.codehash = p.target.codehash;
        registry.setAttester(successor, true);
        vm.expectRevert(RiskRegistry.DuplicateReport.selector);
        vm.prank(successor);
        registry.publish(p);
        require(registry.reportCount(p.target) == 0 && registry.reportCount(proxy) == 1);
        require(registry.getReport(p.reportHash).attester == publisher);
    }

    function testHistoryAndLatestBySnapshotThenPublication() public {
        bytes32 first = p.reportHash;
        p.blockNumber = 80;
        publish();
        p.blockNumber = 95;
        bytes32 newer = keccak256("newer");
        p.reportHash = newer;
        publish();
        p.blockNumber = 60;
        bytes32 older = keccak256("older");
        p.reportHash = older;
        publish();
        require(registry.latestReport(proxy).report.reportHash == newer);
        p.blockNumber = 95;
        p.reportHash = keccak256("tie");
        publish();
        require(registry.latestReport(proxy).report.reportHash == p.reportHash);
        require(registry.reportCount(proxy) == 4);
        require(registry.reportHashAt(proxy, 0) == first && registry.reportHashAt(proxy, 1) == newer);
        require(registry.reportHashAt(proxy, 2) == older && registry.reportHashAt(proxy, 3) == p.reportHash);
        require(registry.getReport(older).report.blockNumber == 60);
    }

    function testMissingLookup() public {
        require(registry.reportCount(proxy) == 0);
        vm.expectRevert(RiskRegistry.UnknownReport.selector);
        registry.latestReport(proxy);
        vm.expectRevert(RiskRegistry.UnknownReport.selector);
        registry.isCodeStale(p.reportHash);
    }

    function testCodeStaleOnlyTracksTargetRuntime() public {
        publish();
        require(MintableToken(proxy).owner() == address(0));
        vm.store(proxy, bytes32(0), bytes32(uint256(uint160(successor))));
        require(MintableToken(proxy).owner() == successor && !registry.isCodeStale(p.reportHash));
        address next = address(new CleanToken());
        vm.store(proxy, implSlot, bytes32(uint256(uint160(next))));
        (bool hasOwner,) = proxy.staticcall(abi.encodeWithSignature("owner()"));
        require(!hasOwner && CleanToken(proxy).totalSupply() == 1000);
        require(!registry.isCodeStale(p.reportHash));
        vm.etch(proxy, next.code);
        require(registry.isCodeStale(p.reportHash));
    }
}
