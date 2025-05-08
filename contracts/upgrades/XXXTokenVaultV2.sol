// SPDX-License-Identifier: MIT
/**
 * @title XXXTokenVaultV2
 * @dev TESTING PURPOSES ONLY - DO NOT USE IN PRODUCTION
 * This is a test implementation of TokenVault V2 to demonstrate upgrade functionality.
 * It adds version tracking and additional allocation tracking for testing purposes.
 * This contract should not be used in production environments.
 */

pragma solidity ^0.8.24;

import "../XXXTokenVault.sol";

contract XXXTokenVaultV2 is TokenVault {
    // Version tracking for upgrade testing
    uint256 public version;
    // Additional counter for V2 allocations
    uint256 public totalAllocatedV2;
    
    /**
     * @dev Initializes V2 functionality
     * This is called during the upgrade process
     */
    function initializeV2() public reinitializer(2) {
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
     * @dev Returns the total amount allocated through V2
     * @return The total amount allocated using V2 functions
     */
    function getTotalAllocatedV2() external view returns (uint256) {
        return totalAllocatedV2;
    }
    
    /**
     * @dev Creates a new allocation and tracks it in V2 counter
     * @param beneficiary Address to receive allocated tokens
     * @param amount Total amount of tokens to allocate
     * @return allocationId Unique identifier for the allocation
     */
    function createAllocationV2(address beneficiary, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256) {
        // Input validation
        require(beneficiary != address(0), "Invalid beneficiary");
        require(amount > 0, "Amount must be greater than 0");
        
        // Track V2 allocation
        totalAllocatedV2 += amount;
        
        // Call base contract's allocation function
        return this.createAllocation(beneficiary, amount);
    }
} 