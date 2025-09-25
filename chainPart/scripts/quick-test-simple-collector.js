const { ethers } = require("hardhat");

async function main() {
    console.log("⚡ SimpleTokenCollector 快速测试");
    
    // 合约地址
    const SIMPLE_COLLECTOR_ADDRESS = "0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E";
    const ESCROW_ADDRESS = "0xc6e7DF5E7b4f2A278906862b61205850344D4e7d";
    
    try {
        // 获取合约实例
        const simpleCollector = await ethers.getContractAt("SimpleTokenCollector", SIMPLE_COLLECTOR_ADDRESS);
        
        // 基础验证
        const escrowAddress = await simpleCollector.escrow();
        const collectorType = await simpleCollector.collectorType();
        
        console.log(`✅ 合约地址: ${SIMPLE_COLLECTOR_ADDRESS}`);
        console.log(`✅ Escrow: ${escrowAddress}`);
        console.log(`✅ 类型: ${collectorType} (0=Payment)`);
        
        // 验证配置
        if (escrowAddress === ESCROW_ADDRESS && collectorType === 0n) {
            console.log("🎉 快速测试通过!");
        } else {
            console.log("❌ 配置错误!");
        }
        
    } catch (error) {
        console.log("❌ 测试失败:", error.message);
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ 错误:", error);
            process.exit(1);
        });
}

module.exports = main;