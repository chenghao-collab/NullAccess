import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedVault = await deploy("NullAccessVault", {
    from: deployer,
    log: true,
  });

  console.log(`NullAccessVault contract: `, deployedVault.address);
};
export default func;
func.id = "deploy_nullAccessVault"; // id required to prevent reexecution
func.tags = ["NullAccessVault"];
