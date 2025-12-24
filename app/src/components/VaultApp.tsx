import { useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { Contract } from 'ethers';
import { Header } from './Header';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import {
  decryptIpfsHash,
  encryptIpfsHash,
  generateFakeIpfsHash,
  generateKey,
} from '../utils/crypto';
import '../styles/VaultApp.css';

type FileRecord = {
  index: number;
  fileName: string;
  encryptedIpfsHash: string;
  encryptedKey: string;
  uploadedAt: number;
};

type DecryptedRecord = {
  ipfsHash: string;
  key: number;
};

// const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function VaultApp() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [ipfsHash, setIpfsHash] = useState('');
  const [encryptedHash, setEncryptedHash] = useState('');
  const [keyValue, setKeyValue] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const [files, setFiles] = useState<FileRecord[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [decrypted, setDecrypted] = useState<Record<number, DecryptedRecord>>({});
  const [decryptingIndex, setDecryptingIndex] = useState<number | null>(null);

  const isContractConfigured = true;

  const totalFiles = files.length;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setFileName(file?.name || '');
    setIpfsHash('');
    setEncryptedHash('');
    setKeyValue(null);
    setUploadStatus('');
    setSuccessMessage('');
    setFormError(null);
  };

  const handleMockUpload = async () => {
    if (!selectedFile) {
      setFormError('Select a file before uploading.');
      return;
    }

    setFormError(null);
    setSuccessMessage('');
    setIsUploading(true);
    setUploadStatus('Preparing file for IPFS upload...');

    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      setUploadStatus('Connecting to distributed storage...');
      await new Promise(resolve => setTimeout(resolve, 800));
      setUploadStatus('Generating IPFS hash...');
      await new Promise(resolve => setTimeout(resolve, 600));

      const hash = generateFakeIpfsHash();
      setIpfsHash(hash);
      setUploadStatus('Upload complete. Hash generated locally.');
    } catch (error) {
      setFormError('Failed to generate an IPFS hash.');
      setUploadStatus('');
    } finally {
      setIsUploading(false);
    }
  };

  const handleEncryptAndStore = async () => {
    if (!selectedFile || !fileName || !ipfsHash) {
      setFormError('Upload a file and generate an IPFS hash first.');
      return;
    }
    if (!instance || !address || !signerPromise) {
      setFormError('Connect your wallet and wait for the encryption service.');
      return;
    }
    if (!isContractConfigured) {
      setFormError('Contract address is not configured.');
      return;
    }

    setFormError(null);
    setIsSaving(true);
    setSuccessMessage('');

    try {
      const key = generateKey();
      const encrypted = encryptIpfsHash(ipfsHash, key);
      setKeyValue(key);
      setEncryptedHash(encrypted);

      const encryptedInput = await instance
        .createEncryptedInput(CONTRACT_ADDRESS, address)
        .add32(key)
        .encrypt();

      const signer = await signerPromise;
      const vault = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const tx = await vault.addFile(
        fileName.trim(),
        encrypted,
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );
      await tx.wait();

      setSuccessMessage('File stored on-chain with encrypted access key.');
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Failed to store file:', error);
      setFormError(
        error instanceof Error ? error.message : 'Failed to store the file.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const loadFiles = async () => {
      if (!address || !publicClient || !isContractConfigured) {
        setFiles([]);
        return;
      }

      setFilesLoading(true);
      setFilesError(null);
      try {
        const count = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'getFileCount',
          args: [address],
        });

        const total = Number(count ?? 0);
        const records: FileRecord[] = [];

        for (let i = 0; i < total; i += 1) {
          const result = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getFile',
            args: [address, BigInt(i)],
          });

          const [storedName, storedHash, storedKey, storedAt] = result as [
            string,
            string,
            string,
            bigint
          ];

          records.push({
            index: i,
            fileName: storedName,
            encryptedIpfsHash: storedHash,
            encryptedKey: storedKey,
            uploadedAt: Number(storedAt),
          });
        }

        setFiles(records.reverse());
      } catch (error) {
        console.error('Failed to load files:', error);
        setFilesError('Unable to fetch files from the chain.');
      } finally {
        setFilesLoading(false);
      }
    };

    loadFiles();
  }, [address, publicClient, refreshKey, isContractConfigured]);

  const handleDecrypt = async (record: FileRecord) => {
    if (!instance || !address || !signerPromise) {
      setFilesError('Connect your wallet to decrypt file keys.');
      return;
    }

    setDecryptingIndex(record.index);
    setFilesError(null);

    try {
      const keypair = instance.generateKeypair();
      const handleContractPairs = [
        {
          handle: record.encryptedKey,
          contractAddress: CONTRACT_ADDRESS,
        },
      ];

      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '7';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimeStamp,
        durationDays
      );

      const signer = await signerPromise;
      const signature = await signer.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays
      );

      const decryptedValue = result[record.encryptedKey];
      const resolvedKey = Number(decryptedValue);

      if (!Number.isFinite(resolvedKey)) {
        throw new Error('Failed to decrypt file key.');
      }

      const decryptedHash = decryptIpfsHash(record.encryptedIpfsHash, resolvedKey);

      setDecrypted(prev => ({
        ...prev,
        [record.index]: {
          key: resolvedKey,
          ipfsHash: decryptedHash,
        },
      }));
    } catch (error) {
      console.error('Decryption failed:', error);
      setFilesError(
        error instanceof Error ? error.message : 'Failed to decrypt file key.'
      );
    } finally {
      setDecryptingIndex(null);
    }
  };

  const handleHideDecrypted = (index: number) => {
    setDecrypted(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  return (
    <div className="vault-app">
      <Header />
      <main className="vault-main">
        <section className="hero">
          <div className="hero-content">
            <p className="hero-eyebrow">Encrypted file registry</p>
            <h2>Store file pointers without leaking the hash.</h2>
            <p className="hero-description">
              Upload locally, generate a random 8-digit key, encrypt the IPFS hash
              in the browser, and store only ciphertext on-chain. Decrypt the key
              later with Zama FHE to recover the original hash.
            </p>
            <div className="hero-meta">
              <div className="meta-card">
                <span className="meta-label">Stored files</span>
                <span className="meta-value">{totalFiles}</span>
              </div>
              <div className="meta-card">
                <span className="meta-label">Network</span>
                <span className="meta-value">Sepolia</span>
              </div>
            </div>
            {!isContractConfigured && (
              <div className="alert warning">
                Contract address is not configured. Update it in `app/src/config/contracts.ts`.
              </div>
            )}
          </div>
          <div className="hero-panel">
            <h3>Session status</h3>
            <ul>
              <li>
                <span>Wallet</span>
                <strong>{isConnected ? 'Connected' : 'Not connected'}</strong>
              </li>
              <li>
                <span>Encryption service</span>
                <strong>{zamaLoading ? 'Starting' : zamaError ? 'Unavailable' : 'Ready'}</strong>
              </li>
              <li>
                <span>Storage rule</span>
                <strong>No local storage</strong>
              </li>
            </ul>
          </div>
        </section>

        <section className="vault-grid">
          <div className="panel upload-panel">
            <div className="panel-header">
              <h3>Store a file</h3>
              <p>Generate a hash, encrypt it, and save it on-chain.</p>
            </div>

            <div className="form-group">
              <label>Local file</label>
              <input type="file" onChange={handleFileChange} />
              {selectedFile && (
                <div className="file-meta">
                  <span>{selectedFile.name}</span>
                  <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>File name on-chain</label>
              <input
                type="text"
                value={fileName}
                onChange={event => setFileName(event.target.value)}
                placeholder="Quarterly-report.pdf"
              />
            </div>

            <div className="action-row">
              <button
                className="primary"
                onClick={handleMockUpload}
                disabled={!selectedFile || isUploading}
              >
                {isUploading ? 'Generating hash...' : 'Mock IPFS upload'}
              </button>
              <button
                className="ghost"
                onClick={handleEncryptAndStore}
                disabled={!ipfsHash || isSaving || zamaLoading || !isConnected || !isContractConfigured}
              >
                {isSaving ? 'Saving on-chain...' : 'Encrypt & store'}
              </button>
            </div>

            {uploadStatus && <div className="status">{uploadStatus}</div>}

            {ipfsHash && (
              <div className="detail-card">
                <div>
                  <span>Generated IPFS hash</span>
                  <strong>{ipfsHash}</strong>
                </div>
              </div>
            )}

            {encryptedHash && keyValue !== null && (
              <div className="detail-card">
                <div>
                  <span>Encrypted IPFS hash</span>
                  <strong>{encryptedHash}</strong>
                </div>
                <div>
                  <span>Random key (local)</span>
                  <strong>{keyValue}</strong>
                </div>
              </div>
            )}

            {formError && <div className="alert error">{formError}</div>}
            {successMessage && <div className="alert success">{successMessage}</div>}
          </div>

          <div className="panel list-panel">
            <div className="panel-header">
              <h3>Your encrypted files</h3>
              <p>Decrypt the key to reveal the real IPFS hash.</p>
            </div>

            {filesLoading && <div className="status">Loading files...</div>}
            {!filesLoading && files.length === 0 && (
              <div className="empty-state">
                <p>No files stored yet.</p>
                <span>Upload and store your first file to populate this list.</span>
              </div>
            )}

            {filesError && <div className="alert error">{filesError}</div>}

            <div className="file-list">
              {files.map(record => {
                const decryptedRecord = decrypted[record.index];
                const uploadedAt = record.uploadedAt
                  ? new Date(record.uploadedAt * 1000).toLocaleString()
                  : 'Pending';

                return (
                  <div className="file-card" key={`${record.index}-${record.fileName}`}>
                    <div className="file-card-header">
                      <div>
                        <h4>{record.fileName}</h4>
                        <span>Uploaded {uploadedAt}</span>
                      </div>
                      <button
                        className="ghost small"
                        onClick={() =>
                          decryptedRecord
                            ? handleHideDecrypted(record.index)
                            : handleDecrypt(record)
                        }
                        disabled={decryptingIndex === record.index}
                      >
                        {decryptingIndex === record.index
                          ? 'Decrypting...'
                          : decryptedRecord
                            ? 'Hide'
                            : 'Decrypt'}
                      </button>
                    </div>
                    <div className="file-card-body">
                      <div>
                        <span>Encrypted hash</span>
                        <strong>{record.encryptedIpfsHash}</strong>
                      </div>
                      <div>
                        <span>Encrypted key handle</span>
                        <strong>{record.encryptedKey}</strong>
                      </div>
                      {decryptedRecord && (
                        <div className="decrypted">
                          <div>
                            <span>Decrypted key</span>
                            <strong>{decryptedRecord.key}</strong>
                          </div>
                          <div>
                            <span>Decrypted IPFS hash</span>
                            <strong>{decryptedRecord.ipfsHash}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
