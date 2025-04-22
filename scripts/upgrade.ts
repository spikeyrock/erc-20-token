/**
 * Upgrade script for XXX Token
 * 
 * This script upgrades the implementation of an existing XXX token proxy.
 * The PROXY_ADDRESS environment variable must be set in the .env file.
 */

import { ethers, upgrades } from "hardhat";
import "dotenv/config";

async function main(): Promise<void> {
  // Get the proxy address from environment variables
  const proxyAddress = process.env.PROXY_ADDRESS;
  
  // Validate the proxy address
  if (!proxyAddress) {
    throw new Error("Missing PROXY_ADDRESS in .env file. Please set it to your deployed proxy address.");
  }
  
  console.log(`Starting upgrade process for XXX Token at ${proxyAddress}...`);

  // Get the contract factory for the new implementation
  const XXX = await ethers.getContractFactory("XXX");
  console.log("Preparing new implementation...");

  // Deploy the new implementation and upgrade the proxy
  const upgraded = await upgrades.upgradeProxy(proxyAddress, XXX);
  
  // Wait for deployment to complete
  await upgraded.waitForDeployment();
  
  // Get the new implementation address
  const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  
  // Log upgrade info
  console.log("Upgrade complete!");
  console.log("Proxy address (unchanged):", proxyAddress);
  console.log("New implementation address:", newImplementationAddress);
  
  console.log("\n-------------------------------------------");
  console.log("Next steps:");
  console.log("1. Verify the new implementation contract on Basescan");
  console.log(`   Command: npx hardhat verify --network base_goerli ${newImplementationAddress}`);
  console.log("-------------------------------------------\n");
}

// Execute the upgrade
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error("Upgrade failed:", error);
    process.exit(1);
  });