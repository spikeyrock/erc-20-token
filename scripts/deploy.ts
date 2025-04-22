/**
 * Deployment script for TTN Token
 * 
 * This script deploys the TTN token using the UUPS upgradeable pattern.
 * After deployment, the proxy address should be stored in the .env file
 * for future upgrades.
 */

import { ethers, upgrades } from "hardhat";
import "dotenv/config";

async function main(): Promise<void> {
  console.log("Starting deployment process for TTN Token...");

  // Get the contract factory
  const TTN = await ethers.getContractFactory("TTN");
  console.log("Deploying TTN token and proxy...");

  // Deploy the proxy with the implementation and initialize it
  const proxy = await upgrades.deployProxy(TTN, [], {
    initializer: "initialize",
    kind: "uups", // Using UUPS proxy pattern
  });

  // Wait for deployment to complete
  await proxy.waitForDeployment();
  
  // Get the deployment address
  const proxyAddress = await proxy.getAddress();
  
  // Log deployment info
  console.log("TTN Proxy deployed to:", proxyAddress);
  console.log("Owner:", await proxy.owner());
  console.log("Total Supply:", (await proxy.totalSupply()).toString());
  
  // Get the implementation address for verification
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("Implementation address:", implementationAddress);
  
  console.log("\n-------------------------------------------");
  console.log("Next steps:");
  console.log("1. Add this proxy address to your .env file: PROXY_ADDRESS=" + proxyAddress);
  console.log("2. Verify the implementation contract on Basescan");
  console.log(`   Command: npx hardhat verify --network base_goerli ${implementationAddress}`);
  console.log("-------------------------------------------\n");
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });