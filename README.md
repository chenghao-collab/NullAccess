# NullAccess Vault

NullAccess Vault is a privacy-first file metadata vault. It stores only encrypted pointers on-chain: an IPFS hash encrypted client-side with a random 8-digit key, plus the same key encrypted with Zama FHE so only the owner can decrypt it later.

## Table of Contents

- Project Goals
- Problems Solved
- Solution Summary
- Core Workflow (End-to-End)
- Architecture and Components
- Smart Contract Details
- Frontend Details
- Privacy and Security Model
- Tech Stack
- Repository Structure
- Local Development
- Deployment
- Hardhat Tasks
- Usage Guide
- Configuration Notes
- Limitations
- Future Plan
- License

## Project Goals

- Provide a verifiable on-chain registry of user files without exposing the raw IPFS hash.
- Keep the encryption key private while still allowing the owner to recover it later.
- Make the UX simple: upload, list, decrypt, and retrieve the IPFS hash in one flow.
- Keep the system self-contained with explicit, auditable steps.

## Problems Solved

- On-chain file registries typically leak file identifiers and enable correlation.
- Storing encryption keys off-chain introduces trust and availability risks.
- Users need a secure way to recover encrypted pointers without revealing them publicly.

## Solution Summary

- The file stays local. A pseudo IPFS upload returns a random IPFS-like hash for demo purposes.
- The client generates a random 8-digit key A and encrypts the IPFS hash with A locally.
- The encrypted hash is stored on-chain as plain text, but it is useless without A.
- The key A is encrypted with Zama FHE and stored on-chain as `euint32`.
- Only the owner can decrypt A, then decrypt the IPFS hash and recover the pointer.

## Core Workflow (End-to-End)

1. User selects a local file in the UI; only the file name is used for metadata.
2. A pseudo IPFS upload generates a random hash (no real IPFS upload yet).
3. The client generates a random 8-digit numeric key A.
4. The client encrypts the IPFS hash using A and produces `encryptedIpfsHash`.
5. The client encrypts A with Zama FHE (via the relayer flow) to obtain:
   - `externalEuint32 encryptedKeyInput`
   - `bytes inputProof`
6. The frontend sends `addFile(fileName, encryptedIpfsHash, encryptedKeyInput, inputProof)` using ethers.
7. The contract stores the record and grants FHE access to the owner.
8. The frontend lists records via viem using `getFiles(owner)` or `getFile(owner, index)`.
9. When the user clicks decrypt:
   - The FHE key is decrypted to recover A.
   - The client decrypts the IPFS hash locally and reveals the original hash.

## Architecture and Components

- Smart contract: stores encrypted metadata and timestamps.
- Hardhat tasks: developer tooling for add/read/decrypt flows.
- Frontend app: file selection, pseudo IPFS hash generation, encryption, listing, and decrypt actions.
- Zama relayer integration: encrypts and decrypts the 8-digit key.

## Smart Contract Details

Contract: `contracts/NullAccessVault.sol`

Data model:
- `FileRecord`
  - `fileName`: original file name
  - `encryptedIpfsHash`: client-encrypted hash
  - `encryptedKey`: Zama FHE encrypted 8-digit key
  - `uploadedAt`: block timestamp

Key functions:
- `addFile(fileName, encryptedIpfsHash, encryptedKeyInput, inputProof)`
  - Validates non-empty `fileName` and `encryptedIpfsHash`.
  - Encrypts the key with FHE and stores the record.
  - Grants access to the contract and the sender.
- `getFileCount(owner)` returns the number of files for an owner.
- `getFile(owner, index)` returns a single record.
- `getFiles(owner)` returns all records for an owner.

Important constraint:
- View functions require an explicit `owner` parameter and do not rely on `msg.sender`.

## Frontend Details

Location: `app/`

Responsibilities:
- File selection and file name extraction.
- Pseudo IPFS hash generation (no network upload).
- Client-side encryption of the IPFS hash using the random 8-digit key.
- Zama FHE encryption and decryption of the key.
- Contract reads via viem and writes via ethers.

