const { ethers } = require("hardhat");

async function main() {
    console.log("开始部署 EscrowContract...");

    // 获取部署账户
    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);
    console.log("账户余额:", ethers.utils.formatEther(await deployer.getBalance()));

    // 部署参数
    const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3"; // Uniswap Permit2 主网地址
    const CONTRACT_NAME = "EscrowContract";
    const CONTRACT_VERSION = "1.0.0";
    
    // RMBToken 地址 - 如果已部署，请设置此地址
    const RMB_TOKEN_ADDRESS = process.env.RMB_TOKEN_ADDRESS;

    // 获取合约工厂
    const EscrowContract = await ethers.getContractFactory("EscrowContract");

    // 部署合约
    console.log("正在部署合约...");
    const escrowContract = await EscrowContract.deploy(
        deployer.address,  // owner
        PERMIT2_ADDRESS,   // permit2
        CONTRACT_NAME,     // name
        CONTRACT_VERSION   // version
    );

    await escrowContract.deployed();

    console.log("\n=== 部署完成 ===");
    console.log("EscrowContract 地址:", escrowContract.address);
    console.log("部署交易哈希:", escrowContract.deployTransaction.hash);
    console.log("Gas 使用量:", escrowContract.deployTransaction.gasLimit.toString());

    // 验证部署
    console.log("\n=== 验证部署 ===");
    const owner = await escrowContract.owner();
    const permit2 = await escrowContract.permit2();
    console.log("合约所有者:", owner);
    console.log("Permit2 地址:", permit2);

    // 保存部署信息
    const deploymentInfo = {
        network: await ethers.provider.getNetwork(),
        contractAddress: escrowContract.address,
        deployerAddress: deployer.address,
        permit2Address: PERMIT2_ADDRESS,
        deploymentBlock: escrowContract.deployTransaction.blockNumber,
        deploymentHash: escrowContract.deployTransaction.hash,
        timestamp: new Date().toISOString()
    };

    console.log("\n=== 部署信息 ===");
    console.log(JSON.stringify(deploymentInfo, null, 2));

    // 如果提供了 RMBToken 地址，自动配置为支持的代币
    if (RMB_TOKEN_ADDRESS && RMB_TOKEN_ADDRESS !== "") {
        console.log("\n=== 配置 RMBToken 支持 ===");
        console.log("RMBToken 地址:", RMB_TOKEN_ADDRESS);
        
        try {
            // 检查当前支持状态
            const isCurrentlySupported = await escrowContract.isTokenSupported(RMB_TOKEN_ADDRESS);
            console.log("当前支持状态:", isCurrentlySupported);
            
            if (!isCurrentlySupported) {
                console.log("正在设置 RMBToken 为支持的代币...");
                const tx = await escrowContract.setTokenSupport(RMB_TOKEN_ADDRESS, true);
                console.log("交易哈希:", tx.hash);
                
                const receipt = await tx.wait();
                console.log("交易已确认，区块号:", receipt.blockNumber);
                
                // 验证设置结果
                const isNowSupported = await escrowContract.isTokenSupported(RMB_TOKEN_ADDRESS);
                if (isNowSupported) {
                    console.log("✅ 成功设置 RMBToken 为支持的代币!");
                } else {
                    console.log("❌ 设置失败");
                }
            } else {
                console.log("RMBToken 已经被设置为支持的代币");
            }
        } catch (error) {
            console.error("配置 RMBToken 支持时出错:", error.message);
        }
    } else {
        console.log("\n=== 提示 ===");
        console.log("如需配置 RMBToken 为支持的代币，请:");
        console.log("1. 设置环境变量 RMB_TOKEN_ADDRESS");
        console.log("2. 或运行: npx hardhat run scripts/setup-rmb-token.js --network <network>");
    }

    return escrowContract;
}

// 执行部署
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("部署失败:", error);
        process.exit(1);
    });