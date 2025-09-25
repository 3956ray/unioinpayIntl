const { ethers } = require("hardhat");

// 合约地址 (需要根据实际部署地址修改)
const RMB_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const ESCROW_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const MOCK_COLLECTOR_ADDRESS = "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6";

async function main() {
    console.log("☕ === 小明购买咖啡支付演示 ===");
    
    // 获取账户
    const [deployer, xiaoming, coffeeShop, operator] = await ethers.getSigners();
    
    console.log("\n👥 参与角色:");
    console.log("- 小明 (付款人):", xiaoming.address);
    console.log("- 咖啡店 (收款人):", coffeeShop.address);
    console.log("- 运营方:", operator.address);
    
    // 获取合约实例
    const rmbToken = await ethers.getContractAt("RMBToken", RMB_TOKEN_ADDRESS);
    const escrow = await ethers.getContractAt("Escrow", ESCROW_ADDRESS);
    
    // 获取代币精度
    const decimals = await rmbToken.decimals();
    console.log("📋 RMB Token 精度:", decimals.toString());
    
    // 检查小明的余额
    const xiaomingBalance = await rmbToken.balanceOf(xiaoming.address);
    console.log("\n💰 小明当前余额:", ethers.formatUnits(xiaomingBalance, decimals), "RMB");
    
    // 检查deployer余额
    const deployerBalance = await rmbToken.balanceOf(deployer.address);
    console.log("💰 Deployer当前余额:", ethers.formatUnits(deployerBalance, decimals), "RMB");
    
    // 如果余额不足，先铸造一些代币给deployer，然后转给小明
    const requiredAmount = ethers.parseUnits("100", decimals);
    if (xiaomingBalance < ethers.parseUnits("10", decimals)) {
        console.log("💸 余额不足，准备铸造和转账...");
        
        // 先铸造代币给deployer
        if (deployerBalance < requiredAmount) {
            console.log("🏭 铸造 RMB Token 给 Deployer...");
            await rmbToken.connect(deployer).mint(deployer.address, ethers.parseUnits("1000", decimals));
            console.log("✅ 铸造完成");
        }
        
        // 转账给小明
        console.log("💸 给小明转账 RMB Token...");
        await rmbToken.connect(deployer).transfer(xiaoming.address, requiredAmount);
        console.log("✅ 转账完成");
    }
    
    // === 第一步: 生成 PaymentIntent ===
    console.log("\n📋 === 第一步: 生成 PaymentIntent ===");
    
    const currentTime = Math.floor(Date.now() / 1000);
    
    // 构建PaymentInfo结构体
    const paymentInfo = {
        operator: operator.address,
        payer: xiaoming.address,
        receiver: coffeeShop.address,
        token: RMB_TOKEN_ADDRESS,
        maxAmount: ethers.parseUnits("5.05", decimals),  // 5 RMB + 0.05 手续费
        preApprovalExpiry: currentTime + 1800,   // 30分钟
        authorizationExpiry: currentTime + 3600, // 1小时
        refundExpiry: currentTime + 7200,        // 2小时
        minFeeBps: 50,    // 0.5% (50 basis points)
        maxFeeBps: 200,   // 2% (200 basis points)
        feeReceiver: operator.address,  // 运营方收取手续费
        salt: ethers.toBigInt(ethers.randomBytes(32))
    };
    
    // 计算支付哈希
    const paymentHash = await escrow.getHash(paymentInfo);
    
    console.log("✅ PaymentIntent 生成完成:");
    console.log("- 支付哈希:", paymentHash);
    console.log("- 付款人:", paymentInfo.payer);
    console.log("- 收款人:", paymentInfo.receiver);
    console.log("- 运营方:", paymentInfo.operator);
    console.log("- 代币:", paymentInfo.token);
    console.log("- 最大金额:", ethers.formatUnits(paymentInfo.maxAmount, decimals), "RMB");
    console.log("- 手续费范围:", paymentInfo.minFeeBps/100 + "% - " + paymentInfo.maxFeeBps/100 + "%");
    
    // === 第二步: 设置事件监听 ===
    console.log("\n📡 === 设置事件监听 ===");
    
    // 监听支付相关事件
    escrow.on("PaymentAuthorized", (hash, payer, payee, amount, fee, event) => {
        console.log("🔒 支付已预授权:");
        console.log("  - 哈希:", hash);
        console.log("  - 付款人:", payer);
        console.log("  - 收款人:", payee);
        console.log("  - 金额:", ethers.formatUnits(amount, decimals), "RMB");
    });
    
    escrow.on("PaymentCaptured", (hash, capturer, event) => {
        console.log("💰 支付已确认收款:");
        console.log("  - 哈希:", hash);
        console.log("  - 确认人:", capturer);
    });
    
    escrow.on("PaymentCharged", (hash, payer, payee, amount, fee, event) => {
        console.log("⚡ 即时支付完成:");
        console.log("  - 哈希:", hash);
        console.log("  - 付款人:", payer);
        console.log("  - 收款人:", payee);
        console.log("  - 金额:", ethers.formatUnits(amount, decimals), "RMB");
    });
    
    // === 第三步: 选择支付方式 ===
    console.log("\n🔄 === 第三步: 执行支付 ===");
    
    // 方式一: 即时支付 (推荐用于小额支付)
    console.log("\n⚡ 执行即时支付...");
    
    // 1. 授权代币
    console.log("1️⃣ 授权 RMB Token...");
    await rmbToken.connect(xiaoming).approve(ESCROW_ADDRESS, paymentInfo.maxAmount);
    await rmbToken.connect(xiaoming).approve(MOCK_COLLECTOR_ADDRESS, paymentInfo.maxAmount);
    console.log("✅ 已授权", ethers.formatUnits(paymentInfo.maxAmount, decimals), "RMB Token 给 Escrow 和 MockCollector");
    
    // 2. 执行即时支付
    console.log("2️⃣ 执行即时支付...");
    const amount = ethers.parseUnits("5", decimals);
    const feeBps = 100; // 1% 手续费 (100 basis points)
    const chargeTx = await escrow.connect(operator).charge(
        paymentInfo,
        amount,
        MOCK_COLLECTOR_ADDRESS,  // tokenCollector
        "0x",                   // collectorData (空数据)
        feeBps,                 // 手续费百分比
        operator.address        // 手续费接收者
    );
    
    const receipt = await chargeTx.wait();
    console.log("✅ 支付交易确认:", receipt.hash);
    
    // === 第四步: 验证支付结果 ===
    console.log("\n🔍 === 第四步: 验证支付结果 ===");
    
    // 检查各方余额
    const xiaomingNewBalance = await rmbToken.balanceOf(xiaoming.address);
    const coffeeShopBalance = await rmbToken.balanceOf(coffeeShop.address);
    const operatorBalance = await rmbToken.balanceOf(operator.address);
    
    console.log("\n💰 支付后余额:");
    console.log("- 小明:", ethers.formatUnits(xiaomingNewBalance, decimals), "RMB");
    console.log("- 咖啡店:", ethers.formatUnits(coffeeShopBalance, decimals), "RMB");
    console.log("- 运营方:", ethers.formatUnits(operatorBalance, decimals), "RMB");
    
    console.log("\n🎉 === 支付完成! 小明可以享受咖啡了! ===");
    
    // 清理事件监听
    escrow.removeAllListeners();
}

