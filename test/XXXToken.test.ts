import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


// Import the contract type
import { XXXToken } from "../typechain-types";

describe("XXXToken", function () {
  // Test roles
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const UPGRADER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UPGRADER_ROLE"));

  // Test accounts
  let owner: SignerWithAddress;
  let minter: SignerWithAddress;
  let pauser: SignerWithAddress;
  let upgrader: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  // Contract instance
  let token: XXXToken;

  async function deployTokenFixture() {
    [owner, minter, pauser, upgrader, user1, user2] = await ethers.getSigners();

    const XXXToken = await ethers.getContractFactory("XXXToken");
    const token = await upgrades.deployProxy(XXXToken, [], { initializer: 'initialize' });
    await token.waitForDeployment();

    // Grant roles to test accounts
    await token.grantRole(MINTER_ROLE, minter.address);
    await token.grantRole(PAUSER_ROLE, pauser.address);
    await token.grantRole(UPGRADER_ROLE, upgrader.address);

    return { token, owner, minter, pauser, upgrader, user1, user2 };
  }

  beforeEach(async function () {
    ({ token, owner, minter, pauser, upgrader, user1, user2 } = await loadFixture(deployTokenFixture));
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await token.owner()).to.equal(owner.address);
    });

    it("Should assign the correct roles", async function () {
      expect(await token.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await token.hasRole(MINTER_ROLE, minter.address)).to.be.true;
      expect(await token.hasRole(PAUSER_ROLE, pauser.address)).to.be.true;
      expect(await token.hasRole(UPGRADER_ROLE, upgrader.address)).to.be.true;
    });

    it("Should set the correct token name and symbol", async function () {
      expect(await token.name()).to.equal("XXX");
      expect(await token.symbol()).to.equal("XXX");
    });

    it("Should set the correct max supply", async function () {
      expect(await token.MAX_SUPPLY()).to.equal(ethers.parseEther("1000000000")); // 1 billion tokens
    });
  });

  describe("Minting", function () {
    it("Should allow minter to mint tokens", async function () {
      const amount = ethers.parseEther("1000");
      await token.connect(minter).mint(user1.address, amount);
      expect(await token.balanceOf(user1.address)).to.equal(amount);
    });

    it("Should not allow non-minter to mint tokens", async function () {
      const amount = ethers.parseEther("1000");
      await expect(
        token.connect(user1).mint(user2.address, amount)
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("Should allow minting up to max supply", async function () {
      const maxSupply = await token.MAX_SUPPLY();
      await token.connect(minter).mint(user1.address, maxSupply);
      expect(await token.totalSupply()).to.equal(maxSupply);
    });

    it("Should not allow minting beyond max supply", async function () {
      const maxSupply = await token.MAX_SUPPLY();
      await token.connect(minter).mint(user1.address, maxSupply);
      
      // Try to mint 1 more token
      await expect(
        token.connect(minter).mint(user1.address, 1)
      ).to.be.revertedWithCustomError(token, "MaxSupplyExceeded")
        .withArgs(1, 0); // requested: 1, available: 0
    });

    it("Should not allow minting that would exceed max supply", async function () {
      const maxSupply = await token.MAX_SUPPLY();
      const halfSupply = maxSupply / 2n;
      
      // Mint half the supply
      await token.connect(minter).mint(user1.address, halfSupply);
      
      // Try to mint more than the remaining supply
      await expect(
        token.connect(minter).mint(user1.address, halfSupply + 1n)
      ).to.be.revertedWithCustomError(token, "MaxSupplyExceeded");
    });
  });

  describe("Pausing", function () {
    it("Should allow pauser to pause and unpause", async function () {
      await token.connect(pauser).pause();
      expect(await token.paused()).to.be.true;

      await token.connect(pauser).unpause();
      expect(await token.paused()).to.be.false;
    });

    it("Should not allow non-pauser to pause", async function () {
      await expect(
        token.connect(user1).pause()
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow transfers when paused", async function () {
      await token.connect(minter).mint(user1.address, ethers.parseEther("1000"));
      await token.connect(pauser).pause();
      
      await expect(
        token.connect(user1).transfer(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });
  });

  describe("Burning", function () {
    it("Should allow users to burn their tokens", async function () {
      const amount = ethers.parseEther("1000");
      await token.connect(minter).mint(user1.address, amount);
      
      const burnAmount = ethers.parseEther("500");
      await token.connect(user1).burn(burnAmount);
      
      expect(await token.balanceOf(user1.address)).to.equal(amount - burnAmount);
    });

    it("Should not allow burning more tokens than balance", async function () {
      const amount = ethers.parseEther("1000");
      await token.connect(minter).mint(user1.address, amount);
      
      await expect(
        token.connect(user1).burn(ethers.parseEther("1500"))
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });
  });
}); 