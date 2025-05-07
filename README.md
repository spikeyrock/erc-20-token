# XXX Token System

This project implements a comprehensive token system for the XXX ecosystem on the Base network with a 3-contract architecture:

1. **XXXToken** - Core ERC20 Token contract
2. **XXXTokenVault** - Token Treasury & Allocation Manager
3. **XXXVestingManager** - Vesting, Locking, and Claiming

## Project Structure

```
ttn-token/
├── contracts/         # Smart contract source files
│   ├── XXXToken.sol        # Core ERC20 Token
│   ├── XXXTokenVault.sol      # Treasury & Allocation Manager
│   └── XXXVestingManager.sol  # Vesting & Locking Manager
├── scripts/           # Deployment and upgrade scripts
├── deployments/       # Deployment artifacts
├── .env.example       # Example environment configuration
├── test               # Test files
├── hardhat.config.ts  # Hardhat configuration
└── README.md          # Project documentation
```

## Key Features

The XXX token system implements the following features:

- **3-Contract Architecture**:
  - **XXXToken**: Core ERC20 with minting, burning, pausing, and upgradeability
  - **XXXTokenVault**: Manages token allocations, airdrops, and minting control
  - **XXXVestingManager**: Handles vesting schedules, locking, unlocking, and claims

- **Upgradeable Architecture**: All contracts use the UUPS (Universal Upgradeable Proxy Standard) pattern for future upgrades

- **On-Demand Minting with Hard Cap**: Maximum supply is capped at 1 billion tokens, minted only as needed for allocations

- **Flexible Vesting and Locking**: Custom unlock patterns including cliff periods, linear releases, and milestone-based unlocks

- **Airdrop Functionality**: Batch-allocate tokens to multiple addresses for airdrops.

- **Manual Unlocking**: Perform early unlocks when needed (e.g., exchange listings).

- **Allocation Revocation**: Revoke part or all of locked allocations when needed

- **On-Chain Visibility**: Transparent vesting schedules with query functions for beneficiaries

- **Emergency Controls**: Pause transfers, vault operations, and vesting claims in case of security issues

## Pre-requisites

- Node.js v18+
- npm or yarn
- A wallet with ETH/BASE for contract deployment

## Setup

1. Clone the repository:
```shell
git clone https://github.com/spikeyrock/ttn-token.git
cd ttn-token
```

2. Install dependencies:
```shell
npm install
```

3. Create a `.env` file based on `.env.example`:
```shell
cp .env.example .env
```

4. Configure your `.env` file with:
   - Your wallet's private key
   - RPC URLs
   - Etherscan API key for verification

## Compilation

Compile the smart contracts:

```shell
npx hardhat compile
```

## Testing

Run tests to verify contract functionality:

```shell
npm test
```

## Deployment

Deploy the complete token system to Base Goerli testnet:

```shell
npm run deploy
```

After deployment:
1. Save the proxy addresses in your `.env` file for future upgrades
2. Verify the implementation contracts on Basescan

## Upgrading

To upgrade contract implementations:

1. Make changes to the contract(s) you want to upgrade
2. Update your `.env` file with the proxy addresses
3. Run the upgrade script, specifying which contract to upgrade:

```shell
# Upgrade a specific contract (token, vault, or vesting)
npm run upgrade -- token
npm run upgrade -- vault
npm run upgrade -- vesting

# Or upgrade all contracts
npm run upgrade -- all
```

## Contract Verification

Verify your contracts on Basescan (after deployment):

```shell
# Get all implementation addresses and verification commands
npx hardhat run scripts/verify.ts --network base_goerli

# Then run the verification command for each implementation
npx hardhat verify --network base_goerli IMPLEMENTATION_ADDRESS
```

## Token Lifecycle

1. **Initial Deployment**: Contracts deployed without pre-minting the supply
2. **Allocation and Vesting**: Tokens minted on-demand through the vault
3. **Locking**: Allocated tokens locked under specific vesting schedules
4. **Unlocking and Claiming**: Tokens unlock over time and can be claimed by beneficiaries
5. **Revocations (if needed)**: Admins can revoke unvested portions if required
6. **Visibility and Tracking**: Beneficiaries can query their schedules and balances

## Security Considerations

- Admin roles should be managed carefully
- Consider using multisig wallets for admin operations
- Test thoroughly before deploying to mainnet
- Consider a security audit before mainnet deployment

## License

This project is licensed under the MIT License.