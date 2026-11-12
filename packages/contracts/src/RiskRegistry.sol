// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

contract RiskRegistry is Ownable2Step {
    struct Publication {
        address target;
        uint8 score;
        bytes32 codehash;
        address implementation;
        bytes32 reportHash;
        uint32 rulesetVersion;
        uint64 blockNumber;
        bytes32 blockHash;
    }

    struct Commitment {
        Publication report;
        address attester;
        uint256 publishedAt;
    }

    error UnauthorizedAttester();
    error InvalidScore();
    error EmptyTarget();
    error CodehashMismatch();
    error FutureSnapshot();
    error DuplicateReport();
    error UnknownReport();

    event AttesterUpdated(address indexed attester, bool allowed);
    event ReportPublished(
        address indexed target,
        bytes32 indexed reportHash,
        address indexed attester,
        uint8 score,
        bytes32 codehash,
        address implementation,
        uint32 rulesetVersion,
        uint64 blockNumber,
        bytes32 blockHash,
        uint256 publishedAt
    );

    mapping(address => bool) public attesters;
    mapping(bytes32 => Commitment) private commitments;
    mapping(address => bytes32[]) private history;
    mapping(address => bytes32) private latest;

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setAttester(address attester, bool allowed) external onlyOwner {
        attesters[attester] = allowed;
        emit AttesterUpdated(attester, allowed);
    }

    function publish(Publication calldata p) external {
        if (!attesters[msg.sender]) revert UnauthorizedAttester();
        if (p.score > 100) revert InvalidScore();
        if (p.target.code.length == 0) revert EmptyTarget();
        if (p.target.codehash != p.codehash) revert CodehashMismatch();
        if (p.blockNumber > block.number) revert FutureSnapshot();
        if (commitments[p.reportHash].attester != address(0)) revert DuplicateReport();

        if (history[p.target].length == 0 || p.blockNumber >= commitments[latest[p.target]].report.blockNumber) {
            latest[p.target] = p.reportHash;
        }
        commitments[p.reportHash] = Commitment(p, msg.sender, block.timestamp);
        history[p.target].push(p.reportHash);
        emit ReportPublished(
            p.target,
            p.reportHash,
            msg.sender,
            p.score,
            p.codehash,
            p.implementation,
            p.rulesetVersion,
            p.blockNumber,
            p.blockHash,
            block.timestamp
        );
    }

    function reportCount(address target) external view returns (uint256) {
        return history[target].length;
    }

    function reportHashAt(address target, uint256 index) external view returns (bytes32) {
        return history[target][index];
    }

    function getReport(bytes32 reportHash) public view returns (Commitment memory) {
        if (commitments[reportHash].attester == address(0)) revert UnknownReport();
        return commitments[reportHash];
    }

    function latestReport(address target) external view returns (Commitment memory) {
        if (history[target].length == 0) revert UnknownReport();
        return commitments[latest[target]];
    }

    function isCodeStale(bytes32 reportHash) external view returns (bool) {
        Publication memory p = getReport(reportHash).report;
        return p.target.codehash != p.codehash;
    }
}
