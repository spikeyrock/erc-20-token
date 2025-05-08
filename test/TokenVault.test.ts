import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TokenVault, XXXToken } from "../typechain-types";

describe("TokenVault", function () {
  // Role identifiers
  const ALLOCATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ALLOCATOR_ROLE"));
  const AIRDROP_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AIRDROP_ROLE"));
  const UPGRADER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UPGRADER_ROLE"));

  // Test accounts
  let owner: SignerWithAddress;
  let allocator: SignerWithAddress;
  let airdropper: SignerWithAddress;
  let vestingManager: SignerWithAddress;
  let beneficiary1: SignerWithAddress;
  let beneficiary2: SignerWithAddress;
  let user: SignerWithAddress;

  // Contract instances
  let token: XXXToken;
  let vault: TokenVault;

  async function deployVaultFixture() {
    [owner, allocator, airdropper, vestingManager, beneficiary1, beneficiary2, user] = await ethers.getSigners();

    // Deploy token
    const XXXToken = await ethers.getContractFactory("XXXToken");
    const token = await upgrades.deployProxy(XXXToken, [], { initializer: 'initialize' });
    await token.waitForDeployment();

    // Deploy vault
    const TokenVault = await ethers.getContractFactory("TokenVault");
    const vault = await upgrades.deployProxy(TokenVault, [await token.getAddress()], { initializer: 'initialize' });
    await vault.waitForDeployment();

    // Grant all roles to the owner (admin)
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const ALLOCATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ALLOCATOR_ROLE"));
    const AIRDROP_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AIRDROP_ROLE"));
    const UPGRADER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UPGRADER_ROLE"));
    const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

    // Grant MINTER_ROLE to the vault contract
    await token.grantRole(MINTER_ROLE, await vault.getAddress());

    // Grant all other roles to the owner
    await vault.grantRole(DEFAULT_ADMIN_ROLE, owner.address);
    await vault.grantRole(ALLOCATOR_ROLE, owner.address);
    await vault.grantRole(AIRDROP_ROLE, owner.address);
    await vault.grantRole(UPGRADER_ROLE, owner.address);

    return { token, vault, owner, allocator, airdropper, vestingManager, beneficiary1, beneficiary2, user };
  }

  beforeEach(async function () {
    ({ token, vault, owner, allocator, airdropper, vestingManager, beneficiary1, beneficiary2, user } = 
      await loadFixture(deployVaultFixture));
  });

  describe("Deployment", function () {
    it("Should set the correct token address", async function () {
      expect(await vault.ttnToken()).to.equal(await token.getAddress());
    });

    it("Should assign the correct roles", async function () {
      expect(await vault.hasRole(ALLOCATOR_ROLE, owner.address)).to.be.true;
      expect(await vault.hasRole(AIRDROP_ROLE, owner.address)).to.be.true;
      expect(await vault.hasRole(UPGRADER_ROLE, owner.address)).to.be.true;
    });

    it("Should initialize counters to zero", async function () {
      expect(await vault.getAllocationsForBeneficiary(beneficiary1.address)).to.be.empty;
    });
  });

  describe("Set Vesting Manager", function () {
    it("Should allow admin to set vesting manager", async function () {
      await vault.setVestingManager(vestingManager.address);
      expect(await vault.vestingManager()).to.equal(vestingManager.address);
    });

    it("Should not allow non-admin to set vesting manager", async function () {
      await expect(
        vault.connect(user).setVestingManager(vestingManager.address)
      ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow setting zero address as vesting manager", async function () {
      await expect(
        vault.setVestingManager(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(vault, "ZeroAddress");
    });
  });

  describe("Allocations", function () {
    it("Should allow allocator to create allocation", async function () {
      const amount = ethers.parseEther("1000");
      await vault.connect(owner).createAllocation(beneficiary1.address, amount);
      
      const allocations = await vault.getAllocationsForBeneficiary(beneficiary1.address);
      expect(allocations.length).to.equal(1);
      
      const allocation = await vault.allocations(allocations[0]);
      expect(allocation.amount).to.equal(amount);
      expect(allocation.beneficiary).to.equal(beneficiary1.address);
      expect(allocation.revoked).to.be.false;
    });

    it("Should not allow non-allocator to create allocation", async function () {
      await expect(
        vault.connect(user).createAllocation(beneficiary1.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow creating allocation with zero amount", async function () {
      await expect(
        vault.connect(owner).createAllocation(beneficiary1.address, 0)
      ).to.be.revertedWithCustomError(vault, "InvalidAmount");
    });

    it("Should not allow creating allocation for zero address", async function () {
      await expect(
        vault.connect(owner).createAllocation(ethers.ZeroAddress, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(vault, "InvalidBeneficiary");
    });

    it("Should allow allocator to revoke allocation", async function () {
      const amount = ethers.parseEther("1000");
      await vault.connect(owner).createAllocation(beneficiary1.address, amount);
      
      const allocations = await vault.getAllocationsForBeneficiary(beneficiary1.address);
      await vault.connect(owner).revokeAllocation(allocations[0]);
      
      const allocation = await vault.allocations(allocations[0]);
      expect(allocation.revoked).to.be.true;
    });

    it("Should not allow revoking non-existent allocation", async function () {
      await expect(
        vault.connect(owner).revokeAllocation(999)
      ).to.be.revertedWithCustomError(vault, "InvalidAllocationId");
    });

    it("Should not allow revoking already revoked allocation", async function () {
      const amount = ethers.parseEther("1000");
      await vault.connect(owner).createAllocation(beneficiary1.address, amount);
      
      const allocations = await vault.getAllocationsForBeneficiary(beneficiary1.address);
      await vault.connect(owner).revokeAllocation(allocations[0]);
      
      await expect(
        vault.connect(owner).revokeAllocation(allocations[0])
      ).to.be.revertedWithCustomError(vault, "AllocationAlreadyRevoked");
    });
  });

  describe("Airdrops", function () {
    it("Should allow airdropper to execute airdrop", async function () {
      const beneficiaries = [beneficiary1.address, beneficiary2.address];
      const amounts = [ethers.parseEther("1000"), ethers.parseEther("2000")];
      
      await vault.connect(owner).executeAirdrop(beneficiaries, amounts);
      
      const allocations1 = await vault.getAllocationsForBeneficiary(beneficiary1.address);
      const allocations2 = await vault.getAllocationsForBeneficiary(beneficiary2.address);
      
      expect(allocations1.length).to.equal(1);
      expect(allocations2.length).to.equal(1);
      
      const allocation1 = await vault.allocations(allocations1[0]);
      const allocation2 = await vault.allocations(allocations2[0]);
      
      expect(allocation1.amount).to.equal(amounts[0]);
      expect(allocation2.amount).to.equal(amounts[1]);
    });

    it("Should not allow non-airdropper to execute airdrop", async function () {
      const beneficiaries = [beneficiary1.address];
      const amounts = [ethers.parseEther("1000")];
      
      await expect(
        vault.connect(user).executeAirdrop(beneficiaries, amounts)
      ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow airdrop with empty beneficiaries list", async function () {
      await expect(
        vault.connect(owner).executeAirdrop([], [])
      ).to.be.revertedWithCustomError(vault, "EmptyBeneficiariesList");
    });

    it("Should not allow airdrop with mismatched arrays", async function () {
      const beneficiaries = [beneficiary1.address, beneficiary2.address];
      const amounts = [ethers.parseEther("1000")];
      
      await expect(
        vault.connect(owner).executeAirdrop(beneficiaries, amounts)
      ).to.be.revertedWithCustomError(vault, "ArraysLengthMismatch");
    });
  });

  describe("Pausing", function () {
    it("Should allow admin to pause and unpause", async function () {
      await vault.pause();
      expect(await vault.paused()).to.be.true;

      await vault.unpause();
      expect(await vault.paused()).to.be.false;
    });

    it("Should not allow non-admin to pause", async function () {
      await expect(
        vault.connect(user).pause()
      ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow allocations when paused", async function () {
      await vault.pause();
      
      await expect(
        vault.connect(owner).createAllocation(beneficiary1.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });

    it("Should not allow airdrops when paused", async function () {
      await vault.pause();
      
      const beneficiaries = [beneficiary1.address];
      const amounts = [ethers.parseEther("1000")];
      
      await expect(
        vault.connect(owner).executeAirdrop(beneficiaries, amounts)
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });
  });

  describe("Token Minting", function () {
    it("Should allow minting up to max supply", async function () {
      const maxSupply = await token.MAX_SUPPLY();
      const halfSupply = maxSupply / 2n;
      
      // Mint half the supply
      await vault.connect(owner).createAllocation(beneficiary1.address, halfSupply);
      await vault.connect(owner).createAllocation(beneficiary2.address, halfSupply);
      
      // Verify total supply
      expect(await token.totalSupply()).to.equal(maxSupply);
    });

    it("Should not allow minting beyond max supply", async function () {
      const maxSupply = await token.MAX_SUPPLY();
      const halfSupply = maxSupply / 2n;
      
      // Mint half the supply
      await vault.connect(owner).createAllocation(beneficiary1.address, halfSupply);
      await vault.connect(owner).createAllocation(beneficiary2.address, halfSupply);
      
      // Try to mint one more token
      await expect(
        vault.connect(owner).createAllocation(beneficiary1.address, 1)
      ).to.be.revertedWithCustomError(token, "MaxSupplyExceeded");
    });

    it("Should not allow minting that would exceed max supply", async function () {
      const maxSupply = await token.MAX_SUPPLY();
      const halfSupply = maxSupply / 2n;
      
      // Mint half the supply
      await vault.connect(owner).createAllocation(beneficiary1.address, halfSupply);
      
      // Try to mint more than the remaining supply
      await expect(
        vault.connect(owner).createAllocation(beneficiary2.address, halfSupply + 1n)
      ).to.be.revertedWithCustomError(token, "MaxSupplyExceeded");
    });
  });
}); 