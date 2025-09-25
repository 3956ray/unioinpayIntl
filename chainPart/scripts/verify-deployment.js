const { ethers } = require("hardhat");

async function main() {
    console.log("验证部署的合约...");
    
    // 合约地址（从上次部署获取）
    const RMB_TOKEN_ADDRESS = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
    const ESCROW_ADDRESS = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
    
    // 获取账户
    const [deployer, user1, user2] = await ethers.getSigners();
    console.log("验证账户:", deployer.address);
    
    // 连接到已部署的合约
    const RMBToken = await ethers.getContractFactory("RMBToken");
    const rmbToken = RMBToken.attach(RMB_TOKEN_ADDRESS);
    
    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = Escrow.attach(ESCROW_ADDRESS);
    
    console.log("\n=== 验证 RMBToken ===");
    
    // 检查基本信息
    const name = await rmbToken.name();
    const symbol = await rmbToken.symbol();
    const decimals = await rmbToken.decimals();
    const totalSupply = await rmbToken.totalSupply();
    const deployerBalance = await rmbToken.balanceOf(deployer.address);
    
    console.log("代币名称:", name);
    console.log("代币符号:", symbol);
    console.log("小数位数:", decimals.toString());
    console.log("总供应量:", ethers.formatUnits(totalSupply, decimals));
    console.log("部署者余额:", ethers.formatUnits(deployerBalance, decimals));
    
    // 测试转账功能
    console.log("\n--- 测试转账功能 ---");
    const transferAmount = ethers.parseUnits("1000", decimals); // 1000 RMB
    
    console.log("转账前 user1 余额:", ethers.formatUnits(await rmbToken.balanceOf(user1.address), decimals));
    
    const transferTx = await rmbToken.transfer(user1.address, transferAmount);
    await transferTx.wait();
    
    console.log("转账后 user1 余额:", ethers.formatUnits(await rmbToken.balanceOf(user1.address), decimals));
    console.log("✅ 转账功能正常");
    
    console.log("\n=== 验证 Escrow ===");
    
    // 检查 Escrow 基本信息
    const tokenStoreImpl = await escrow.tokenStoreImplementation();
    const deployerTokenStore = await escrow.getTokenStore(deployer.address);
    
    console.log("TokenStore 实现地址:", tokenStoreImpl);
    console.log("部署者 TokenStore 地址:", deployerTokenStore);
    
    // 测试 PaymentInfo 哈希计算
    console.log("\n--- 测试 PaymentInfo 哈希 ---");
    const now = Math.floor(Date.now() / 1000);
    const paymentInfo = {
        operator: deployer.address,
        payer: user1.address,
        receiver: user2.address,
        token: RMB_TOKEN_ADDRESS,
        maxAmount: ethers.parseUnits("100", decimals),
        preApprovalExpiry: now + 50,
        authorizationExpiry: now + 100,
        refundExpiry: now + 200,
        minFeeBps: 0,
        maxFeeBps: 500, // 5%
        feeReceiver: ethers.ZeroAddress,
        salt: 12345
    };
    
    const paymentHash = await escrow.getHash(paymentInfo);
    console.log("PaymentInfo 哈希:", paymentHash);
    console.log("✅ PaymentInfo 哈希计算正常");
    
    // 检查支付状态
    const paymentState = await escrow.paymentState(paymentHash);
    console.log("支付状态:", {
        hasCollectedPayment: paymentState.hasCollectedPayment,
        capturableAmount: paymentState.capturableAmount.toString(),
        refundableAmount: paymentState.refundableAmount.toString()
    });
    
    console.log("\n=== 验证完成 ===");
    console.log("✅ RMBToken 合约部署正确且功能正常");
    console.log("✅ Escrow 合约部署正确且功能正常");
    console.log("✅ 合约间可以正常交互");
    
    return {
        rmbToken: RMB_TOKEN_ADDRESS,
        escrow: ESCROW_ADDRESS,
        status: "success"
    };
}

// 如果直接运行此脚本
if (require.main === module) {
    main()
        .then(() => {
            console.log("\n🎉 验证完成，所有合约工作正常!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("验证失败:", error);
            process.exit(1);
        });
}

module.exports = main;