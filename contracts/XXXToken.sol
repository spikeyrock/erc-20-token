// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
/**
 * @title XXXToken
 * @author https://github.com/spikeyrock
 * @dev Implementation of an upgradeable ERC20 token with additional features:
 * - Pausable functionality for emergency stops
 * - Burnable capabilities to reduce supply
 * - Capped supply with maximum limit
 * - Role-based access control for admin functions
 * - UUPS upgradeable pattern
 */

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract XXXToken is Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    ERC20PausableUpgradeable,
    ERC20CappedUpgradeable,
    OwnableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable {

    // Custom errors
    error MaxSupplyExceeded(uint256 requested, uint256 available);

    // Role identifiers
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // Max supply of 1 billion tokens
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18;

    /**
     * @dev Prevents the implementation contract from being initialized
     * This is a security measure to avoid potential attacks
     */
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract replacing the constructor for upgradeable contracts
     * Sets up roles and configures token parameters
     */
    function initialize() external initializer {
        // Initialize ERC20 with name and symbol
        __ERC20_init("XXX", "XXX");
        
        // Initialize extensions
        __ERC20Burnable_init();
        __ERC20Pausable_init();
        
        // Set max supply cap to 1 billion tokens
        __ERC20Capped_init(MAX_SUPPLY);
        
        // Set up ownership and access control
        __Ownable_init(msg.sender);
        __AccessControl_init();
        __UUPSUpgradeable_init();

        // Grant admin roles to deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        
        // Note: We no longer mint the entire supply at initialization
        // Instead, tokens will be minted on-demand through the TokenVault
    }

    /**
     * @dev Pauses all token transfers
     * Can only be called by accounts with PAUSER_ROLE
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses all token transfers
     * Can only be called by accounts with PAUSER_ROLE
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Mints new tokens, respecting the cap
     * Can only be called by accounts with MINTER_ROLE
     * 
     * @param to The address that will receive the minted tokens
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (totalSupply() + amount > MAX_SUPPLY) {
            revert MaxSupplyExceeded(amount, MAX_SUPPLY - totalSupply());
        }
        _mint(to, amount);
    }

    /**
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract
     * Called by {upgradeTo} and {upgradeToAndCall}
     * 
     * @param newImplementation Address of the new implementation contract
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    /**
     * @dev Hook that is called before any transfer of tokens
     * Overrides the parent implementations to ensure all extensions work together
     */
    function _update(address from, address to, uint256 amount)
        internal
        override(ERC20Upgradeable, ERC20PausableUpgradeable, ERC20CappedUpgradeable)
    {
        super._update(from, to, amount);
    }
}