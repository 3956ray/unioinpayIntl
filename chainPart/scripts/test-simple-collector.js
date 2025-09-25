const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 SimpleTokenCollector 功能测试");
    console.log("=====================================");
    
    // 合约地址（需要根据实际部署更新）
    const RMB_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    const ESCROW_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
    const SIMPLE_COLLECTOR_ADDRESS = "0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E"; // 从部署脚本获取
    
    // 获取签名者
    const [deployer, xiaoming, coffeeShop, operator] = await ethers.getSigners();
    
    console.log("👤 参与者:");
    console.log(`  部署者: ${deployer.address}`);
    console.log(`  小明 (付款人): ${xiaoming.address}`);
    console.log(`  咖啡店 (收款人): ${coffeeShop.address}`);
    console.log(`  操作员: ${operator.address}`);
    
    // 获取合约实例
    const rmbToken = await ethers.getContractAt("RMBToken", RMB_TOKEN_ADDRESS);
    const escrow = await ethers.getContractAt("Escrow", ESCROW_ADDRESS);
    const simpleCollector = await ethers.getContractAt("SimpleTokenCollector", SIMPLE_COLLECTOR_ADDRESS);
    
    console.log("\n📋 合约地址:");
    console.log(`  RMB Token: ${RMB_TOKEN_ADDRESS}`);
    console.log(`  Escrow: ${ESCROW_ADDRESS}`);
    console.log(`  SimpleTokenCollector: ${SIMPLE_COLLECTOR_ADDRESS}`);
    
    // 测试 1: 验证合约配置
    console.log("\n🔍 测试 1: 验证合约配置");
    try {
        const escrowAddress = await simpleCollector.escrow();
        const collectorType = await simpleCollector.collectorType();
        
        console.log(`  ✅ Escrow 地址: ${escrowAddress}`);
        console.log(`  ✅ 收集器类型: ${collectorType} (0=Payment, 1=Refund)`);
        
        if (escrowAddress !== ESCROW_ADDRESS) {
            throw new Error(`Escrow 地址不匹配: 期望 ${ESCROW_ADDRESS}, 实际 ${escrowAddress}`);
        }
        
        if (collectorType !== 0n) {
            throw new Error(`收集器类型错误: 期望 0 (Payment), 实际 ${collectorType}`);
        }
        
        console.log("  ✅ 合约配置验证通过");
    } catch (error) {
        console.log("  ❌ 合约配置验证失败:", error.message);
        return;
    }
    
    // 测试 2: 权限控制测试
    console.log("\n🔒 测试 2: 权限控制");
    try {
        // 创建虚拟的 PaymentInfo
        const paymentInfo = {
            operator: operator.address,
            payer: xiaoming.address,
            receiver: coffeeShop.address,
            token: RMB_TOKEN_ADDRESS,
            maxAmount: ethers.parseUnits("10", 6),
            preApprovalExpiry: Math.floor(Date.now() / 1000) + 3600,
            authorizationExpiry: Math.floor(Date.now() / 1000) + 86400,
            refundExpiry: Math.floor(Date.now() / 1000) + 604800,
            minFeeBps: 0,
            maxFeeBps: 500,
            feeReceiver: operator.address,
            salt: ethers.toBigInt(ethers.randomBytes(32))
        };
        
        const tokenStore = await escrow.getTokenStore(operator.address);
        
        // 尝试直接调用 collectTokens（应该失败）
        try {
            await simpleCollector.connect(xiaoming).collectTokens(
                paymentInfo,
                tokenStore,
                ethers.parseUnits("5", 6),
                "0x"
            );
            console.log("  ❌ 权限控制失败: 非 Escrow 调用者应该被拒绝");
        } catch (error) {
            if (error.message.includes("OnlyEscrow")) {
                console.log("  ✅ 权限控制正常: 非 Escrow 调用被正确拒绝");
            } else {
                console.log("  ⚠️ 权限控制异常:", error.message);
            }
        }
    } catch (error) {
        console.log("  ❌ 权限控制测试失败:", error.message);
    }
    
    // 测试 3: 集成测试（通过 Escrow 调用）
    console.log("\n🔄 测试 3: 集成测试");
    try {
        // 准备测试代币
        console.log("  💰 准备测试代币...");
        const transferAmount = ethers.parseUnits("100", 6);
        await rmbToken.connect(deployer).transfer(xiaoming.address, transferAmount);
        
        // 小明授权代币给 SimpleTokenCollector
        const approveAmount = ethers.parseUnits("10", 6);
        await rmbToken.connect(xiaoming).approve(SIMPLE_COLLECTOR_ADDRESS, approveAmount);
        
        console.log(`  ✅ 已向小明转账 ${ethers.formatUnits(transferAmount, 6)} RMB`);
        console.log(`  ✅ 小明已授权 ${ethers.formatUnits(approveAmount, 6)} RMB 给 SimpleTokenCollector`);
        
        // 检查初始余额
        const xiaomingBalanceBefore = await rmbToken.balanceOf(xiaoming.address);
        const coffeeShopBalanceBefore = await rmbToken.balanceOf(coffeeShop.address);
        const operatorBalanceBefore = await rmbToken.balanceOf(operator.address);
        
        console.log(`  💳 初始余额:`);
        console.log(`    小明: ${ethers.formatUnits(xiaomingBalanceBefore, 6)} RMB`);
        console.log(`    咖啡店: ${ethers.formatUnits(coffeeShopBalanceBefore, 6)} RMB`);
        console.log(`    操作员: ${ethers.formatUnits(operatorBalanceBefore, 6)} RMB`);
        
        // 创建支付信息
        const paymentAmount = ethers.parseUnits("5", 6);
        const currentTime = Math.floor(Date.now() / 1000);
        const paymentInfo = {
            operator: operator.address,
            payer: xiaoming.address,
            receiver: coffeeShop.address,
            token: RMB_TOKEN_ADDRESS,
            maxAmount: paymentAmount,
            preApprovalExpiry: currentTime + 3600,
            authorizationExpiry: currentTime + 86400,
            refundExpiry: currentTime + 604800,
            minFeeBps: 0,
            maxFeeBps: 500,
            feeReceiver: operator.address,
            salt: ethers.toBigInt(ethers.randomBytes(32))
        };
        
        // 执行即时支付（charge）
        console.log("  💳 执行即时支付...");
        const feeRate = 100; // 1%
        await escrow.connect(operator).charge(
            paymentInfo,
            paymentAmount,
            SIMPLE_COLLECTOR_ADDRESS,
            "0x", // 空的 collectorData
            feeRate,
            operator.address
        );
        
        // 检查最终余额
        const xiaomingBalanceAfter = await rmbToken.balanceOf(xiaoming.address);
        const coffeeShopBalanceAfter = await rmbToken.balanceOf(coffeeShop.address);
        const operatorBalanceAfter = await rmbToken.balanceOf(operator.address);
        
        console.log(`  💳 最终余额:`);
        console.log(`    小明: ${ethers.formatUnits(xiaomingBalanceAfter, 6)} RMB`);
        console.log(`    咖啡店: ${ethers.formatUnits(coffeeShopBalanceAfter, 6)} RMB`);
        console.log(`    操作员: ${ethers.formatUnits(operatorBalanceAfter, 6)} RMB`);
        
        // 验证余额变化
        const xiaomingChange = xiaomingBalanceAfter - xiaomingBalanceBefore;
        const coffeeShopChange = coffeeShopBalanceAfter - coffeeShopBalanceBefore;
        const operatorChange = operatorBalanceAfter - operatorBalanceBefore;
        
        console.log(`  📊 余额变化:`);
        console.log(`    小明: ${ethers.formatUnits(xiaomingChange, 6)} RMB`);
        console.log(`    咖啡店: ${ethers.formatUnits(coffeeShopChange, 6)} RMB`);
        console.log(`    操作员: ${ethers.formatUnits(operatorChange, 6)} RMB`);
        
        // 计算预期值
        const feeAmount = (paymentAmount * BigInt(feeRate)) / 10000n;
        const netAmount = paymentAmount - feeAmount;
        
        if (xiaomingChange === -paymentAmount && 
            coffeeShopChange === netAmount && 
            operatorChange === feeAmount) {
            console.log("  ✅ 集成测试通过: 余额变化符合预期");
        } else {
            console.log("  ❌ 集成测试失败: 余额变化不符合预期");
            console.log(`    预期小明变化: ${ethers.formatUnits(-paymentAmount, 6)} RMB`);
            console.log(`    预期咖啡店变化: ${ethers.formatUnits(netAmount, 6)} RMB`);
            console.log(`    预期操作员变化: ${ethers.formatUnits(feeAmount, 6)} RMB`);
        }
        
    } catch (error) {
        console.log("  ❌ 集成测试失败:", error.message);
    }
    
    console.log("\n🎉 SimpleTokenCollector 功能测试完成!");
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ 测试过程中发生错误:", error);
            process.exit(1);
        });
}

module.exports = main;