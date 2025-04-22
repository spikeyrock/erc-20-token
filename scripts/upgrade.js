const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  const XXX = await ethers.getContractFactory("XXX");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, XXX);
  await upgraded.waitForDeployment();
  console.log("XXX upgraded at:", await upgraded.getAddress());
}

main().catch(console.error);
