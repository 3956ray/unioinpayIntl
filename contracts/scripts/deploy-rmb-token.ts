import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("Deploying RMB Token V1...");

  // 获取部署者账户
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // 获取合约工厂
  const RMBTokenV1 = await ethers.getContractFactory("RMBTokenV1");

  // 部署代理合约
  const rmbToken = await upgrades.deployProxy(
    RMBTokenV1,
    [
      deployer.address, // admin
      "RMB Stablecoin", // name
      "RMB"             // symbol
    ],
    {
      initializer: "initialize",
      kind: "uups"
    }
  );

  await rmbToken.waitForDeployment();
  const rmbTokenAddress = await rmbToken.getAddress();
  
  console.log("RMB Token deployed to:", rmbTokenAddress);

  // 设置角色
  console.log("\nSetting up roles...");
  
  // 在实际部署中，这些地址应该是不同的多签钱包或专用账户
  const setupTx = await rmbToken.setupRoles(
    deployer.address, // admin
    deployer.address, // pauser
    deployer.address, // minter
    deployer.address, // blacklister
    deployer.address, // rescuer
    deployer.address, // upgrader
    deployer.address  // burner
  );
  await setupTx.wait();
  
  console.log("Roles setup completed");

  // 设置供应量上限（可选）
  console.log("\nSetting max supply...");
  const maxSupply = ethers.parseUnits("1000000000", 6); // 10亿 RMB，6位小数
  const setMaxSupplyTx = await rmbToken.setMaxSupply(maxSupply);
  await setMaxSupplyTx.wait();
  
  const toggleCapTx = await rmbToken.toggleSupplyCap(true);
  await toggleCapTx.wait();
  
  console.log("Max supply set to:", ethers.formatUnits(maxSupply, 6), "RMB");

  // 铸造初始代币（可选）
  console.log("\nMinting initial tokens...");
  const initialMint = ethers.parseUnits("1000000", 6); // 100万 RMB
  const mintTx = await rmbToken.mint(deployer.address, initialMint);
  await mintTx.wait();
  
  console.log("Minted:", ethers.formatUnits(initialMint, 6), "RMB to", deployer.address);

  // 显示合约信息
  console.log("\n=== Contract Information ===");
  const contractInfo = await rmbToken.getContractInfo();
  console.log("Name:", contractInfo[0]);
  console.log("Symbol:", contractInfo[1]);
  console.log("Decimals:", contractInfo[2]);
  console.log("Total Supply:", ethers.formatUnits(contractInfo[3], 6));
  console.log("Max Supply:", ethers.formatUnits(contractInfo[4], 6));
  console.log("Supply Cap Enabled:", contractInfo[5]);
  console.log("Version:", contractInfo[6]);

  console.log("\n=== Deployment Summary ===");
  console.log("Contract Address:", rmbTokenAddress);
  console.log("Admin:", deployer.address);
  console.log("Deployment completed successfully!");
}

// 错误处理
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });