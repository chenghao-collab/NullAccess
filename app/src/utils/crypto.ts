const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const fromBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const generateFakeIpfsHash = () => {
  const prefix = 'Qm';
  let hash = prefix;
  for (let i = prefix.length; i < 46; i += 1) {
    hash += BASE58_ALPHABET[Math.floor(Math.random() * BASE58_ALPHABET.length)];
  }
  return hash;
};

export const generateKey = () => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return (value[0] % 90000000) + 10000000;
  }
  return Math.floor(10000000 + Math.random() * 90000000);
};

export const encryptIpfsHash = (hash: string, key: number) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(hash);
  const keyBytes = encoder.encode(String(key));
  const output = new Uint8Array(data.length);

  for (let i = 0; i < data.length; i += 1) {
    output[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }

  return toBase64(output);
};

export const decryptIpfsHash = (encryptedHash: string, key: number) => {
  const data = fromBase64(encryptedHash);
  const keyBytes = new TextEncoder().encode(String(key));
  const output = new Uint8Array(data.length);

  for (let i = 0; i < data.length; i += 1) {
    output[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }

  return new TextDecoder().decode(output);
};
