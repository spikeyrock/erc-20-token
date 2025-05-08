// SPDX-License-Identifier: MIT
/**
 * @title XXXVestingManager
 * @author https://github.com/spikeyrock
 * @dev Manages vesting schedules, locking, unlocking, and claiming of XXX tokens
 * - Create vesting schedules for beneficiaries
 * - Lock tokens according to vesting schedules
 * - Unlock tokens based on schedule or manually
 * - Allow beneficiaries to claim unlocked tokens
 * - UUPS upgradeable pattern
 */

pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./XXXToken.sol";
import "./XXXTokenVault.sol";

contract VestingManager is Initializable, 
    AccessControlUpgradeable, 
    UUPSUpgradeable, 
    PausableUpgradeable,
    ReentrancyGuardUpgradeable {

    // Role identifiers
    bytes32 public constant VESTING_ADMIN_ROLE = keccak256("VESTING_ADMIN_ROLE");
    bytes32 public constant MANUAL_UNLOCK_ROLE = keccak256("MANUAL_UNLOCK_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // State variables
    XXXToken public ttnToken;
    TokenVault public tokenVault;

    // Vesting schedule structure
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 startTime;
        uint256 cliffDuration;
        uint256 duration;
        uint256 releasedAmount;
        uint256 createdAt;
        uint256 allocationId;
        address beneficiary;
        bool revoked;
    }

    // Vesting schedule counter
    uint256 private _vestingScheduleCounter;

    // Mapping from schedule ID to VestingSchedule
    mapping(uint256 => VestingSchedule) public vestingSchedules;
    
    // Mapping from beneficiary to their schedule IDs
    mapping(address => uint256[]) public beneficiarySchedules;

    // Events
    event VestingScheduleCreated(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 totalAmount,
        uint256 startTime,
        uint256 cliffDuration,
        uint256 duration,
        uint256 allocationId
    );
    event TokensReleased(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 amount
    );
    event ScheduleRevoked(
        uint256 indexed scheduleId, 
        address indexed beneficiary, 
        uint256 remainingAmount
    );
    event ManualUnlock(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 amount,
        address indexed unlockInitiator
    );

    // Custom errors
    error ZeroAddress(string param);
    error InvalidAmount();
    error InvalidDuration();
    error InvalidCliffDuration();
    error InvalidStartTime();
    error InvalidScheduleId();
    error NotBeneficiary();
    error NoTokensDue();
    error TransferFailed();
    error ScheduleRevokeed();
    error AmountExceedsRemaining();
    error NoTokensToRevoke();

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
     * @param _ttnToken Address of the XXXToken contract
     * @param _tokenVault Address of the TokenVault contract
     */
    function initialize(address _ttnToken, address _tokenVault) public initializer {
       if (_ttnToken == address(0)) revert ZeroAddress("token");
       if (_tokenVault == address(0)) revert ZeroAddress("vault");
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        
        ttnToken = XXXToken(_ttnToken);
        tokenVault = TokenVault(_tokenVault);
        
        // Grant admin roles to deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VESTING_ADMIN_ROLE, msg.sender);
        _grantRole(MANUAL_UNLOCK_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        
        _vestingScheduleCounter = 0;
    }

    /**
     * @dev Creates a vesting schedule for a beneficiary
     * @param beneficiary Address to receive vested tokens
     * @param totalAmount Total amount of tokens to vest
     * @param startTime Unix timestamp when vesting begins
     * @param cliffDuration Duration in seconds until first tokens unlock
     * @param duration Total duration of vesting in seconds
     * @param allocationId ID of the allocation in TokenVault
     * @return scheduleId Unique identifier for the vesting schedule
     */
    function createVestingSchedule(
        address beneficiary,
        uint256 totalAmount,
        uint256 startTime,
        uint256 cliffDuration,
        uint256 duration,
        uint256 allocationId
    ) 
        external 
        onlyRole(VESTING_ADMIN_ROLE)
        whenNotPaused
        nonReentrant
        returns (uint256) 
    {
        if (beneficiary == address(0)) revert ZeroAddress("beneficiary");
        if (totalAmount == 0) revert InvalidAmount();
        if (duration == 0) revert InvalidDuration();
        if (duration < cliffDuration) revert InvalidCliffDuration();
        if (startTime < block.timestamp) revert InvalidStartTime();
        
        // Increment vesting schedule counter
        _vestingScheduleCounter++;
        
        // Create new vesting schedule
        vestingSchedules[_vestingScheduleCounter] = VestingSchedule({
            beneficiary: beneficiary,
            totalAmount: totalAmount,
            startTime: startTime,
            cliffDuration: cliffDuration,
            duration: duration,
            releasedAmount: 0,
            revoked: false,
            createdAt: block.timestamp,
            allocationId: allocationId
        });
        
        // Add schedule ID to beneficiary's list
        beneficiarySchedules[beneficiary].push(_vestingScheduleCounter);
        
        emit VestingScheduleCreated(
            _vestingScheduleCounter,
            beneficiary,
            totalAmount,
            startTime,
            cliffDuration,
            duration,
            allocationId
        );
        
        return _vestingScheduleCounter;
    }

    /**
     * @dev Calculates the amount of tokens that can be released from a schedule
     * @param scheduleId ID of the vesting schedule
     * @return The amount of tokens that can be released
     */
    function computeReleasableAmount(uint256 scheduleId) internal view returns (uint256) {
        if (scheduleId == 0 || scheduleId > _vestingScheduleCounter) revert InvalidScheduleId();
        
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        
        // If schedule is revoked, nothing can be released
        if (schedule.revoked) {
            return 0;
        }
        
        // If current time is before cliff, nothing can be released
        if (block.timestamp < schedule.startTime + schedule.cliffDuration) {
            return 0;
        }
        
        // If vesting has finished, all remaining tokens can be released
        if (block.timestamp >= schedule.startTime + schedule.duration) {
            return schedule.totalAmount - schedule.releasedAmount;
        }
        
        // Calculate linear vesting amount
        uint256 timeFromStart = block.timestamp - schedule.startTime;
        uint256 vestedAmount = (schedule.totalAmount * timeFromStart) / schedule.duration;
        
        return vestedAmount - schedule.releasedAmount;
    }

    /**
     * @dev Allows beneficiary to claim released tokens from a schedule
     * @param scheduleId ID of the vesting schedule
     * @return The amount of tokens claimed
     */
    function release(uint256 scheduleId) 
        external 
        whenNotPaused
        nonReentrant
        returns (uint256) 
    {
        if (scheduleId == 0 || scheduleId > _vestingScheduleCounter) revert InvalidScheduleId();
        
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        if (msg.sender != schedule.beneficiary) revert NotBeneficiary();
        
        uint256 releasableAmount = computeReleasableAmount(scheduleId);
        if (releasableAmount == 0) revert NoTokensDue();
        
        // Update released amount
        schedule.releasedAmount += releasableAmount;
        
        // Transfer tokens to beneficiary
        if (!ttnToken.transfer(schedule.beneficiary, releasableAmount)) revert TransferFailed();
        
        emit TokensReleased(scheduleId, schedule.beneficiary, releasableAmount);
        
        return releasableAmount;
    }

    /**
     * @dev Manually unlocks tokens from a vesting schedule
     * @param scheduleId ID of the vesting schedule
     * @param amount Amount of tokens to unlock
     * @return success Whether the manual unlock was successful
     */
    function manualUnlock(uint256 scheduleId, uint256 amount) 
        external 
        onlyRole(MANUAL_UNLOCK_ROLE)
        nonReentrant
        returns (bool) 
    {
        if (scheduleId == 0 || scheduleId > _vestingScheduleCounter) revert InvalidScheduleId();
        if (amount == 0) revert InvalidAmount();
        
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        if (schedule.revoked) revert ScheduleRevokeed();
        
        uint256 remainingAmount = schedule.totalAmount - schedule.releasedAmount;
        if (amount > remainingAmount) revert AmountExceedsRemaining();
        
        // Update released amount
        schedule.releasedAmount += amount;
        
        // Transfer tokens to beneficiary
        if (!ttnToken.transfer(schedule.beneficiary, amount)) revert TransferFailed();
        
        emit ManualUnlock(scheduleId, schedule.beneficiary, amount, msg.sender);
        
        return true;
    }

    /**
     * @dev Revokes a vesting schedule
     * @param scheduleId ID of the vesting schedule to revoke
     * @return The amount of tokens returned to the vault
     */
    function revokeSchedule(uint256 scheduleId) 
        external 
        onlyRole(VESTING_ADMIN_ROLE)
        nonReentrant
        returns (uint256) 
    {
        if (scheduleId == 0 || scheduleId > _vestingScheduleCounter) revert InvalidScheduleId();
        
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        if (schedule.revoked) revert ScheduleRevokeed();
        
        // Calculate remaining tokens
        uint256 releasableAmount = computeReleasableAmount(scheduleId);
        uint256 remainingAmount = schedule.totalAmount - schedule.releasedAmount - releasableAmount;
        
        // Ensure there are tokens to revoke
        if (remainingAmount == 0) revert NoTokensToRevoke();
        
        // Mark schedule as revoked
        schedule.revoked = true;
        
        // Revoke allocation in TokenVault if allocationId is set
        if (schedule.allocationId > 0) {
            tokenVault.revokeAllocation(schedule.allocationId);
        }
        
        // Transfer remaining tokens to beneficiary
        if (!ttnToken.transfer(schedule.beneficiary, remainingAmount)) revert TransferFailed();
        
        emit ScheduleRevoked(scheduleId, schedule.beneficiary, remainingAmount);
        
        return remainingAmount;
    }

    /**
     * @dev Returns all vesting schedules for a beneficiary
     * @param beneficiary Address to check schedules for
     * @return scheduleIds Array of schedule IDs for the beneficiary
     */
    function getSchedulesForBeneficiary(address beneficiary) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return beneficiarySchedules[beneficiary];
    }

    /**
     * @dev Returns vesting schedule details
     * @param scheduleId ID of the vesting schedule
     * @return VestingSchedule structure with all details
     */
    function getVestingSchedule(uint256 scheduleId) 
        external 
        view 
        returns (VestingSchedule memory) 
    {
        if (scheduleId == 0 || scheduleId > _vestingScheduleCounter) revert InvalidScheduleId();
        return vestingSchedules[scheduleId];
    }

    /**
     * @dev Returns vesting info for a schedule
     * @param scheduleId ID of the vesting schedule
     * @return totalAmount Total amount of tokens in the schedule
     * @return releasedAmount Amount of tokens already released
     * @return releasableAmount Amount of tokens currently releasable
     * @return remainingAmount Amount of tokens still locked
     * @return nextUnlockTime Unix timestamp of next unlock (or 0 if fully vested)
     */
    function getVestingInfo(uint256 scheduleId) 
        external 
        view 
        returns (
            uint256 totalAmount,
            uint256 releasedAmount,
            uint256 releasableAmount,
            uint256 remainingAmount,
            uint256 nextUnlockTime
        ) 
    {
        if (scheduleId == 0 || scheduleId > _vestingScheduleCounter) revert InvalidScheduleId();
        
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        releasableAmount = computeReleasableAmount(scheduleId);
        
        totalAmount = schedule.totalAmount;
        releasedAmount = schedule.releasedAmount;
        remainingAmount = schedule.totalAmount - schedule.releasedAmount - releasableAmount;
        
        // Calculate next unlock time
        if (block.timestamp < schedule.startTime + schedule.cliffDuration) {
            // Cliff hasn't been reached yet
            nextUnlockTime = schedule.startTime + schedule.cliffDuration;
        } else if (block.timestamp >= schedule.startTime + schedule.duration) {
            // Fully vested
            nextUnlockTime = 0;
        } else {
            // Linear vesting in progress
            nextUnlockTime = block.timestamp + 1 days; // Next day for linear vesting
        }
    }

    /**
     * @dev Pauses vesting operations
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses vesting operations
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract
     * Called by {upgradeTo} and {upgradeToAndCall}
     * 
     * @param newImplementation Address of the new implementation contract
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}