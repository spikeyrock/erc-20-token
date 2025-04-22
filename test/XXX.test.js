const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("XXX Token", () => {
  it("Should deploy and mint total supply", async () => {
    const XXX = await ethers.getContractFactory("XXX");
    const proxy = await upgrades.deployProxy(XXX, [], { initializer: "initialize", kind: "uups" });

    const [owner] = await ethers.getSigners();
    const totalSupply = await proxy.totalSupply();

    expect(await proxy.balanceOf(owner.address)).to.equal(totalSupply);
  });
});
