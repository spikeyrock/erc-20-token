const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
  const XXX = await ethers.getContractFactory("XXX");
  const proxy = await upgrades.deployProxy(XXX, [], {
    initializer: "initialize",
    kind: "uups",
  });
  await proxy.waitForDeployment();
  console.log("XXX deployed at:", await proxy.getAddress());
}

main().catch(console.error);