Frontend constraints (by design):
- No localhost network configuration.
- No localStorage usage.
- No environment variables in the frontend.
- No JSON imports in frontend source.

## Privacy and Security Model

What is private:
- The raw IPFS hash.
- The 8-digit encryption key A.

What is public:
- File name.
- Encrypted IPFS hash (ciphertext).
- Encrypted key (FHE ciphertext).
- Timestamps and transaction metadata.

Threat model notes:
- If the client-side encryption of the IPFS hash is weak, privacy degrades.
- The file name is visible on-chain and should not contain sensitive information.
- This project does not store file contents on-chain or on IPFS.

## Tech Stack

- Smart contracts: Solidity 0.8.x
- Contract framework: Hardhat + hardhat-deploy
- FHE: Zama FHEVM (`@fhevm/solidity` and Hardhat plugin)
- Frontend: React + Vite
- Web3: viem (read), ethers (write)
- Wallet UI: RainbowKit
- Package manager: npm

## Repository Structure

```
.
├── app/                 # React frontend (Vite)
├── contracts/           # Solidity contracts
├── deploy/              # Deployment scripts
├── docs/                # Zama docs used by the project
├── tasks/               # Hardhat tasks
├── test/                # Contract tests
├── hardhat.config.ts    # Hardhat configuration
└── deployments/         # Deployment artifacts and ABI (generated)
```

## Local Development

Prerequisites:
- Node.js 20+
- npm

Install dependencies:
```bash
npm install
```

Compile contracts:
```bash
npm run compile
```

Run tests:
```bash
npm run test
```

Optional local node (for contract-only testing):
```bash
npx hardhat node
```

Note: the frontend targets Sepolia and is intentionally not configured for localhost networks.

## Deployment

Set environment variables for Hardhat (contracts only):
```bash
INFURA_API_KEY=your_infura_key
PRIVATE_KEY=your_private_key
ETHERSCAN_API_KEY=optional_etherscan_key
```

Guidelines:
- Use a private key only. Do not use a mnemonic.
- You can also use Hardhat `vars` if preferred: `npx hardhat vars setup`.

Deploy to Sepolia:
```bash
npx hardhat deploy --network sepolia
```

Verify on Etherscan (optional):
```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

ABI requirement:
- The frontend ABI must be copied from `deployments/sepolia` after each deployment.

## Hardhat Tasks

Print contract address:
```bash
npx hardhat --network sepolia task:address
```

Add a file record (developer flow):
```bash
npx hardhat --network sepolia task:add-file --name demo.txt --hash QmExample --key 12345678
```

Read and decrypt a file record (developer flow):
```bash
npx hardhat --network sepolia task:get-file --owner 0xYourAddress --index 0
```

## Usage Guide

1. Connect a wallet on Sepolia.
2. Select a local file in the UI.
3. The app generates a pseudo IPFS hash and a random 8-digit key.
4. The app encrypts the hash and submits the on-chain record.
5. The file appears in your list with an encrypted hash and timestamp.
6. Click decrypt to recover the key and reveal the original IPFS hash.

## Configuration Notes

- Frontend does not read from environment variables.
- Frontend reads contract state with viem and writes with ethers.
- Zama integration details are documented in:
  - `docs/zama_llm.md`
  - `docs/zama_doc_relayer.md`

## Limitations

- IPFS upload is currently a pseudo upload (random hash only).
- File content is not stored or pinned.
- File names are public and should be treated as non-sensitive metadata.
- Sharing records with other addresses is not implemented.

## Future Plan

- Integrate real IPFS upload and optional pinning services.
- Support sharing with other addresses via re-encryption policies.
- Add search and filtering without revealing plaintext metadata.
- Provide optional file name encryption.
- Add end-to-end UI tests and cross-browser wallet QA.
- Improve key management UX and recovery flows.

## License

BSD-3-Clause-Clear. See `LICENSE`.
