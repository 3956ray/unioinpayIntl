const { ethers } = require("hardhat");

async function main() {
    console.log("部署 SimpleTokenCollector...");
    
    // 获取部署账户
    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);
    
    // Escrow 合约地址（需要根据实际部署更新）
    const ESCROW_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"; // 最新部署的地址
    
    // 部署 SimpleTokenCollector
    const SimpleTokenCollector = await ethers.getContractFactory("SimpleTokenCollector");
    const simpleTokenCollector = await SimpleTokenCollector.deploy(ESCROW_ADDRESS);
    await simpleTokenCollector.waitForDeployment();
    
    const collectorAddress = await simpleTokenCollector.getAddress();
    console.log("✅ SimpleTokenCollector 部署成功!");
    console.log("SimpleTokenCollector 地址:", collectorAddress);
    
    // 验证部署
    console.log("\n--- 验证部署 ---");
    const escrowAddress = await simpleTokenCollector.escrow();
    const collectorType = await simpleTokenCollector.collectorType();
    console.log("关联的 Escrow 地址:", escrowAddress);
    console.log("收集器类型:", collectorType.toString()); // 0 = Payment, 1 = Refund
    
    console.log("部署完成!");
    
    return {
        simpleTokenCollector: collectorAddress
    };
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = main;