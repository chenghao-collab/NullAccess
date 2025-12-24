import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Example:
 *   - npx hardhat --network localhost task:address
 *   - npx hardhat --network sepolia task:address
 */
task("task:address", "Prints the NullAccessVault address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const vault = await deployments.get("NullAccessVault");

  console.log("NullAccessVault address is " + vault.address);
});

/**
 * Example:
 *   - npx hardhat --network localhost task:add-file --name demo.txt --hash QmExample --key 12345678
 */
task("task:add-file", "Adds a file record to NullAccessVault")
  .addParam("name", "The file name")
  .addParam("hash", "The encrypted IPFS hash")
  .addParam("key", "The 8-digit key used to encrypt the IPFS hash")
  .addOptionalParam("address", "Optionally specify the NullAccessVault address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const fileName = taskArguments.name as string;
    const encryptedHash = taskArguments.hash as string;
    const keyValue = parseInt(taskArguments.key);
    if (!Number.isInteger(keyValue)) {
      throw new Error(`Argument --key is not an integer`);
    }

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("NullAccessVault");
    console.log(`NullAccessVault: ${deployment.address}`);

    const signers = await ethers.getSigners();
    const vault = await ethers.getContractAt("NullAccessVault", deployment.address);

    const encryptedInput = await fhevm
      .createEncryptedInput(deployment.address, signers[0].address)
      .add32(keyValue)
      .encrypt();

    const tx = await vault
      .connect(signers[0])
      .addFile(fileName, encryptedHash, encryptedInput.handles[0], encryptedInput.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:get-file --owner 0x... --index 0
 */
task("task:get-file", "Reads a file record and decrypts its key")
  .addParam("owner", "The owner address")
  .addParam("index", "The index in the owner's file list")
  .addOptionalParam("address", "Optionally specify the NullAccessVault address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("NullAccessVault");
    console.log(`NullAccessVault: ${deployment.address}`);

    const signers = await ethers.getSigners();
    const vault = await ethers.getContractAt("NullAccessVault", deployment.address);

    const result = await vault.getFile(taskArguments.owner, taskArguments.index);
    const decryptedKey = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      result[2],
      deployment.address,
      signers[0],
    );

    console.log(`File name      : ${result[0]}`);
    console.log(`Encrypted hash : ${result[1]}`);
    console.log(`Decrypted key  : ${decryptedKey}`);
    console.log(`Uploaded at    : ${new Date(Number(result[3]) * 1000).toISOString()}`);
  });
