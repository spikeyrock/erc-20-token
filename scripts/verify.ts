/**
 * Script to verify the implementation contracts on Basescan
 * 
 * Run with: npx hardhat run scripts/verify.ts --network base_goerli
 */

import { upgrades } from "hardhat";
import "dotenv/config";

async function main(): Promise<void> {
  console.log("Getting implementation addresses for deployed proxies...");
  console.log("-------------------------------------------");
  
  // Get proxy addresses from environment
  const ttnTokenProxy = process.env.XXX_TOKEN_PROXY;
  const tokenVaultProxy = process.env.TOKEN_VAULT_PROXY;
  const vestingManagerProxy = process.env.VESTING_MANAGER_PROXY;
  
  const missingAddresses = [];
  if (!ttnTokenProxy) missingAddresses.push("XXX_TOKEN_PROXY");
  if (!tokenVaultProxy) missingAddresses.push("TOKEN_VAULT_PROXY");
  if (!vestingManagerProxy) missingAddresses.push("VESTING_MANAGER_PROXY");
  
  if (missingAddresses.length > 0) {
    console.warn(`Warning: Missing the following proxy addresses in .env file: ${missingAddresses.join(", ")}`);
    console.warn("Some verification commands may not be available.");
  }
  
  console.log("Implementation addresses for proxies:");
  
  // Get implementation addresses for each proxy
  if (ttnTokenProxy) {
    try {
      const ttnTokenImplementation = await upgrades.erc1967.getImplementationAddress(ttnTokenProxy);
      console.log(`XXXToken Implementation: ${ttnTokenImplementation}`);
      console.log(`Verification command: npx hardhat verify --network base_goerli ${ttnTokenImplementation}`);
      console.log("-------------------------------------------");
    } catch (error) {
      console.error(`Error getting XXXToken implementation: ${error}`);
    }
  }
  
  if (tokenVaultProxy) {
    try {
      const tokenVaultImplementation = await upgrades.erc1967.getImplementationAddress(tokenVaultProxy);
      console.log(`TokenVault Implementation: ${tokenVaultImplementation}`);
      console.log(`Verification command: npx hardhat verify --network base_goerli ${tokenVaultImplementation}`);
      console.log("-------------------------------------------");
    } catch (error) {
      console.error(`Error getting TokenVault implementation: ${error}`);
    }
  }
  
  if (vestingManagerProxy) {
    try {
      const vestingManagerImplementation = await upgrades.erc1967.getImplementationAddress(vestingManagerProxy);
      console.log(`VestingManager Implementation: ${vestingManagerImplementation}`);
      console.log(`Verification command: npx hardhat verify --network base_goerli ${vestingManagerImplementation}`);
      console.log("-------------------------------------------");
    } catch (error) {
      console.error(`Error getting VestingManager implementation: ${error}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error("Failed to get implementation addresses:", error);
    process.exit(1);
  });