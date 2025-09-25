const { ethers } = require("hardhat");

const RMB_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

async function main() {
    console.log("🔍 === 检查账户余额 ===");
    
    // 获取账户
    const [deployer, xiaoming, coffeeShop, operator] = await ethers.getSigners();
    
    console.log("\n👥 账户地址:");
    console.log("- Deployer:", deployer.address);
    console.log("- 小明:", xiaoming.address);
    console.log("- 咖啡店:", coffeeShop.address);
    console.log("- 运营方:", operator.address);
    
    // 获取合约实例
    const rmbToken = await ethers.getContractAt("RMBToken", RMB_TOKEN_ADDRESS);
    
    // 检查各账户余额
    console.log("\n💰 RMB Token 余额:");
    
    const deployerBalance = await rmbToken.balanceOf(deployer.address);
    console.log("- Deployer:", ethers.formatUnits(deployerBalance, 18), "RMB");
    
    const xiaomingBalance = await rmbToken.balanceOf(xiaoming.address);
    console.log("- 小明:", ethers.formatUnits(xiaomingBalance, 18), "RMB");
    
    const coffeeShopBalance = await rmbToken.balanceOf(coffeeShop.address);
    console.log("- 咖啡店:", ethers.formatUnits(coffeeShopBalance, 18), "RMB");
    
    const operatorBalance = await rmbToken.balanceOf(operator.address);
    console.log("- 运营方:", ethers.formatUnits(operatorBalance, 18), "RMB");
    
    // 检查总供应量
    const totalSupply = await rmbToken.totalSupply();
    console.log("\n📊 总供应量:", ethers.formatUnits(totalSupply, 18), "RMB");
    
    // 检查合约信息
    const name = await rmbToken.name();
    const symbol = await rmbToken.symbol();
    const decimals = await rmbToken.decimals();
    
    console.log("\n📋 合约信息:");
    console.log("- 名称:", name);
    console.log("- 符号:", symbol);
    console.log("- 精度:", decimals.toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 检查过程中出现错误:", error);
        process.exitCode = 1;
    });