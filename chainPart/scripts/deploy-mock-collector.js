const { ethers } = require("hardhat");

async function main() {
    console.log("部署 MockCollector...");
    
    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);
    
    // 部署 MockCollector
    const MockCollector = await ethers.getContractFactory("MockCollector");
    const mockCollector = await MockCollector.deploy();
    await mockCollector.waitForDeployment();
    
    const mockCollectorAddress = await mockCollector.getAddress();
    console.log("✅ MockCollector 部署成功!");
    console.log("MockCollector 地址:", mockCollectorAddress);
    
    return {
        mockCollector,
        address: mockCollectorAddress
    };
}

if (require.main === module) {
    main()
        .then(() => {
            console.log("部署完成!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("部署失败:", error);
            process.exit(1);
        });
}

module.exports = main;