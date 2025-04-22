/**
 * Script to verify the implementation contract on Basescan
 * 
 * Run with: npx hardhat run scripts/verify.ts --network base_goerli
 */

import { upgrades } from "hardhat";
import "dotenv/config";

async function main(): Promise<void> {
  // Get the proxy address from environment
  const proxyAddress = process.env.PROXY_ADDRESS;
  
  if (!proxyAddress) {
    throw new Error("Missing PROXY_ADDRESS in .env file");
  }
  
  console.log("Getting implementation address for proxy:", proxyAddress);
  
  // Get the implementation address from the proxy
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("Implementation address:", implementationAddress);
  
  console.log("\nTo verify the implementation contract on Basescan, run:");
  console.log(`npx hardhat verify --network base_goerli ${implementationAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error("Failed to get implementation address:", error);
    process.exit(1);
  });