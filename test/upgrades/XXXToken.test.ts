import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { XXXToken, XXXTokenV2 } from "../../typechain-types";

describe("XXXToken Upgrades", function () {
  // Test roles
  const UPGRADER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UPGRADER_ROLE"));

  // Test accounts
  let owner: SignerWithAddress;
  let upgrader: SignerWithAddress;
  let user1: SignerWithAddress;

  // Contract instance
  let token: XXXToken;

  async function deployTokenFixture() {
    [owner, upgrader, user1] = await ethers.getSigners();

    const XXXToken = await ethers.getContractFactory("XXXToken");
    const token = await upgrades.deployProxy(XXXToken, [], { initializer: 'initialize' });
    await token.waitForDeployment();

    // Grant roles to test accounts
    await token.grantRole(UPGRADER_ROLE, upgrader.address);

    return { token, owner, upgrader, user1 };
  }

  beforeEach(async function () {
    ({ token, owner, upgrader, user1 } = await loadFixture(deployTokenFixture));
  });

  describe("Upgrading", function () {
    it("Should allow upgrader to upgrade the contract", async function () {
      const XXXTokenV2Factory = await ethers.getContractFactory("XXXTokenV2");
      const upgraded = await upgrades.upgradeProxy(await token.getAddress(), XXXTokenV2Factory) as unknown as XXXTokenV2;
      await upgraded.initializeV2();
      expect(await upgraded.version()).to.equal(2);
    });

    it("Should not allow initializing V2 twice", async function () {
      const XXXTokenV2Factory = await ethers.getContractFactory("XXXTokenV2");
      const upgraded = await upgrades.upgradeProxy(await token.getAddress(), XXXTokenV2Factory) as unknown as XXXTokenV2;
      await upgraded.initializeV2();
      
      await expect(
        upgraded.initializeV2()
      ).to.be.revertedWithCustomError(upgraded, "InvalidInitialization");
    });

    it("Should not allow non-upgrader to upgrade the contract", async function () {
      const XXXTokenV2Factory = await ethers.getContractFactory("XXXTokenV2");
      await expect(
        upgrades.upgradeProxy(await token.getAddress(), XXXTokenV2Factory.connect(user1))
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });
  });
}); 