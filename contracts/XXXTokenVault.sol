// SPDX-License-Identifier: MIT
/**
 * @title XXXTokenVault
 * @author https://github.com/spikeyrock
 * @dev Token Treasury & Allocation Manager for XXXToken
 * - Manages minting of tokens through allocations
 * - Handles airdrops to multiple addresses
 * - Allows revocation of allocations
 * - UUPS upgradeable pattern
 */

pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./XXXToken.sol";

contract TokenVault is Initializable, 
    AccessControlUpgradeable, 
    UUPSUpgradeable, 
    PausableUpgradeable,
    ReentrancyGuardUpgradeable {

    // Role identifiers
    bytes32 public constant ALLOCATOR_ROLE = keccak256("ALLOCATOR_ROLE");
    bytes32 public constant AIRDROP_ROLE = keccak256("AIRDROP_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // State variables
    XXXToken public ttnToken;
    address public vestingManager;

    // Events
    event AllocationCreated(address indexed beneficiary, uint256 amount, uint256 allocationId);
    event AllocationRevoked(address indexed beneficiary, uint256 amount, uint256 allocationId);
    event AirdropExecuted(address[] beneficiaries, uint256[] amounts, uint256 airdropId);
    event VestingManagerSet(address indexed vestingManager);

    // Custom errors
    error ZeroAddress(string param);
    error InvalidAmount();
    error InvalidAllocationId();
    error AllocationAlreadyRevoked();
    error EmptyBeneficiariesList();
    error ArraysLengthMismatch();
    error InvalidBeneficiary();
    error InvalidAmountInBatch();

    // Allocation counter
    uint256 private _allocationCounter;
    uint256 private _airdropCounter;

    // Allocation tracking
    struct Allocation {
        uint256 amount;
        address beneficiary;
        bool revoked;
    }
    
    // Mapping from allocation ID to Allocation
    mapping(uint256 => Allocation) public allocations;
    
    // Mapping from beneficiary to their allocation IDs
    mapping(address => uint256[]) public beneficiaryAllocations;

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
     */
    function initialize(address _ttnToken) external initializer {
         if (_ttnToken == address(0)) revert ZeroAddress("token");
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
       
        ttnToken = XXXToken(_ttnToken);
        
        // Grant admin roles to deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ALLOCATOR_ROLE, msg.sender);
        _grantRole(AIRDROP_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        
        _allocationCounter = 0;
        _airdropCounter = 0;
    }

    /**
     * @dev Sets the VestingManager address
     * @param _vestingManager Address of the VestingManager contract
     */
    function setVestingManager(address _vestingManager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_vestingManager == address(0)) revert ZeroAddress("vesting manager");
        vestingManager = _vestingManager;
        emit VestingManagerSet(_vestingManager);
    }

    /**
     * @dev Creates a new allocation and mints tokens
     * @param beneficiary Address to receive the allocation
     * @param amount Amount of tokens to allocate
     * @return allocationId Unique identifier for the allocation
     */
    function createAllocation(address beneficiary, uint256 amount) 
        external 
        onlyRole(ALLOCATOR_ROLE) 
        whenNotPaused 
        nonReentrant 
        returns (uint256) 
    {
        if (beneficiary == address(0)) revert InvalidBeneficiary();
        if (amount == 0) revert InvalidAmount();
        
        // Increment allocation counter
        _allocationCounter++;
        
        // Store allocation details
        allocations[_allocationCounter] = Allocation({
            beneficiary: beneficiary,
            amount: amount,
            revoked: false
        });
        
        // Add allocation ID to beneficiary's list
        beneficiaryAllocations[beneficiary].push(_allocationCounter);
        
        // Mint tokens to the vesting manager (if set) or to the beneficiary
        if (vestingManager != address(0)) {
            ttnToken.mint(vestingManager, amount);
        } else {
            ttnToken.mint(beneficiary, amount);
        }
        
        emit AllocationCreated(beneficiary, amount, _allocationCounter);
        
        return _allocationCounter;
    }

    /**
     * @dev Revokes an allocation
     * @param allocationId ID of the allocation to revoke
     * @return success Whether the revocation was successful
     */
    function revokeAllocation(uint256 allocationId) 
        external 
        onlyRole(ALLOCATOR_ROLE) 
        nonReentrant 
        returns (bool) 
    {
        if (allocationId == 0 || allocationId > _allocationCounter) revert InvalidAllocationId();
        
        Allocation storage allocation = allocations[allocationId];
        if (allocation.revoked) revert AllocationAlreadyRevoked();
        
        // Mark allocation as revoked
        allocation.revoked = true;
        
        emit AllocationRevoked(allocation.beneficiary, allocation.amount, allocationId);
        
        return true;
    }

    /**
     * @dev Executes an airdrop to multiple addresses
     * @param beneficiaries Array of addresses to receive tokens
     * @param amounts Array of token amounts to distribute
     * @return airdropId Unique identifier for the airdrop
     */
    function executeAirdrop(address[] calldata beneficiaries, uint256[] calldata amounts) 
        external 
        onlyRole(AIRDROP_ROLE) 
        whenNotPaused 
        nonReentrant 
        returns (uint256) 
    {
        if (beneficiaries.length == 0) revert EmptyBeneficiariesList();
        if (beneficiaries.length != amounts.length) revert ArraysLengthMismatch();
        
        // Increment airdrop counter
        _airdropCounter++;
        
        // Process each beneficiary
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            if (beneficiaries[i] == address(0)) revert InvalidBeneficiary();
            if (amounts[i] == 0) revert InvalidAmountInBatch();
            
            // Create an allocation for each beneficiary
            _allocationCounter++;
            
            // Store allocation details
            allocations[_allocationCounter] = Allocation({
                beneficiary: beneficiaries[i],
                amount: amounts[i],
                revoked: false
            });
            
            // Add allocation ID to beneficiary's list
            beneficiaryAllocations[beneficiaries[i]].push(_allocationCounter);
            
            // Mint tokens to the vesting manager (if set) or to the beneficiary
            if (vestingManager != address(0)) {
                ttnToken.mint(vestingManager, amounts[i]);
            } else {
                ttnToken.mint(beneficiaries[i], amounts[i]);
            }
        }
        
        emit AirdropExecuted(beneficiaries, amounts, _airdropCounter);
        
        return _airdropCounter;
    }

    /**
     * @dev Returns all allocations for a beneficiary
     * @param beneficiary Address to check allocations for
     * @return allocationIds Array of allocation IDs for the beneficiary
     */
    function getAllocationsForBeneficiary(address beneficiary) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return beneficiaryAllocations[beneficiary];
    }

    /**
     * @dev Pauses vault operations
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses vault operations
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