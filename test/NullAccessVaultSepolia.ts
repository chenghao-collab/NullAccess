import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { NullAccessVault } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("NullAccessVaultSepolia", function () {
  let signers: Signers;
  let vault: NullAccessVault;
  let vaultAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const deployment = await deployments.get("NullAccessVault");
      vaultAddress = deployment.address;
      vault = await ethers.getContractAt("NullAccessVault", deployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("adds a file record and decrypts the key", async function () {
    steps = 8;
    this.timeout(4 * 40000);

    const fileName = `sepolia-demo-${Date.now()}.txt`;
    const encryptedHash = "QmSepoliaEncryptedHash";
    const keyValue = 12345678;

    progress("Encrypting key...");
    const encryptedInput = await fhevm
      .createEncryptedInput(vaultAddress, signers.alice.address)
      .add32(keyValue)
      .encrypt();

    progress(`Calling addFile on ${vaultAddress}...`);
    const tx = await vault
      .connect(signers.alice)
      .addFile(fileName, encryptedHash, encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();

    progress(`Reading file count for ${signers.alice.address}...`);
    const count = await vault.getFileCount(signers.alice.address);
    expect(count).to.be.greaterThan(0);

    const index = Number(count) - 1;
    progress(`Reading file index ${index}...`);
    const record = await vault.getFile(signers.alice.address, index);
    expect(record[0]).to.eq(fileName);

    progress("Decrypting key...");
    const decryptedKey = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      record[2],
      vaultAddress,
      signers.alice,
    );
    progress(`Decrypted key: ${decryptedKey}`);

    expect(decryptedKey).to.eq(keyValue);
  });
});
