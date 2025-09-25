const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("基本测试", function () {
  it("应该能够运行简单测试", async function () {
    console.log("运行简单测试...");
    
    // 获取签名者
    const [owner] = await ethers.getSigners();
    console.log("测试账户地址:", owner.address);
    
    // 简单断言
    expect(true).to.equal(true);
    
    console.log("测试通过！");
  });
});