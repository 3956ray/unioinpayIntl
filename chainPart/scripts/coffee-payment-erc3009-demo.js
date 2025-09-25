const { ethers } = require("hardhat");

// 合约地址（从最新的部署获取）
const RMB_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const ESCROW_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const ERC3009_COLLECTOR_ADDRESS = "0x0165878A594ca255338adfa4d48449f69242Eb8F";

async function main() {
    console.log("☕ 开始 ERC3009 咖啡支付演示...");
    console.log("=====================================");
    
    // 获取账户
    const [deployer, xiaoming, coffeeShop, operator] = await ethers.getSigners();
    
    console.log("👤 参与者:");
    console.log("  部署者:", deployer.address);
    console.log("  小明 (付款人):", xiaoming.address);
    console.log("  咖啡店 (收款人):", coffeeShop.address);
    console.log("  操作员:", operator.address);
    console.log("");
    
    // 获取合约实例
    const rmbToken = await ethers.getContractAt("RMBToken", RMB_TOKEN_ADDRESS);
    const escrow = await ethers.getContractAt("Escrow", ESCROW_ADDRESS);
    const erc3009Collector = await ethers.getContractAt("ERC3009PaymentCollector", ERC3009_COLLECTOR_ADDRESS);
    
    console.log("📋 合约地址:");
    console.log("  RMB Token:", RMB_TOKEN_ADDRESS);
    console.log("  Escrow:", ESCROW_ADDRESS);
    console.log("  ERC3009 Collector:", ERC3009_COLLECTOR_ADDRESS);
    console.log("");
    
    // 给小明转一些 RMB 代币用于测试
    console.log("💰 准备测试代币...");
    const transferAmount = ethers.parseUnits("100", 6); // 100 RMB (6位小数)
    await rmbToken.connect(deployer).transfer(xiaoming.address, transferAmount);
    console.log(`✅ 已向小明转账 ${ethers.formatUnits(transferAmount, 6)} RMB`);
    
    // 检查初始余额
    console.log("\n💳 初始余额:");
    const xiaomingBalance = await rmbToken.balanceOf(xiaoming.address);
    const coffeeShopBalance = await rmbToken.balanceOf(coffeeShop.address);
    const operatorBalance = await rmbToken.balanceOf(operator.address);
    
    console.log(`  小明: ${ethers.formatUnits(xiaomingBalance, 6)} RMB`);
    console.log(`  咖啡店: ${ethers.formatUnits(coffeeShopBalance, 6)} RMB`);
    console.log(`  操作员: ${ethers.formatUnits(operatorBalance, 6)} RMB`);
    
    // 创建支付信息
    const coffeePrice = ethers.parseUnits("5", 6); // 5 RMB (6位小数)
    const feeRate = 100; // 1% (100 basis points)
    const maxFeeRate = 500; // 5% 最大费用
    
    const currentTime = Math.floor(Date.now() / 1000);
    const paymentInfo = {
        operator: operator.address,
        payer: xiaoming.address,
        receiver: coffeeShop.address,
        token: RMB_TOKEN_ADDRESS,
        maxAmount: ethers.parseUnits("5.05", 6), // 稍微多一点以覆盖费用
        preApprovalExpiry: currentTime + 3600, // 1小时后过期
        authorizationExpiry: currentTime + 86400, // 24小时后过期
        refundExpiry: currentTime + 604800, // 7天后过期
        minFeeBps: 0,
        maxFeeBps: maxFeeRate,
        feeReceiver: operator.address,
        salt: ethers.toBigInt(ethers.randomBytes(32))
    };
    
    console.log("\n📝 支付信息:");
    console.log(`  咖啡价格: ${ethers.formatUnits(coffeePrice, 6)} RMB`);
    console.log(`  最大授权金额: ${ethers.formatUnits(paymentInfo.maxAmount, 6)} RMB`);
    console.log(`  费用率: ${feeRate / 100}%`);
    
    try {
        // 生成 ERC3009 签名
        console.log("\n🔐 生成 ERC3009 签名...");
        
        // 生成 ERC3009 签名的 nonce (使用 _getHashPayerAgnostic 逻辑)
    // 这个函数计算 keccak256(abi.encode(token, maxAmount, preApprovalExpiry, salt))
    const nonce = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint120", "uint48", "uint256"],
        [paymentInfo.token, paymentInfo.maxAmount, paymentInfo.preApprovalExpiry, paymentInfo.salt]
      )
    );
    
    console.log("  nonce 类型:", typeof nonce);
    console.log("  nonce 值:", nonce);
        console.log("  Nonce:", nonce);
        
        // 获取链ID
        const chainId = await xiaoming.provider.getNetwork().then(n => n.chainId);
        
        // 构建 ERC3009 签名域和类型
        const domain = {
            name: await rmbToken.name(),
            version: "1.0.0",
            chainId: chainId,
            verifyingContract: RMB_TOKEN_ADDRESS
        };
        
        const types = {
            ReceiveWithAuthorization: [
                { name: "from", type: "address" },
                { name: "to", type: "address" },
                { name: "value", type: "uint256" },
                { name: "validAfter", type: "uint256" },
                { name: "validBefore", type: "uint256" },
                { name: "nonce", type: "bytes32" }
            ]
        };
        
        const value = {
            from: xiaoming.address,
            to: ERC3009_COLLECTOR_ADDRESS,
            value: paymentInfo.maxAmount,
            validAfter: 0,
            validBefore: paymentInfo.preApprovalExpiry,
            nonce: nonce  // nonce 已经是十六进制字符串格式
        };
        
        console.log("  签名数据:", value);
        
        // 小明签署 ERC3009 授权
        const signature = await xiaoming.signTypedData(domain, types, value);
        console.log("✅ ERC3009 签名生成成功");
        console.log("  签名:", signature);
        
        // 执行支付授权
        console.log("\n💳 执行支付授权...");
        const authTx = await escrow.connect(operator).authorize(
            paymentInfo,
            coffeePrice,
            ERC3009_COLLECTOR_ADDRESS,
            signature
        );
        
        await authTx.wait();
        console.log("✅ 支付授权成功");
        console.log("  交易哈希:", authTx.hash);
        
        // 执行支付收款
        console.log("\n💰 执行支付收款...");
        const captureTx = await escrow.connect(operator).capture(
            paymentInfo,
            coffeePrice,
            feeRate,
            operator.address
        );
        
        await captureTx.wait();
        console.log("✅ 支付收款成功");
        console.log("  交易哈希:", captureTx.hash);
        
        // 检查最终余额
        console.log("\n💳 最终余额:");
        const finalXiaomingBalance = await rmbToken.balanceOf(xiaoming.address);
        const finalCoffeeShopBalance = await rmbToken.balanceOf(coffeeShop.address);
        const finalOperatorBalance = await rmbToken.balanceOf(operator.address);
        
        console.log(`  小明: ${ethers.formatUnits(finalXiaomingBalance, 6)} RMB`);
        console.log(`  咖啡店: ${ethers.formatUnits(finalCoffeeShopBalance, 6)} RMB`);
        console.log(`  操作员: ${ethers.formatUnits(finalOperatorBalance, 6)} RMB`);
        
        // 计算变化
        const xiaomingChange = finalXiaomingBalance - xiaomingBalance;
        const coffeeShopChange = finalCoffeeShopBalance - coffeeShopBalance;
        const operatorChange = finalOperatorBalance - operatorBalance;
        
        console.log("\n📊 余额变化:");
        console.log(`  小明: ${ethers.formatUnits(xiaomingChange, 6)} RMB`);
        console.log(`  咖啡店: ${ethers.formatUnits(coffeeShopChange, 6)} RMB`);
        console.log(`  操作员: ${ethers.formatUnits(operatorChange, 6)} RMB`);
        
        // 验证支付结果
        const expectedFee = (coffeePrice * BigInt(feeRate)) / BigInt(10000);
        const expectedCoffeeShopIncome = coffeePrice - expectedFee;
        
        console.log("\n✅ 支付验证:");
        console.log(`  预期咖啡店收入: ${ethers.formatUnits(expectedCoffeeShopIncome, 6)} RMB`);
        console.log(`  实际咖啡店收入: ${ethers.formatUnits(coffeeShopChange, 6)} RMB`);
        console.log(`  预期操作员费用: ${ethers.formatUnits(expectedFee, 6)} RMB`);
        console.log(`  实际操作员费用: ${ethers.formatUnits(operatorChange, 6)} RMB`);
        
        if (coffeeShopChange === expectedCoffeeShopIncome && operatorChange === expectedFee) {
            console.log("🎉 ERC3009 咖啡支付演示成功完成！");
        } else {
            console.log("❌ 支付金额验证失败");
        }
        
    } catch (error) {
        console.error("❌ 支付过程中发生错误:", error.message);
        
        // 提供调试信息
        if (error.message.includes("authorization")) {
            console.log("\n💡 可能的问题:");
            console.log("1. ERC3009 签名格式不正确");
            console.log("2. nonce 已被使用");
            console.log("3. 签名过期");
            console.log("4. 授权金额不足");
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