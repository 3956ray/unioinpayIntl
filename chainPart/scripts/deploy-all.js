const { ethers } = require("hardhat");

async function main() {
    console.log("开始部署 RMBToken 和 Escrow 合约到本地网络...");
    
    // 获取部署账户
    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);
    console.log("账户余额:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));
    
    // ============ 部署 RMBToken ============
    console.log("\n=== 第一步：部署 RMBToken ===");
    
    const RMBToken = await ethers.getContractFactory("RMBToken");
    console.log("正在部署 RMBToken...");
    
    const rmbToken = await RMBToken.deploy(
        "RMB Token",        // name
        "RMB",             // symbol
        "CNY",             // currency
        deployer.address    // owner
    );
    
    await rmbToken.waitForDeployment();
    const rmbTokenAddress = await rmbToken.getAddress();
    
    console.log("✅ RMBToken 部署成功!");
    console.log("RMBToken 地址:", rmbTokenAddress);
    
    // 验证 RMBToken 部署
    console.log("\n--- 验证 RMBToken 部署 ---");
    const name = await rmbToken.name();
    const symbol = await rmbToken.symbol();
    const decimals = await rmbToken.decimals();
    const currency = await rmbToken.getCurrency();
    const owner = await rmbToken.owner();
    
    console.log("代币名称:", name);
    console.log("代币符号:", symbol);
    console.log("小数位数:", decimals);
    console.log("货币类型:", currency);
    console.log("合约所有者:", owner);
    
    // 铸造一些初始代币用于测试
    console.log("\n--- 铸造测试代币 ---");
    const mintAmount = ethers.parseUnits("1000000", decimals); // 100万 RMB
    console.log("正在铸造", ethers.formatUnits(mintAmount, decimals), "RMB 到部署者账户...");
    
    const mintTx = await rmbToken.mint(deployer.address, mintAmount);
    await mintTx.wait();
    
    const balance = await rmbToken.balanceOf(deployer.address);
    console.log("部署者 RMB 余额:", ethers.formatUnits(balance, decimals));
    
    // ============ 部署 Escrow ============
    console.log("\n=== 第二步：部署 Escrow ===");
    
    const Escrow = await ethers.getContractFactory("Escrow");
    console.log("正在部署 Escrow...");
    
    const escrow = await Escrow.deploy();
    await escrow.waitForDeployment();
    const escrowAddress = await escrow.getAddress();
    
    console.log("✅ Escrow 部署成功!");
    console.log("Escrow 地址:", escrowAddress);
    
    // 验证 Escrow 部署
    console.log("\n--- 验证 Escrow 部署 ---");
    const tokenStoreImplementation = await escrow.tokenStoreImplementation();
    console.log("TokenStore 实现地址:", tokenStoreImplementation);
    
    // 获取部署者的 TokenStore 地址
    const deployerTokenStore = await escrow.getTokenStore(deployer.address);
    console.log("部署者的 TokenStore 地址:", deployerTokenStore);
    
    // ============ 部署总结 ============
    console.log("\n=== 部署完成总结 ===");
    console.log("网络:", (await ethers.provider.getNetwork()).name);
    console.log("链 ID:", (await ethers.provider.getNetwork()).chainId);
    console.log("部署者地址:", deployer.address);
    console.log("RMBToken 地址:", rmbTokenAddress);
    console.log("Escrow 地址:", escrowAddress);
    console.log("TokenStore 实现地址:", tokenStoreImplementation);
    
    // 保存部署信息到文件
    const networkInfo = await ethers.provider.getNetwork();
    const deploymentInfo = {
        network: {
            name: networkInfo.name,
            chainId: networkInfo.chainId.toString()
        },
        deployer: deployer.address,
        contracts: {
            RMBToken: {
                address: rmbTokenAddress,
                name: name,
                symbol: symbol,
                decimals: decimals.toString(),
                currency: currency
            },
            Escrow: {
                address: escrowAddress,
                tokenStoreImplementation: tokenStoreImplementation
            }
        },
        timestamp: new Date().toISOString()
    };
    
    console.log("\n=== 部署信息 ===");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
    // 返回部署的合约实例
    return {
        rmbToken,
        escrow,
        deploymentInfo
    };
}

// 如果直接运行此脚本
if (require.main === module) {
    main()
        .then(() => {
            console.log("\n🎉 所有合约部署成功!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("部署失败:", error);
            process.exit(1);
        });
}

module.exports = main;