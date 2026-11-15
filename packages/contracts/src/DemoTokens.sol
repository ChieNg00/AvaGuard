// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @notice Ordinary ERC-20 baseline demo contract with fixed initial supply and no admin controls.
contract DemoBaselineToken is ERC20 {
    constructor(string memory name_, string memory symbol_, address initialHolder, uint256 initialSupply)
        ERC20(name_, symbol_)
    {
        if (initialSupply > 0) {
            _mint(initialHolder, initialSupply);
        }
    }
}

/// @notice Owned ERC-20 demo contract with real owner-controlled minting and pausing.
contract DemoMintPauseToken is ERC20, ERC20Pausable, Ownable {
    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner,
        address initialHolder,
        uint256 initialSupply
    ) ERC20(name_, symbol_) Ownable(initialOwner) {
        if (initialSupply > 0) {
            _mint(initialHolder, initialSupply);
        }
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, value);
    }
}

/// @notice UUPS ERC-1967 upgradeable ERC-20 demo implementation with explicit initializer and owner-gated upgrades.
contract DemoUpgradeableToken is Initializable, UUPSUpgradeable, IERC20, IERC20Metadata, IERC20Errors {
    struct TokenStorage {
        mapping(address account => uint256) balances;
        mapping(address account => mapping(address spender => uint256)) allowances;
        uint256 totalSupply;
        string name;
        string symbol;
        address owner;
    }

    // keccak256(abi.encode(uint256(keccak256("avaguard.storage.DemoUpgradeableToken")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant TOKEN_STORAGE_SLOT = 0x4496e5ce33b8ec396139effb46b35a9b5adcd4c1de76653e832c9cd515b29600;

    error UnauthorizedAccount(address account);
    error InvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name_,
        string memory symbol_,
        address initialOwner,
        address initialHolder,
        uint256 initialSupply
    ) external initializer {
        if (initialOwner == address(0)) revert InvalidOwner(address(0));
        TokenStorage storage $ = _getTokenStorage();
        $.name = name_;
        $.symbol = symbol_;
        $.owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
        if (initialSupply > 0) {
            _mint(initialHolder, initialSupply);
        }
    }

    function owner() public view returns (address) {
        return _getTokenStorage().owner;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidOwner(address(0));
        TokenStorage storage $ = _getTokenStorage();
        address previousOwner = $.owner;
        $.owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function name() external view returns (string memory) {
        return _getTokenStorage().name;
    }

    function symbol() external view returns (string memory) {
        return _getTokenStorage().symbol;
    }

    function decimals() external pure returns (uint8) {
        return 18;
    }

    function totalSupply() external view returns (uint256) {
        return _getTokenStorage().totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _getTokenStorage().balances[account];
    }

    function allowance(address account, address spender) public view returns (uint256) {
        return _getTokenStorage().allowances[account][spender];
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        _spendAllowance(from, msg.sender, value);
        _transfer(from, to, value);
        return true;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function _checkOwner() internal view {
        if (msg.sender != owner()) revert UnauthorizedAccount(msg.sender);
    }

    function _mint(address account, uint256 value) internal {
        if (account == address(0)) revert ERC20InvalidReceiver(address(0));
        TokenStorage storage $ = _getTokenStorage();
        $.totalSupply += value;
        unchecked {
            $.balances[account] += value;
        }
        emit Transfer(address(0), account, value);
    }

    function _transfer(address from, address to, uint256 value) internal {
        if (from == address(0)) revert ERC20InvalidSender(address(0));
        if (to == address(0)) revert ERC20InvalidReceiver(address(0));
        TokenStorage storage $ = _getTokenStorage();
        uint256 fromBalance = $.balances[from];
        if (fromBalance < value) {
            revert ERC20InsufficientBalance(from, fromBalance, value);
        }
        unchecked {
            $.balances[from] = fromBalance - value;
            $.balances[to] += value;
        }
        emit Transfer(from, to, value);
    }

    function _approve(address account, address spender, uint256 value) internal {
        if (account == address(0)) revert ERC20InvalidApprover(address(0));
        if (spender == address(0)) revert ERC20InvalidSpender(address(0));
        _getTokenStorage().allowances[account][spender] = value;
        emit Approval(account, spender, value);
    }

    function _spendAllowance(address account, address spender, uint256 value) internal {
        uint256 currentAllowance = allowance(account, spender);
        if (currentAllowance < type(uint256).max) {
            if (currentAllowance < value) {
                revert ERC20InsufficientAllowance(spender, currentAllowance, value);
            }
            unchecked {
                _approve(account, spender, currentAllowance - value);
            }
        }
    }

    function _getTokenStorage() private pure returns (TokenStorage storage $) {
        assembly {
            $.slot := TOKEN_STORAGE_SLOT
        }
    }
}

/// @notice Standard ERC-1967 proxy wrapper for reproducible deployment and source verification.
contract DemoTokenProxy is ERC1967Proxy {
    constructor(address implementation, bytes memory data) ERC1967Proxy(implementation, data) {}
}
