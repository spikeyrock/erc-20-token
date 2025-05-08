import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { VestingManager, XXXToken, TokenVault } from "../typechain-types";

describe("VestingManager", function () {
  // Role identifiers
  const VESTING_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VESTING_ADMIN_ROLE"));
  const MANUAL_UNLOCK_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANUAL_UNLOCK_ROLE"));

  
  // Test accounts
  let owner: SignerWithAddress;
  let vestingAdmin: SignerWithAddress;
  let manualUnlocker: SignerWithAddress;
  let beneficiary: SignerWithAddress;
  let user: SignerWithAddress;

  // Contract instances
  let token: XXXToken;
  let vault: TokenVault;
  let vestingManager: VestingManager;

  async function deployFixture() {
    [owner, vestingAdmin, manualUnlocker, beneficiary, user] = await ethers.getSigners();

    // Deploy token
    const XXXToken = await ethers.getContractFactory("XXXToken");
    const token = await upgrades.deployProxy(XXXToken, [], { initializer: 'initialize' });
    await token.waitForDeployment();

    // Deploy vault
    const TokenVault = await ethers.getContractFactory("TokenVault");
    const vault = await upgrades.deployProxy(TokenVault, [await token.getAddress()], { initializer: 'initialize' });
    await vault.waitForDeployment();

    // Deploy vesting manager
    const VestingManager = await ethers.getContractFactory("VestingManager");
    const vestingManager = await upgrades.deployProxy(VestingManager, 
      [await token.getAddress(), await vault.getAddress()], 
      { initializer: 'initialize' }
    );
    await vestingManager.waitForDeployment();

    // Grant roles
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    await token.grantRole(MINTER_ROLE, await vault.getAddress());
    await vestingManager.grantRole(VESTING_ADMIN_ROLE, owner.address);
    await vestingManager.grantRole(MANUAL_UNLOCK_ROLE, owner.address);

    // grant vesting manager a minter role
    await token.grantRole(MINTER_ROLE, await vestingManager.getAddress());

    return { token, vault, vestingManager, owner, vestingAdmin, manualUnlocker, beneficiary, user };
  }

  beforeEach(async function () {
    ({ token, vault, vestingManager, owner, vestingAdmin, manualUnlocker, beneficiary, user } = 
      await loadFixture(deployFixture));
  });

  describe("Deployment", function () {
    it("Should set the correct token and vault addresses", async function () {
      expect(await vestingManager.ttnToken()).to.equal(await token.getAddress());
      expect(await vestingManager.tokenVault()).to.equal(await vault.getAddress());
    });

    it("Should assign the correct roles", async function () {
      expect(await vestingManager.hasRole(VESTING_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await vestingManager.hasRole(MANUAL_UNLOCK_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Vesting Schedule Creation", function () {
    const amount = ethers.parseEther("1000");
    const startTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const cliffDuration = 3600 * 24 * 30; // 30 days
    const duration = 3600 * 24 * 365; // 1 year

    it("Should allow vesting admin to create a vesting schedule", async function () {
      const tx = await vestingManager.connect(owner).createVestingSchedule(
        beneficiary.address,
        amount,
        startTime,
        cliffDuration,
        duration,
        0 // no allocation ID
      );

      const receipt = await tx.wait();
      const event = receipt?.logs[0];
      const scheduleId = event?.topics[1] ? BigInt(event.topics[1]) : BigInt(0);

      expect(await vestingManager.getVestingSchedule(scheduleId)).to.exist;
    });

    it("Should not allow non-admin to create vesting schedule", async function () {
      await expect(
        vestingManager.connect(user).createVestingSchedule(
          beneficiary.address,
          amount,
          startTime,
          cliffDuration,
          duration,
          0
        )
      ).to.be.revertedWithCustomError(vestingManager, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow creating schedule with zero amount", async function () {
      await expect(
        vestingManager.connect(owner).createVestingSchedule(
          beneficiary.address,
          0,
          startTime,
          cliffDuration,
          duration,
          0
        )
      ).to.be.revertedWithCustomError(vestingManager, "InvalidAmount");
    });

    it("Should not allow creating schedule with zero duration", async function () {
      await expect(
        vestingManager.connect(owner).createVestingSchedule(
          beneficiary.address,
          amount,
          startTime,
          cliffDuration,
          0,
          0
        )
      ).to.be.revertedWithCustomError(vestingManager, "InvalidDuration");
    });
  });

  describe("Token Release", function () {
    const amount = ethers.parseEther("1000");
    let scheduleId: bigint;

    beforeEach(async function () {
      // Create a vesting schedule
      const startTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const cliffDuration = 3600 * 24 * 30; // 30 days
      const duration = 3600 * 24 * 365; // 1 year

      const tx = await vestingManager.connect(owner).createVestingSchedule(
        beneficiary.address,
        amount,
        startTime,
        cliffDuration,
        duration,
        0
      );

      const receipt = await tx.wait();
      const event = receipt?.logs[0];
      scheduleId = event?.topics[1] ? BigInt(event.topics[1]) : BigInt(0);
    });

    it("Should not allow release before cliff", async function () {
      await expect(
        vestingManager.connect(beneficiary).release(scheduleId)
      ).to.be.revertedWithCustomError(vestingManager, "NoTokensDue");
    });

    it("Should not allow non-beneficiary to release tokens", async function () {
      await expect(
        vestingManager.connect(user).release(scheduleId)
      ).to.be.revertedWithCustomError(vestingManager, "NotBeneficiary");
    });
  });

  describe("Manual Unlock", function () {
    const amount = ethers.parseEther("1000");
    let scheduleId: bigint;

    beforeEach(async function () {
      // Create a vesting schedule
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const cliffDuration = 3600 * 24 * 30;
      const duration = 3600 * 24 * 365;

      const tx = await vestingManager.connect(owner).createVestingSchedule(
        beneficiary.address,
        amount,
        startTime,
        cliffDuration,
        duration,
        0
      );

      const receipt = await tx.wait();
      const event = receipt?.logs[0];
      scheduleId = event?.topics[1] ? BigInt(event.topics[1]) : BigInt(0);
    });

    it("Should allow a manual unlock", async function () {
      // First mint tokens to the vesting manager
      const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
      await token.grantRole(MINTER_ROLE, await vestingManager.getAddress());
      await token.mint(await vestingManager.getAddress(), amount);

      const unlockAmount = ethers.parseEther("100");
      await vestingManager.connect(owner).manualUnlock(scheduleId, unlockAmount);
      
      const schedule = await vestingManager.getVestingSchedule(scheduleId);
      expect(schedule.releasedAmount).to.equal(unlockAmount);
      
      // Verify beneficiary received the tokens
      expect(await token.balanceOf(beneficiary.address)).to.equal(unlockAmount);
    });

    it("Should not allow non-manual-unlocker to unlock tokens", async function () {
      await expect(
        vestingManager.connect(user).manualUnlock(scheduleId, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(vestingManager, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Schedule Revocation", function () {
    const amount = ethers.parseEther("1000");
    let scheduleId: bigint;

    beforeEach(async function () {
      // Create a vesting schedule
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const cliffDuration = 3600 * 24 * 30;
      const duration = 3600 * 24 * 365;

      const tx = await vestingManager.connect(owner).createVestingSchedule(
        beneficiary.address,
        amount,
        startTime,
        cliffDuration,
        duration,
        0
      );

      const receipt = await tx.wait();
      const event = receipt?.logs[0];
      scheduleId = event?.topics[1] ? BigInt(event.topics[1]) : BigInt(0);
    });

    it("Should allow vesting admin to revoke schedule", async function () {
     
      await token.mint(await vestingManager.getAddress(), amount);

      await vestingManager.connect(owner).revokeSchedule(scheduleId);
      
      const schedule = await vestingManager.getVestingSchedule(scheduleId);
      expect(schedule.revoked).to.be.true;
    });

    it("Should not allow non-admin to revoke schedule", async function () {
      await expect(
        vestingManager.connect(user).revokeSchedule(scheduleId)
      ).to.be.revertedWithCustomError(vestingManager, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow revoking already revoked schedule", async function () {
      // Mint tokens for first revocation
      await token.mint(await vestingManager.getAddress(), amount);
      await vestingManager.connect(owner).revokeSchedule(scheduleId);
      
      // Mint tokens for second revocation attempt
      await token.mint(await vestingManager.getAddress(), amount);
      await expect(
        vestingManager.connect(owner).revokeSchedule(scheduleId)
      ).to.be.revertedWithCustomError(vestingManager, "ScheduleRevokeed");
    });
  });

  describe("View Functions", function () {
    const amount = ethers.parseEther("1000");
    let scheduleId: bigint;

    beforeEach(async function () {
      // Create a vesting schedule
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const cliffDuration = 3600 * 24 * 30;
      const duration = 3600 * 24 * 365;

      const tx = await vestingManager.connect(owner).createVestingSchedule(
        beneficiary.address,
        amount,
        startTime,
        cliffDuration,
        duration,
        0
      );

      const receipt = await tx.wait();
      const event = receipt?.logs[0];
      scheduleId = event?.topics[1] ? BigInt(event.topics[1]) : BigInt(0);
    });

    it("Should return correct vesting schedule details", async function () {
      const schedule = await vestingManager.getVestingSchedule(scheduleId);
      expect(schedule.beneficiary).to.equal(beneficiary.address);
      expect(schedule.totalAmount).to.equal(amount);
      expect(schedule.revoked).to.be.false;
    });

    it("Should return correct vesting info", async function () {
      const info = await vestingManager.getVestingInfo(scheduleId);
      expect(info.totalAmount).to.equal(amount);
      expect(info.releasedAmount).to.equal(0);
      expect(info.releasableAmount).to.equal(0); // Before cliff
    });

    it("Should return correct schedules for beneficiary", async function () {
      const schedules = await vestingManager.getSchedulesForBeneficiary(beneficiary.address);
      expect(schedules).to.include(scheduleId);
    });
  });

  describe("Pausing", function () {
    it("Should allow admin to pause and unpause", async function () {
      await vestingManager.pause();
      expect(await vestingManager.paused()).to.be.true;

      await vestingManager.unpause();
      expect(await vestingManager.paused()).to.be.false;
    });

    it("Should not allow non-admin to pause", async function () {
      await expect(
        vestingManager.connect(user).pause()
      ).to.be.revertedWithCustomError(vestingManager, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow operations when paused", async function () {
      await vestingManager.pause();
      
      const amount = ethers.parseEther("1000");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const cliffDuration = 3600 * 24 * 30;
      const duration = 3600 * 24 * 365;

      await expect(
        vestingManager.connect(owner).createVestingSchedule(
          beneficiary.address,
          amount,
          startTime,
          cliffDuration,
          duration,
          0
        )
      ).to.be.revertedWithCustomError(vestingManager, "EnforcedPause");
    });
  });
}); 