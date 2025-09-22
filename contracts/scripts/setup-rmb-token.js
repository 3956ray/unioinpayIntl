const { ethers } = require("hardhat");

async function main() {
    console.log("开始配置 RMBToken 为 EscrowContract 支持的代币...");

    // 获取部署账户
    const [deployer] = await ethers.getSigners();
    console.log("操作账户:", deployer.address);
    console.log("账户余额:", ethers.utils.formatEther(await deployer.getBalance()));

    // 合约地址 - 需要根据实际部署地址修改
    const ESCROW_CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS || "YOUR_ESCROW_CONTRACT_ADDRESS";
    const RMB_TOKEN_ADDRESS = process.env.RMB_TOKEN_ADDRESS || "YOUR_RMB_TOKEN_ADDRESS";

    if (ESCROW_CONTRACT_ADDRESS === "YOUR_ESCROW_CONTRACT_ADDRESS" || 
        RMB_TOKEN_ADDRESS === "YOUR_RMB_TOKEN_ADDRESS") {
        console.error("请设置环境变量 ESCROW_CONTRACT_ADDRESS 和 RMB_TOKEN_ADDRESS");
        console.error("或者直接在脚本中修改地址");
        process.exit(1);
    }

    // 获取合约实例
    const EscrowContract = await ethers.getContractFactory("EscrowContract");
    const escrowContract = EscrowContract.attach(ESCROW_CONTRACT_ADDRESS);

    const RMBToken = await ethers.getContractFactory("RMBToken");
    const rmbToken = RMBToken.attach(RMB_TOKEN_ADDRESS);

    console.log("\n=== 合约信息 ===");
    console.log("EscrowContract 地址:", ESCROW_CONTRACT_ADDRESS);
    console.log("RMBToken 地址:", RMB_TOKEN_ADDRESS);

    // 验证合约所有者
    const escrowOwner = await escrowContract.owner();
    console.log("EscrowContract 所有者:", escrowOwner);
    
    if (escrowOwner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.error("错误: 当前账户不是 EscrowContract 的所有者");
        console.error("当前账户:", deployer.address);
        console.error("合约所有者:", escrowOwner);
        process.exit(1);
    }

    // 检查 RMBToken 信息
    console.log("\n=== RMBToken 信息 ===");
    const tokenName = await rmbToken.name();
    const tokenSymbol = await rmbToken.symbol();
    const tokenDecimals = await rmbToken.decimals();
    const tokenCurrency = await rmbToken.getCurrency();
    
    console.log("代币名称:", tokenName);
    console.log("代币符号:", tokenSymbol);
    console.log("小数位数:", tokenDecimals);
    console.log("货币标识:", tokenCurrency);

    // 检查当前支持状态
    const isCurrentlySupported = await escrowContract.isTokenSupported(RMB_TOKEN_ADDRESS);
    console.log("\n=== 当前支持状态 ===");
    console.log("RMBToken 当前是否被支持:", isCurrentlySupported);

    if (isCurrentlySupported) {
        console.log("RMBToken 已经被设置为支持的代币，无需重复设置");
        return;
    }

    // 设置 RMBToken 为支持的代币
    console.log("\n=== 设置代币支持 ===");
    console.log("正在设置 RMBToken 为支持的代币...");
    
    const tx = await escrowContract.setTokenSupport(RMB_TOKEN_ADDRESS, true);
    console.log("交易哈希:", tx.hash);
    
    // 等待交易确认
    console.log("等待交易确认...");
    const receipt = await tx.wait();
    console.log("交易已确认，区块号:", receipt.blockNumber);
    console.log("Gas 使用量:", receipt.gasUsed.toString());

    // 验证设置结果
    const isNowSupported = await escrowContract.isTokenSupported(RMB_TOKEN_ADDRESS);
    console.log("\n=== 验证结果 ===");
    console.log("RMBToken 现在是否被支持:", isNowSupported);

    if (isNowSupported) {
        console.log("✅ 成功设置 RMBToken 为 EscrowContract 支持的代币!");
        
        // 检查事件
        const events = receipt.events?.filter(event => event.event === 'TokenSupportUpdated');
        if (events && events.length > 0) {
            console.log("\n=== 事件信息 ===");
            events.forEach((event, index) => {
                console.log(`事件 ${index + 1}:`);
                console.log(`  代币地址: ${event.args.token}`);
                console.log(`  支持状态: ${event.args.supported}`);
            });
        }
    } else {
        console.error("❌ 设置失败，请检查交易状态");
        process.exit(1);
    }

    // 显示使用说明
    console.log("\n=== 使用说明 ===");
    console.log("现在可以在 EscrowContract 中使用 RMBToken 进行支付了:");
    console.log("1. 用户需要先授权 RMBToken 给 Permit2 合约");
    console.log("2. 然后可以通过 authorizePaymentWithPermit2 函数发起支付");
    console.log("3. 操作员可以通过 capturePayment 函数捕获支付");
    console.log("4. 支持通过 refundPayment 函数进行退款");

    console.log("\n=== 配置完成 ===");
}

// 执行配置
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("配置失败:", error);
        process.exit(1);
    });