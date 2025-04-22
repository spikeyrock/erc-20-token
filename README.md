# TTN Token - ERC20 Upgradeable Token

This project implements an upgradeable ERC20 token on the Base network with multiple functionalities:

- ERC20 standard implementation
- Fixed maximum supply (1 billion tokens)
- Pausable operations
- Role-based access control 
- Burnable tokens
- Upgradeable contract (UUPS pattern)

## Project Structure

```
ttn-token/
├── contracts/         # Smart contract source files
├── scripts/           # Deployment and upgrade scripts
├── .env.example       # Example environment configuration
├── hardhat.config.ts  # Hardhat configuration
└── README.md          # Project documentation
```

## Features

The TTN token implements the following features:

- **Upgradeable Contract**: Uses the UUPS (Universal Upgradeable Proxy Standard) pattern for future upgrades
- **Access Control**: Implements role-based permissions for administrative functions
- **Capped Supply**: Maximum supply is capped at 1 billion tokens
- **Pausable**: Token transfers can be paused in emergency situations
- **Burnable**: Tokens can be burned to reduce supply

## Pre-requisites

- Node.js v18+
- npm or yarn
- A wallet with ETH/BASE for contract deployment

## Setup

1. Clone the repository:
```shell
git clone https://github.com/spikeyrock/erc-20-token.git
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

Deploy the contract to Base Goerli testnet:

```shell
npm run deploy
```

After deployment, save the proxy address in your `.env` file for future upgrades.

## Upgrading

To upgrade the contract implementation:

1. Make changes to the TTN.sol contract
2. Update your `.env` file with the proxy address
3. Run the upgrade script:

```shell
npm run upgrade
```

## Contract Verification

Verify your contract on Basescan (after deployment):

```shell
npx hardhat verify --network base_goerli IMPLEMENTATION_ADDRESS
```

Replace `IMPLEMENTATION_ADDRESS` with the actual implementation address (not the proxy address).

## Security Considerations

- Admin roles should be managed carefully
- Consider using multisig wallets for admin operations
- Test thoroughly before deploying to mainnet
- Consider a security audit before mainnet deployment

## License

This project is licensed under the MIT License.
