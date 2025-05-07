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
     * @dev Initializes the V2 contract with a version number.
     * This function is called after the upgrade to set up the new state variables.
     * The reinitializer modifier ensures this can only be called once after the upgrade.
     */
    function initializeV2() public reinitializer(2) {
        version = 2;
    }
} 