// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {DecoyConstantToken} from "../src/GoldenFixtures.sol";
import {DemoBaselineToken, DemoMintPauseToken, DemoTokenProxy, DemoUpgradeableToken} from "../src/DemoTokens.sol";
import {RiskRegistry} from "../src/RiskRegistry.sol";

interface VmScript {
    function envAddress(string calldata name) external view returns (address);
    function envOr(string calldata name, address defaultValue) external view returns (address);
    function startBroadcast(address signer) external;
    function stopBroadcast() external;
}

/// @notice Reproducible Foundry deployment script for AvaGuard RiskRegistry and Fuji demo tokens.
/// @dev Expects OWNER_ADDRESS and ATTESTER_ADDRESS (distinct non-zero addresses) and chain ID 43113.
contract DeployDemoScript {
    VmScript private constant vm = VmScript(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 public constant FUJI_CHAIN_ID = 43113;
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;

    error InvalidChainId(uint256 actual, uint256 expected);
    error ZeroAddress(string role);
    error OwnerAndAttesterMustDiffer(address addr);

    struct DeployedSuite {
        address owner;
        address attester;
        address initialHolder;
        address registry;
        address baselineToken;
        address mintPauseToken;
        address upgradeableImplementation;
        address upgradeableProxy;
        address decoyConstantToken;
    }

    event SuiteDeployed(
        address indexed owner,
        address indexed attester,
        address registry,
        address baselineToken,
        address mintPauseToken,
        address upgradeableImplementation,
        address upgradeableProxy,
        address decoyConstantToken
    );

    function run() external returns (DeployedSuite memory suite) {
        if (block.chainid != FUJI_CHAIN_ID) {
            revert InvalidChainId(block.chainid, FUJI_CHAIN_ID);
        }

        address owner = vm.envAddress("OWNER_ADDRESS");
        address attester = vm.envAddress("ATTESTER_ADDRESS");
        address initialHolder = vm.envOr("INITIAL_HOLDER", owner);

        if (owner == address(0)) revert ZeroAddress("OWNER_ADDRESS");
        if (attester == address(0)) revert ZeroAddress("ATTESTER_ADDRESS");
        if (initialHolder == address(0)) revert ZeroAddress("INITIAL_HOLDER");
        if (owner == attester) revert OwnerAndAttesterMustDiffer(owner);

        vm.startBroadcast(owner);

        RiskRegistry registry = new RiskRegistry(owner);
        registry.setAttester(attester, true);

        DemoBaselineToken baselineToken =
            new DemoBaselineToken("AvaGuard Demo Baseline", "AGBASE", initialHolder, INITIAL_SUPPLY);

        DemoMintPauseToken mintPauseToken =
            new DemoMintPauseToken("AvaGuard Demo MintPause", "AGMP", owner, initialHolder, INITIAL_SUPPLY);

        DemoUpgradeableToken upgradeableImplementation = new DemoUpgradeableToken();
        bytes memory initData = abi.encodeCall(
            DemoUpgradeableToken.initialize, ("AvaGuard Demo Upgradeable", "AGUP", owner, initialHolder, INITIAL_SUPPLY)
        );
        DemoTokenProxy upgradeableProxy = new DemoTokenProxy(address(upgradeableImplementation), initData);

        DecoyConstantToken decoyConstantToken = new DecoyConstantToken();

        vm.stopBroadcast();

        suite = DeployedSuite({
            owner: owner,
            attester: attester,
            initialHolder: initialHolder,
            registry: address(registry),
            baselineToken: address(baselineToken),
            mintPauseToken: address(mintPauseToken),
            upgradeableImplementation: address(upgradeableImplementation),
            upgradeableProxy: address(upgradeableProxy),
            decoyConstantToken: address(decoyConstantToken)
        });

        emit SuiteDeployed(
            owner,
            attester,
            address(registry),
            address(baselineToken),
            address(mintPauseToken),
            address(upgradeableImplementation),
            address(upgradeableProxy),
            address(decoyConstantToken)
        );
    }
}
