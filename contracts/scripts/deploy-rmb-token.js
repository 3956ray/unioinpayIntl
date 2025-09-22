const { ethers } = require("hardhat");

async function main() {
    console.log("开始部署 RMBToken...");
    
    // 获取部署账户
    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);
    console.log("账户余额:", ethers.utils.formatEther(await deployer.getBalance()));
    
    console.log("正在部署 RMBToken...");
    
    // 部署 RMBToken
    const RMBToken = await ethers.getContractFactory("RMBToken");
    const rmbToken = await RMBToken.deploy(
        "RMB Token",        // name
        "RMB",             // symbol
        "CNY",             // currency
        deployer.address    // owner
    );
    await rmbToken.deployed();
    
    console.log("\n=== 部署完成 ===");
    console.log("RMBToken 地址:", rmbToken.address);
    console.log("部署交易哈希:", rmbToken.deployTransaction.hash);
    console.log("Gas 使用量:", rmbToken.deployTransaction.gasLimit.toString());
    
    // 验证部署
    console.log("\n=== 验证部署 ===");
    const name = await rmbToken.name();
    const symbol = await rmbToken.symbol();
    const decimals = await rmbToken.decimals();
    const currency = await rmbToken.getCurrency();
    const totalSupply = await rmbToken.totalSupply();
    const owner = await rmbToken.owner();
    
    console.log("代币名称:", name);
    console.log("代币符号:", symbol);
    console.log("小数位数:", decimals);
    console.log("货币类型:", currency);
    console.log("总供应量:", ethers.utils.formatUnits(totalSupply, decimals));
    console.log("合约所有者:", owner);
    
    // 铸造一些初始代币用于测试
    console.log("\n=== 铸造测试代币 ===");
    const mintAmount = ethers.utils.parseUnits("1000000", decimals); // 100万 RMB
    const mintTx = await rmbToken.mint(deployer.address, mintAmount);
    await mintTx.wait();
    
    const balance = await rmbToken.balanceOf(deployer.address);
    console.log("已铸造代币:", ethers.utils.formatUnits(mintAmount, decimals), "RMB");
    console.log("部署者余额:", ethers.utils.formatUnits(balance, decimals), "RMB");
    
    // 保存部署信息
    const deploymentInfo = {
        network: {
            chainId: (await ethers.provider.getNetwork()).chainId,
            name: (await ethers.provider.getNetwork()).name
        },
        contractAddress: rmbToken.address,
        deployerAddress: deployer.address,
        deploymentBlock: rmbToken.deployTransaction.blockNumber,
        deploymentHash: rmbToken.deployTransaction.hash,
        timestamp: new Date().toISOString(),
        tokenInfo: {
            name,
            symbol,
            decimals,
            currency,
            initialSupply: ethers.utils.formatUnits(balance, decimals)
        }
    };
    
    console.log("\n=== 部署信息 ===");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
    console.log("\n=== 使用说明 ===");
    console.log("1. RMBToken 地址:", rmbToken.address);
    console.log("2. 配置 EscrowContract 支持:");
    console.log(`   export RMB_TOKEN_ADDRESS="${rmbToken.address}"`);
    console.log(`   export ESCROW_CONTRACT_ADDRESS="<EscrowContract地址>"`);
    console.log("   npx hardhat run scripts/setup-rmb-token.js --network <network>");
    console.log("3. 或者在 EscrowContract 中调用:");
    console.log(`   escrowContract.setTokenSupport("${rmbToken.address}", true)`);
    
    return rmbToken.address;
}

// 如果直接运行此脚本
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("部署失败:", error);
            process.exit(1);
        });
}

module.exports = main;