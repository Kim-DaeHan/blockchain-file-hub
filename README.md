# Blockchain File Hub

A decentralized file storage and sharing platform built on blockchain technology.

## Features

- Decentralized file storage
- Secure file sharing
- Blockchain-based verification
- User authentication
- File encryption

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MetaMask wallet

### Installation

1. Clone the repository

```bash
git clone https://github.com/yourusername/blockchain-file-hub.git
cd blockchain-file-hub
```

2. Install dependencies

```bash
npm install
# or
yarn install
```

3. Create a `.env` file in the root directory and add necessary environment variables

```
# Ethereum
PRIVATE_KEY=your_ethereum_private_key
INFURA_PROJECT_ID=your_infura_project_id
CONTRACT_ADDRESS=your_contract_address

# IPFS - Pinata
PINATA_API_KEY=your_pinata_api_key
PINATA_API_SECRET=your_pinata_api_secret  # Only visible once when created, save it securely
IPFS_GATEWAY_URL=https://gateway.pinata.cloud/ipfs/
```

> **Note**: The Pinata API SECRET is only shown once when you create it. Make sure to save it securely as you won't be able to view it again. If lost, you'll need to generate a new API key.

4. Start the development server

```bash
npm start
# or
yarn start
```

## Tech Stack

- React Native
- TypeScript
- Expo
- Smart Contracts (Solidity)
- IPFS for decentralized storage

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

Project Link: [https://github.com/Kim-DaeHan/blockchain-file-hub](https://github.com/Kim-DaeHan/blockchain-file-hub)
