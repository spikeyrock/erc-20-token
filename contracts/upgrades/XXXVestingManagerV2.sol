// SPDX-License-Identifier: MIT
/**
 * @title XXXVestingManagerV2
 * @dev TESTING PURPOSES ONLY - DO NOT USE IN PRODUCTION
 * This is a test implementation of VestingManager V2 to demonstrate upgrade functionality.
 * It adds version tracking and additional vesting tracking for testing purposes.
 * This contract should not be used in production environments.
 */

pragma solidity ^0.8.24;

import "../XXXVestingManager.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";


contract XXXVestingManagerV2 is VestingManager {
    // Version tracking for upgrade testing
    uint256 public version;
    // Additional counter for V2 vesting schedules
    uint256 public totalVestedV2;
    
    /**
     * @dev Initializes V2 functionality
     * This is called during the upgrade process
     * @custom:oz-upgrades-validate-as-initializer
     */
    function initializeV2() external reinitializer(2) {
        // Initialize parent contracts
        __ReentrancyGuard_init();
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        // Set version to 2
        version = 2;
    }
    
    /**
     * @dev Returns the current version number
     * @return The version number (2 for V2)
     */
    function getVersion() external view returns (uint256) {
        return version;
    }
    
    /**
     * @dev Returns the total amount vested through V2
     * @return The total amount vested using V2 functions
     */
    function getTotalVestedV2() external view returns (uint256) {
        return totalVestedV2;
    }
    
    /**
     * @dev Creates a new vesting schedule and tracks it in V2 counter
     * @param beneficiary Address to receive vested tokens
     * @param amount Total amount of tokens to vest
     * @param startTime Unix timestamp when vesting begins
     * @param cliffDuration Duration in seconds until first tokens unlock
     * @param duration Total duration of vesting in seconds
     * @param slicePeriodSeconds Duration of each vesting slice in seconds
     * @return scheduleId Unique identifier for the vesting schedule
     */
    function createVestingScheduleV2(
        address beneficiary,
        uint256 amount,
        uint256 startTime,
        uint256 cliffDuration,
        uint256 duration,
        uint256 slicePeriodSeconds
    ) external onlyRole(VESTING_ADMIN_ROLE) returns (uint256) {
        // Input validation
        require(beneficiary != address(0), "Invalid beneficiary");
        require(amount > 0, "Amount must be greater than 0");
        
        // Track V2 vesting
        totalVestedV2 += amount;
        
        // Call base contract's vesting schedule function
        return this.createVestingSchedule(
            beneficiary,
            amount,
            startTime,
            cliffDuration,
            duration,
            slicePeriodSeconds
        );
    }
} 