// 演示预授权支付流程
async function demonstrateAuthorizeCapture() {
    console.log("\n🔒 === 预授权支付演示 ===");
    
    const [deployer, xiaoming, coffeeShop, operator] = await ethers.getSigners();
    const rmbToken = await ethers.getContractAt("RMBToken", RMB_TOKEN_ADDRESS);
    const escrow = await ethers.getContractAt("Escrow", ESCROW_ADDRESS);
    
    // 获取代币精度
    const decimals = await rmbToken.decimals();
    
    const currentTime = Math.floor(Date.now() / 1000);
    
    // 构建PaymentInfo结构体
    const paymentInfo = {
        operator: operator.address,
        payer: xiaoming.address,
        receiver: coffeeShop.address,
        token: RMB_TOKEN_ADDRESS,
        maxAmount: ethers.parseUnits("5.05", decimals),
        preApprovalExpiry: currentTime + 1800,
        authorizationExpiry: currentTime + 3600,
        refundExpiry: currentTime + 7200,
        minFeeBps: 50,
        maxFeeBps: 200,
        feeReceiver: operator.address,
        salt: ethers.toBigInt(ethers.randomBytes(32))
    };
    
    const paymentHash = await escrow.getHash(paymentInfo);
    
    // 1. 预授权
    console.log("1️⃣ 执行预授权...");
    const amount = ethers.parseUnits("5", decimals);
    await rmbToken.connect(xiaoming).approve(ESCROW_ADDRESS, paymentInfo.maxAmount);
    await rmbToken.connect(xiaoming).approve(MOCK_COLLECTOR_ADDRESS, paymentInfo.maxAmount);
    
    await escrow.connect(operator).authorize(
        paymentInfo,
        amount,
        MOCK_COLLECTOR_ADDRESS,  // tokenCollector
        "0x"                    // collectorData
    );
    console.log("✅ 预授权完成，资金已锁定");
    
    // 模拟咖啡制作时间
    console.log("☕ 咖啡制作中...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 2. 确认收款
    console.log("2️⃣ 咖啡制作完成，确认收款...");
    const feeBps = 100; // 1% 手续费
    await escrow.connect(operator).capture(
        paymentInfo,
        amount,
        feeBps,
        operator.address
    );
    console.log("✅ 收款确认，资金已转移");
    
    console.log("🎉 预授权支付流程完成!");
}

// 错误处理
main()
    .then(() => {
        console.log("\n✨ 演示完成!");
        // 可选：演示预授权流程
        // return demonstrateAuthorizeCapture();
    })
    .catch((error) => {
        console.error("❌ 演示过程中出现错误:", error);
        process.exitCode = 1;
    });