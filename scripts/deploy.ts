/**
 * Deployment script for XXX Token System
 * 
 * This script deploys the XXX token system using the UUPS upgradeable pattern:
 * 1. XXXToken - Core ERC20 Token
 * 2. TokenVault - Token Treasury & Allocation Manager
 * 3. VestingManager - Vesting, Locking, and Claiming
 * 
 * After deployment, the proxy addresses should be stored in the .env file
 * for future upgrades.
 */

import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import "dotenv/config";
import * as fs from "fs";

async function main(): Promise<void> {
  console.log("Starting deployment process for XXX Token System...");
  console.log("-------------------------------------------");

  // Deploy XXXToken
  console.log("1. Deploying XXXToken...");
  const XXXToken = await ethers.getContractFactory("XXXToken");
  const ttnToken = await upgrades.deployProxy(XXXToken, [], {
    initializer: "initialize",
    kind: "uups",
  });
  await ttnToken.waitForDeployment();
  const ttnTokenAddress = await ttnToken.getAddress();
  console.log(`   XXXToken deployed to: ${ttnTokenAddress}`);
  
  // Deploy TokenVault
  console.log("2. Deploying TokenVault...");
  const TokenVault = await ethers.getContractFactory("TokenVault");
  const tokenVault = await upgrades.deployProxy(TokenVault, [ttnTokenAddress], {
    initializer: "initialize",
    kind: "uups",
  });
  await tokenVault.waitForDeployment();
  const tokenVaultAddress = await tokenVault.getAddress();
  console.log(`   TokenVault deployed to: ${tokenVaultAddress}`);
  
  // Deploy VestingManager
  console.log("3. Deploying VestingManager...");
  const VestingManager = await ethers.getContractFactory("VestingManager");
  const vestingManager = await upgrades.deployProxy(VestingManager, [ttnTokenAddress, tokenVaultAddress], {
    initializer: "initialize",
    kind: "uups",
  });
  await vestingManager.waitForDeployment();
  const vestingManagerAddress = await vestingManager.getAddress();
  console.log(`   VestingManager deployed to: ${vestingManagerAddress}`);
  
  // Setup TokenVault to use VestingManager
  console.log("4. Connecting TokenVault to VestingManager...");
  const setVestingTx = await tokenVault.setVestingManager(vestingManagerAddress);
  await setVestingTx.wait();
  console.log(`   VestingManager set in TokenVault`);
  
  // Grant MINTER_ROLE to TokenVault
  console.log("5. Assigning roles...");
  
  // Get the bytes32 representation of the MINTER_ROLE
  const MINTER_ROLE = await ttnToken.MINTER_ROLE();
  
  // Grant MINTER_ROLE to TokenVault
  const grantMinterRoleTx = await ttnToken.grantRole(MINTER_ROLE, tokenVaultAddress);
  await grantMinterRoleTx.wait();
  console.log(`   Granted MINTER_ROLE to TokenVault`);
  
  // Get implementation addresses for verification
  const ttnTokenImplementation = await upgrades.erc1967.getImplementationAddress(ttnTokenAddress);
  const tokenVaultImplementation = await upgrades.erc1967.getImplementationAddress(tokenVaultAddress);
  const vestingManagerImplementation = await upgrades.erc1967.getImplementationAddress(vestingManagerAddress);
  
  // Save deployment addresses to a file
  const deploymentData = {
    ttnToken: {
      proxy: ttnTokenAddress,
      implementation: ttnTokenImplementation
    },
    tokenVault: {
      proxy: tokenVaultAddress,
      implementation: tokenVaultImplementation
    },
    vestingManager: {
      proxy: vestingManagerAddress,
      implementation: vestingManagerImplementation
    },
    network: process.env.HARDHAT_NETWORK || "unknown",
    timestamp: new Date().toISOString()
  };
  
  // Create deployments directory if it doesn't exist
  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
  }
  
  // Save deployment info to file
  fs.writeFileSync(
    `./deployments/deployment_${deploymentData.network}_${Date.now()}.json`, 
    JSON.stringify(deploymentData, null, 2)
  );
  
  console.log("\n-------------------------------------------");
  console.log("Deployment Summary:");
  console.log(`XXXToken Proxy: ${ttnTokenAddress}`);
  console.log(`XXXToken Implementation: ${ttnTokenImplementation}`);
  console.log(`TokenVault Proxy: ${tokenVaultAddress}`);
  console.log(`TokenVault Implementation: ${tokenVaultImplementation}`);
  console.log(`VestingManager Proxy: ${vestingManagerAddress}`);
  console.log(`VestingManager Implementation: ${vestingManagerImplementation}`);
  console.log("-------------------------------------------\n");
  
  console.log("Next steps:");
  console.log("1. Add these proxy addresses to your .env file:");
  console.log(`   XXX_TOKEN_PROXY=${ttnTokenAddress}`);
  console.log(`   TOKEN_VAULT_PROXY=${tokenVaultAddress}`);
  console.log(`   VESTING_MANAGER_PROXY=${vestingManagerAddress}`);
  console.log("2. Verify the implementation contracts on Basescan:");
  console.log(`   npx hardhat verify --network base_goerli ${ttnTokenImplementation}`);
  console.log(`   npx hardhat verify --network base_goerli ${tokenVaultImplementation}`);
  console.log(`   npx hardhat verify --network base_goerli ${vestingManagerImplementation}`);
  console.log("-------------------------------------------");
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });