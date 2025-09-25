const { ethers } = require("hardhat");

async function main() {
    const [deployer, xiaoming] = await ethers.getSigners();
    const rmbToken = await ethers.getContractAt("RMBToken", "0x5FbDB2315678afecb367f032d93F642f64180aa3");
    const mockCollector = await ethers.getContractAt("MockCollector", "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6");
    
    console.log("小明余额:", ethers.formatUnits(await rmbToken.balanceOf(xiaoming.address), 6));
    console.log("小明对MockCollector的授权:", ethers.formatUnits(await rmbToken.allowance(xiaoming.address, "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6"), 6));
    console.log("小明对Escrow的授权:", ethers.formatUnits(await rmbToken.allowance(xiaoming.address, "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"), 6));
}

main().catch(console.error);
