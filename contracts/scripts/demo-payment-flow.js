const { ethers } = require("hardhat");
const { parseUnits, formatUnits } = ethers.utils;

async function main() {
    console.log("=== EscrowContract 与 RMBToken 支付流程演示 ===");
    
    // 获取账户
    const [owner, merchant, customer] = await ethers.getSigners();
    console.log("\n=== 账户信息 ===");
    console.log(`所有者: ${owner.address}`);
    console.log(`商家: ${merchant.address}`);
    console.log(`客户: ${customer.address}`);
    
    // 连接到已部署的合约
    const escrowAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    const rmbTokenAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
    
    const EscrowContract = await ethers.getContractFactory("EscrowContract");
    const RMBToken = await ethers.getContractFactory("RMBToken");
    
    const escrow = EscrowContract.attach(escrowAddress);
    const rmbToken = RMBToken.attach(rmbTokenAddress);
    
    console.log(`\n=== 合约地址 ===`);
    console.log(`EscrowContract: ${escrowAddress}`);
    console.log(`RMBToken: ${rmbTokenAddress}`);
    
    // 检查代币支持状态
    const isSupported = await escrow.isTokenSupported(rmbTokenAddress);
    console.log(`\n=== 代币支持状态 ===`);
    console.log(`RMBToken 是否被支持: ${isSupported}`);
    
    if (!isSupported) {
        console.log("正在设置 RMBToken 支持...");
        const tx = await escrow.setTokenSupport(rmbTokenAddress, true);
        await tx.wait();
        console.log("✅ RMBToken 支持已设置");
    }
    
    // 为客户铸造一些代币
    console.log(`\n=== 准备测试代币 ===`);
    const mintAmount = parseUnits("1000", 6); // 1000 RMB
    
    // 检查客户是否已经有代币
    let customerBalance = await rmbToken.balanceOf(customer.address);
    console.log(`客户当前余额: ${formatUnits(customerBalance, 6)} RMB`);
    
    if (customerBalance.eq(0)) {
        console.log("正在为客户铸造代币...");
        const mintTx = await rmbToken.mint(customer.address, mintAmount);
        await mintTx.wait();
        customerBalance = await rmbToken.balanceOf(customer.address);
        console.log(`✅ 已为客户铸造 ${formatUnits(mintAmount, 6)} RMB`);
    }
    
    // 注册商家为操作员
    console.log(`\n=== 注册商家为操作员 ===`);
    const isMerchantOperator = await escrow.isOperator(merchant.address);
    if (!isMerchantOperator) {
        console.log("正在注册商家为操作员...");
        const registerTx = await escrow.registerOperator(merchant.address, "Demo Merchant");
        await registerTx.wait();
        console.log("✅ 商家已注册为操作员");
    } else {
        console.log("商家已经是操作员");
    }
    
    // 模拟支付场景：客户购买商品
    console.log(`\n=== 支付场景演示 ===`);
    const paymentAmount = parseUnits("99.99", 6); // 99.99 RMB
    const orderId = "ORDER-2024-001";
    
    console.log(`订单ID: ${orderId}`);
    console.log(`支付金额: ${formatUnits(paymentAmount, 6)} RMB`);
    console.log(`商家地址: ${merchant.address}`);
    
    // 构造支付意图
    const customerNonce = await escrow.getUserNonce(customer.address);
    const expiryTime = Math.floor(Date.now() / 1000) + 3600; // 1小时后过期
    
    const paymentIntent = {
        payer: customer.address,
        payee: merchant.address,
        token: rmbTokenAddress,
        amount: paymentAmount,
        expiryTime: expiryTime,
        intentHash: ethers.constants.HashZero, // 占位符
        nonce: customerNonce
    };
    
    // 生成支付意图哈希
    const paymentIntentHash = await escrow.generateIntentHash(paymentIntent);
    console.log(`支付意图哈希: ${paymentIntentHash}`);
    
    // 检查托管记录
    const escrowRecord = await escrow.getEscrowRecord(paymentIntentHash);
    console.log(`当前支付状态: ${escrowRecord.status}`);
    
    console.log(`客户nonce: ${customerNonce}`);
    
    // 显示余额信息
    console.log(`\n=== 余额信息 ===`);
    const merchantBalance = await rmbToken.balanceOf(merchant.address);
    console.log(`客户余额: ${formatUnits(customerBalance, 6)} RMB`);
    console.log(`商家余额: ${formatUnits(merchantBalance, 6)} RMB`);
    
    // 检查代币信息
    console.log(`\n=== 代币信息 ===`);
    const tokenName = await rmbToken.name();
    const tokenSymbol = await rmbToken.symbol();
    const tokenDecimals = await rmbToken.decimals();
    const tokenCurrency = await rmbToken.currency();
    const totalSupply = await rmbToken.totalSupply();
    
    console.log(`代币名称: ${tokenName}`);
    console.log(`代币符号: ${tokenSymbol}`);
    console.log(`小数位数: ${tokenDecimals}`);
    console.log(`货币类型: ${tokenCurrency}`);
    console.log(`总供应量: ${formatUnits(totalSupply, 6)} ${tokenSymbol}`);
    
    console.log(`\n=== 演示完成 ===`);
    console.log("✅ 所有合约都已正确部署和配置");
    console.log("✅ RMBToken 已被 EscrowContract 支持");
    console.log("✅ 商家已注册为操作员");
    console.log("✅ 客户拥有足够的代币余额");
    console.log("\n💡 提示: 现在可以使用前端应用或其他脚本来执行完整的支付流程");
    console.log("   包括授权支付、捕获支付和退款等操作。");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("演示过程中发生错误:", error);
        process.exit(1);
    });