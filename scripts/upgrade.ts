/**
 * Upgrade script for XXX Token System
 * 
 * This script upgrades the implementation of the XXX token system's contracts.
 * The proxy addresses must be set in the .env file.
 */

import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import "dotenv/config";
import * as fs from "fs";

enum ContractType {
  XXXToken,
  TokenVault,
  VestingManager
}

async function upgradeContract(contractType: ContractType): Promise<void> {
  let proxyAddress: string | undefined;
  let contractName: string;
  let contractFactory;
  
  // Determine which contract to upgrade
  switch (contractType) {
    case ContractType.XXXToken:
      proxyAddress = process.env.XXX_TOKEN_PROXY;
      contractName = "XXXToken";
      break;
    case ContractType.TokenVault:
      proxyAddress = process.env.TOKEN_VAULT_PROXY;
      contractName = "TokenVault";
      break;
    case ContractType.VestingManager:
      proxyAddress = process.env.VESTING_MANAGER_PROXY;
      contractName = "VestingManager";
      break;
  }
  
  // Validate the proxy address
  if (!proxyAddress) {
    throw new Error(`Missing ${contractName} proxy address in .env file. Please set it to your deployed proxy address.`);
  }
  
  console.log(`Starting upgrade process for ${contractName} at ${proxyAddress}...`);

  // Get the contract factory for the new implementation
  contractFactory = await ethers.getContractFactory(contractName);
  console.log(`Preparing new ${contractName} implementation...`);

  // Deploy the new implementation and upgrade the proxy
  const upgraded = await upgrades.upgradeProxy(proxyAddress, contractFactory);
  
  // Wait for deployment to complete
  await upgraded.waitForDeployment();
  
  // Get the new implementation address
  const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  
  // Log upgrade info
  console.log(`${contractName} upgrade complete!`);
  console.log(`Proxy address (unchanged): ${proxyAddress}`);
  console.log(`New implementation address: ${newImplementationAddress}`);
  
  return;
}

async function main(): Promise<void> {
  console.log("Starting upgrade process for XXX Token System...");
  console.log("-------------------------------------------");
  
  // Ask which contract to upgrade
  const args = process.argv.slice(2);
  let contractToUpgrade = -1;
  
  if (args.length > 0) {
    if (args[0].toLowerCase() === "token" || args[0].toLowerCase() === "ttntoken") {
      contractToUpgrade = ContractType.XXXToken;
    } else if (args[0].toLowerCase() === "vault" || args[0].toLowerCase() === "tokenvault") {
      contractToUpgrade = ContractType.TokenVault;
    } else if (args[0].toLowerCase() === "vesting" || args[0].toLowerCase() === "vestingmanager") {
      contractToUpgrade = ContractType.VestingManager;
    } else if (args[0].toLowerCase() === "all") {
      contractToUpgrade = -1; // Upgrade all
    } else {
      console.log("Invalid contract type. Please specify one of: token, vault, vesting, all");
      process.exit(1);
    }
  } else {
    console.log("No contract type specified. Please specify one of: token, vault, vesting, all");
    process.exit(1);
  }
  
  try {
    if (contractToUpgrade === -1) {
      // Upgrade all contracts
      await upgradeContract(ContractType.XXXToken);
      console.log("-------------------------------------------");
      await upgradeContract(ContractType.TokenVault);
      console.log("-------------------------------------------");
      await upgradeContract(ContractType.VestingManager);
    } else {
      // Upgrade specific contract
      await upgradeContract(contractToUpgrade);
    }
    
    console.log("\n-------------------------------------------");
    console.log("Next steps:");
    console.log("1. Verify the new implementation contract(s) on Basescan");
    console.log("   Command: npx hardhat verify --network base_goerli <IMPLEMENTATION_ADDRESS>");
    console.log("-------------------------------------------");
  } catch (error) {
    console.error("Upgrade failed:", error);
    process.exit(1);
  }
}

// Execute the upgrade
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error("Error:", error);
    process.exit(1);
  });