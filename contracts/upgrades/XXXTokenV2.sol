// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../XXXToken.sol";

/**
 * @title XXXTokenV2
 * @dev This is a demonstration contract for testing the upgradeability of XXXToken.
 * It serves as a simple example of how to implement contract upgrades using the UUPS pattern.
 * 
 * Key features:
 * - Inherits all functionality from XXXToken
 * - Adds a version number to demonstrate upgrade success
 * - Uses reinitializer to safely initialize new state variables
 * 
 * This contract is primarily used for testing purposes to verify that:
 * 1. The upgrade process works correctly
 * 2. All existing functionality is preserved
 * 3. New functionality can be added safely
 * 
 * @custom:oz-upgrades-validate-as-initializer
 */
contract XXXTokenV2 is XXXToken {
    /// @notice The version number of this contract implementation
    uint256 public version;

    

    /**
     * @dev Initializes V2 functionality
     * This is called during the upgrade process
     * @custom:oz-upgrades-validate-as-initializer
     */
    function initializeV2() external reinitializer(2) {
        // Initialize parent contracts
        __ERC20_init("XXX Token", "XXX");
        __ERC20Capped_init(1000000000 * 10**18); // 1 billion tokens
        __Ownable_init(msg.sender);
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        version = 2;
    }
} 