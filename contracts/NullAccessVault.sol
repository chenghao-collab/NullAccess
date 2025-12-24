// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title NullAccessVault
/// @notice Stores file metadata with a client-encrypted IPFS hash and an FHE-encrypted key.
contract NullAccessVault is ZamaEthereumConfig {
    struct FileRecord {
        string fileName;
        string encryptedIpfsHash;
        euint32 encryptedKey;
        uint256 uploadedAt;
    }

    mapping(address => FileRecord[]) private _files;

    event FileAdded(
        address indexed owner,
        uint256 indexed index,
        string fileName,
        string encryptedIpfsHash,
        uint256 uploadedAt
    );

    /// @notice Store a file record for the sender.
    /// @param fileName The original file name.
    /// @param encryptedIpfsHash The IPFS hash encrypted client-side with a random key.
    /// @param encryptedKeyInput The external encrypted random key (8-digit number).
    /// @param inputProof The Zama input proof.
    function addFile(
        string calldata fileName,
        string calldata encryptedIpfsHash,
        externalEuint32 encryptedKeyInput,
        bytes calldata inputProof
    ) external {
        require(bytes(fileName).length > 0, "File name required");
        require(bytes(encryptedIpfsHash).length > 0, "Encrypted hash required");

        euint32 encryptedKey = FHE.fromExternal(encryptedKeyInput, inputProof);

        _files[msg.sender].push(
            FileRecord({
                fileName: fileName,
                encryptedIpfsHash: encryptedIpfsHash,
                encryptedKey: encryptedKey,
                uploadedAt: block.timestamp
            })
        );

        FHE.allowThis(encryptedKey);
        FHE.allow(encryptedKey, msg.sender);

        emit FileAdded(
            msg.sender,
            _files[msg.sender].length - 1,
            fileName,
            encryptedIpfsHash,
            block.timestamp
        );
    }

    /// @notice Returns the number of files stored by an owner.
    /// @param owner The owner address.
    function getFileCount(address owner) external view returns (uint256) {
        return _files[owner].length;
    }

    /// @notice Returns a file record for an owner by index.
    /// @param owner The owner address.
    /// @param index The index in the owner's file list.
    function getFile(address owner, uint256 index) external view returns (string memory, string memory, euint32, uint256) {
        FileRecord storage record = _files[owner][index];
        return (record.fileName, record.encryptedIpfsHash, record.encryptedKey, record.uploadedAt);
    }

    /// @notice Returns all file records for an owner.
    /// @param owner The owner address.
    function getFiles(address owner) external view returns (FileRecord[] memory) {
        return _files[owner];
    }
}
