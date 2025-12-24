import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { NullAccessVault, NullAccessVault__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("NullAccessVault")) as NullAccessVault__factory;
  const vault = (await factory.deploy()) as NullAccessVault;
  const vaultAddress = await vault.getAddress();

  return { vault, vaultAddress };
}

describe("NullAccessVault", function () {
  let signers: Signers;
  let vault: NullAccessVault;
  let vaultAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ vault, vaultAddress } = await deployFixture());
  });

  it("stores file metadata and decrypts the key", async function () {
    const fileName = "report.pdf";
    const encryptedHash = "QmEncryptedHashExample";
    const keyValue = 12345678;

    const encryptedInput = await fhevm
      .createEncryptedInput(vaultAddress, signers.alice.address)
      .add32(keyValue)
      .encrypt();

    const tx = await vault
      .connect(signers.alice)
      .addFile(fileName, encryptedHash, encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();

    const count = await vault.getFileCount(signers.alice.address);
    expect(count).to.eq(1);

    const record = await vault.getFile(signers.alice.address, 0);
    expect(record[0]).to.eq(fileName);
    expect(record[1]).to.eq(encryptedHash);

    const decryptedKey = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      record[2],
      vaultAddress,
      signers.alice,
    );
    expect(decryptedKey).to.eq(keyValue);
  });

  it("returns empty file list for new owners", async function () {
    const count = await vault.getFileCount(signers.deployer.address);
    expect(count).to.eq(0);

    const files = await vault.getFiles(signers.deployer.address);
    expect(files.length).to.eq(0);
  });
});
