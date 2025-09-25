const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 开始部署 ERC3009PaymentCollector...");
    
    // 获取部署者账户
    const [deployer] = await ethers.getSigners();
    console.log("📝 部署者地址:", deployer.address);
    
    // 获取余额
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 部署者余额:", ethers.formatEther(balance), "ETH");

    // 设置 Escrow 地址（需要先部署 Escrow）
    const ESCROW_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"; // 从最新的部署获取
    
    // Multicall3 地址 - 在大多数网络上都是相同的地址
    // 对于本地测试，我们可以使用一个模拟地址或部署一个简单的实现
    const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11"; // 标准 Multicall3 地址
    
    console.log("🏗️  Escrow 地址:", ESCROW_ADDRESS);
    console.log("🔗 Multicall3 地址:", MULTICALL3_ADDRESS);

    try {
        // 获取合约工厂
        const ERC3009PaymentCollector = await ethers.getContractFactory("ERC3009PaymentCollector");
        
        // 部署合约
        console.log("⏳ 正在部署 ERC3009PaymentCollector...");
        const erc3009Collector = await ERC3009PaymentCollector.deploy(
            ESCROW_ADDRESS,
            MULTICALL3_ADDRESS
        );
        
        await erc3009Collector.waitForDeployment();
        
        console.log("✅ ERC3009PaymentCollector 部署成功!");
        console.log("📍 合约地址:", await erc3009Collector.getAddress());
        
        // 验证部署
        console.log("\n🔍 验证部署...");
        const escrowAddress = await erc3009Collector.escrow();
        const multicall3Address = await erc3009Collector.multicall3();
        const collectorType = await erc3009Collector.collectorType();
        
        console.log("✅ 关联的 Escrow 地址:", escrowAddress);
        console.log("✅ 关联的 Multicall3 地址:", multicall3Address);
        console.log("✅ 收集器类型:", collectorType.toString()); // 0 = Payment
        
        // 验证地址是否正确
        if (escrowAddress.toLowerCase() === ESCROW_ADDRESS.toLowerCase()) {
            console.log("✅ Escrow 地址验证通过");
        } else {
            console.log("❌ Escrow 地址验证失败");
        }
        
        if (multicall3Address.toLowerCase() === MULTICALL3_ADDRESS.toLowerCase()) {
            console.log("✅ Multicall3 地址验证通过");
        } else {
            console.log("❌ Multicall3 地址验证失败");
        }
        
        const contractAddress = await erc3009Collector.getAddress();
        
        console.log("\n📋 部署摘要:");
        console.log("=====================================");
        console.log("合约名称: ERC3009PaymentCollector");
        console.log("合约地址:", contractAddress);
        console.log("Escrow 地址:", escrowAddress);
        console.log("Multicall3 地址:", multicall3Address);
        console.log("收集器类型: Payment (0)");
        console.log("=====================================");
        
        return contractAddress;
        
    } catch (error) {
        console.error("❌ 部署失败:", error.message);
        
        // 如果是因为 Multicall3 地址问题，提供解决方案
        if (error.message.includes("multicall3") || error.message.includes("Multicall3")) {
            console.log("\n💡 提示: 如果 Multicall3 地址不存在，可以:");
            console.log("1. 使用零地址 (0x0000000000000000000000000000000000000000)");
            console.log("2. 部署一个简单的 Multicall3 实现");
            console.log("3. 修改 ERC6492SignatureHandler 以支持本地测试");
        }
        
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = main;