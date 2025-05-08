import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TokenVault, XXXTokenVaultV2, XXXToken } from "../../typechain-types";

describe("TokenVault Upgrades", function () {
  // Role identifiers
  const UPGRADER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UPGRADER_ROLE"));
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

  // Test accounts
  let owner: SignerWithAddress;
  let upgrader: SignerWithAddress;
  let user: SignerWithAddress;

  // Contract instances
  let token: XXXToken;
  let vault: TokenVault;
  let vaultV2: XXXTokenVaultV2;

  async function deployFixture() {
    [owner, upgrader, user] = await ethers.getSigners();

    // Deploy token
    const XXXToken = await ethers.getContractFactory("XXXToken");
    const token = await upgrades.deployProxy(XXXToken, [], { initializer: 'initialize' });
    await token.waitForDeployment();

    // Deploy vault
    const TokenVault = await ethers.getContractFactory("TokenVault");
    const vault = await upgrades.deployProxy(TokenVault, [await token.getAddress()], { initializer: 'initialize' });
    await vault.waitForDeployment();
    
    // Grant roles
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    await token.grantRole(MINTER_ROLE, await vault.getAddress());
    await vault.grantRole(UPGRADER_ROLE, upgrader.address);

    return { token, vault, owner, upgrader, user };
  }

  beforeEach(async function () {
    ({ token, vault, owner, upgrader, user } = await loadFixture(deployFixture));
  });

  describe("Upgrading", function () {
    it("Should allow upgrader to upgrade the contract", async function () {
      // Get V2 contract factory
      const TokenVaultV2 = await ethers.getContractFactory("XXXTokenVaultV2");
      
      // Upgrade to V2
      const upgraded = await upgrades.upgradeProxy(await vault.getAddress(), TokenVaultV2);
      await upgraded.initializeV2()
      // Verify new functionality
      expect(await upgraded.version()).to.equal(2);
    });

    it("Should not allow non-upgrader to upgrade the contract", async function () {
      // Get V2 contract factory
      const TokenVaultV2 = await ethers.getContractFactory("XXXTokenVaultV2");
      
      await expect(
        upgrades.upgradeProxy(await vault.getAddress(), TokenVaultV2.connect(user))
      ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
    });

    it("Should preserve state after upgrade", async function () {
      // Create some state before upgrade
      const beneficiary = user.address;
      const amount = ethers.parseEther("1000");
      await vault.connect(owner).createAllocation(beneficiary, amount);

      // Get V2 contract factory
      const TokenVaultV2 = await ethers.getContractFactory("XXXTokenVaultV2");
      
      // Upgrade to V2
      await upgrades.upgradeProxy(await vault.getAddress(), TokenVaultV2);
      
      // Get the upgraded contract
      const upgradedVault = await ethers.getContractAt("XXXTokenVaultV2", await vault.getAddress());
      
      // Verify state is preserved
      const allocations = await upgradedVault.getAllocationsForBeneficiary(beneficiary);
      expect(allocations.length).to.equal(1);
      
      const allocation = await upgradedVault.allocations(allocations[0]);
      expect(allocation.amount).to.equal(amount);
      expect(allocation.beneficiary).to.equal(beneficiary);
    });

    it("Should not allow initializing V2 twice", async function () {
      // Get V2 contract factory
      const TokenVaultV2 = await ethers.getContractFactory("XXXTokenVaultV2");
      
      // Upgrade to V2
      const upgraded = await upgrades.upgradeProxy(await vault.getAddress(), TokenVaultV2);
      await upgraded.initializeV2();
      
      // Try to initialize again
      await expect(
        upgraded.initializeV2()
      ).to.be.revertedWithCustomError(upgraded, "InvalidInitialization");
    });
  });
}); 