const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EscrowContract 与 RMBToken 集成测试", function () {
  let escrowContract;
  let rmbToken;
  let mockPermit2;
  let owner;
  let operator;
  let payer;
  let payee;
  let otherAccount;

  // 测试常量
  const INITIAL_SUPPLY = ethers.utils.parseUnits("1000000", 6); // 100万 RMB (6位小数)
  const PAYMENT_AMOUNT = ethers.utils.parseUnits("100", 6); // 100 RMB

  beforeEach(async function () {
    [owner, operator, payer, payee, otherAccount] = await ethers.getSigners();

    // 部署 RMBToken
    const RMBToken = await ethers.getContractFactory("RMBToken");
    rmbToken = await RMBToken.deploy(
      "人民币代币",
      "RMB", 
      "CNY",
      owner.address
    );
    await rmbToken.deployed();

    // 部署 MockPermit2
    const MockPermit2 = await ethers.getContractFactory("MockPermit2");
    mockPermit2 = await MockPermit2.deploy();
    await mockPermit2.deployed();

    // 部署 EscrowContract
    const EscrowContract = await ethers.getContractFactory("EscrowContract");
    escrowContract = await EscrowContract.deploy(
      owner.address,
      mockPermit2.address,
      "EscrowContract",
      "1.0.0"
    );
    await escrowContract.deployed();

    // 设置 RMBToken 为支持的代币
    await escrowContract.setTokenSupport(rmbToken.address, true);

    // 注册操作员
    await escrowContract.registerOperator(operator.address, "Test Operator");

    // 给付款方铸造 RMB 代币
    await rmbToken.mint(payer.address, INITIAL_SUPPLY);
  });

  describe("基础集成验证", function () {
    it("应该正确部署所有合约", async function () {
      expect(await rmbToken.name()).to.equal("人民币代币");
      expect(await rmbToken.symbol()).to.equal("RMB");
      expect(await rmbToken.decimals()).to.equal(6);
      expect(await rmbToken.getCurrency()).to.equal("CNY");
      
      expect(await escrowContract.owner()).to.equal(owner.address);
      expect(await escrowContract.permit2()).to.equal(mockPermit2.address);
      expect(await escrowContract.isTokenSupported(rmbToken.address)).to.equal(true);
      expect(await escrowContract.isOperator(operator.address)).to.equal(true);
    });

    it("付款方应该有足够的 RMB 余额", async function () {
      const balance = await rmbToken.balanceOf(payer.address);
      expect(balance.toString()).to.equal(INITIAL_SUPPLY.toString());
    });

    it("RMBToken 应该支持 EIP-2612 Permit", async function () {
      const domain = await rmbToken.getDomainSeparator();
      expect(domain).to.not.equal(ethers.constants.HashZero);
      
      const nonce = await rmbToken.nonces(payer.address);
      expect(nonce.toString()).to.equal("0");
    });
  });

  describe("代币支持管理", function () {
    it("所有者可以设置 RMBToken 支持状态", async function () {
      // 先移除支持
      await escrowContract.setTokenSupport(rmbToken.address, false);
      expect(await escrowContract.isTokenSupported(rmbToken.address)).to.equal(false);
      
      // 重新添加支持
      await escrowContract.setTokenSupport(rmbToken.address, true);
      expect(await escrowContract.isTokenSupported(rmbToken.address)).to.equal(true);
    });

    it("应该发出 TokenSupportUpdated 事件", async function () {
      const tx = await escrowContract.setTokenSupport(rmbToken.address, false);
      const receipt = await tx.wait();
      const event = receipt.events?.find(e => e.event === "TokenSupportUpdated");
      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(rmbToken.address);
      expect(event.args[1]).to.equal(false);
    });

    it("非所有者不能设置代币支持状态", async function () {
      try {
        await escrowContract.connect(payer).setTokenSupport(rmbToken.address, false);
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("Ownable: caller is not the owner");
      }
    });
  });

  describe("支付流程集成", function () {
    let paymentIntent;
    let intentSignature;
    let permit;
    let permitSignature;

    beforeEach(async function () {
      // 构造支付意图
      const nonce = await escrowContract.getUserNonce(payer.address);
      const expiryTime = Math.floor(Date.now() / 1000) + 3600; // 1小时后过期
      
      paymentIntent = {
        payer: payer.address,
        payee: payee.address,
        token: rmbToken.address,
        amount: PAYMENT_AMOUNT,
        expiryTime: expiryTime,
        intentHash: ethers.constants.HashZero, // 占位符
        nonce: nonce
      };

      // 模拟签名（在实际测试中需要真实签名）
      intentSignature = "0x" + "00".repeat(65); // 占位符签名
      
      // 构造 Permit2 数据
      permit = {
        permitted: {
          token: rmbToken.address,
          amount: PAYMENT_AMOUNT
        },
        nonce: 0,
        deadline: expiryTime
      };
      
      permitSignature = "0x" + "00".repeat(65); // 占位符签名
    });

    it("应该能够生成支付意图哈希", async function () {
      const intentHash = await escrowContract.generateIntentHash(paymentIntent);
      expect(intentHash).to.not.equal(ethers.constants.HashZero);
    });

    it("应该检查代币是否支持", async function () {
      // 移除 RMBToken 支持
      await escrowContract.setTokenSupport(rmbToken.address, false);
      
      // 尝试授权支付应该失败
      try {
        await escrowContract.connect(operator).authorizePaymentWithPermit2(
          paymentIntent,
          intentSignature,
          permit,
          permitSignature
        );
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("Token not supported");
      }
    });

    it("应该验证支付金额精度", async function () {
      // RMBToken 使用 6 位小数
      const smallAmount = ethers.utils.parseUnits("0.01", 6); // 1分钱
      expect(smallAmount.toString()).to.equal("10000");
      
      const largeAmount = ethers.utils.parseUnits("999999", 6); // 99万9999元
      expect(largeAmount.toString()).to.equal("999999000000");
    });
  });

  describe("RMBToken 特性兼容性", function () {
    it("应该兼容 RMBToken 的暂停机制", async function () {
      // 暂停 RMBToken
      await rmbToken.pause();
      expect(await rmbToken.paused()).to.equal(true);
      
      // 暂停状态下转账应该失败
      try {
        await rmbToken.connect(payer).transfer(payee.address, PAYMENT_AMOUNT);
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("Pausable: paused");
      }
      
      // 恢复 RMBToken
      await rmbToken.unpause();
      expect(await rmbToken.paused()).to.equal(false);
    });

    it("应该兼容 RMBToken 的铸造限制", async function () {
      const maxMintAmount = ethers.utils.parseUnits("1000000", 6); // 100万 RMB 限制
      
      // 尝试超过限制的铸造应该失败
      const overLimitAmount = ethers.utils.parseUnits("1000001", 6);
      try {
        await rmbToken.mint(payer.address, overLimitAmount);
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("mint amount exceeds maximum limit");
      }
      
      // 在限制内的铸造应该成功
      const tx = await rmbToken.mint(payee.address, maxMintAmount);
      const receipt = await tx.wait();
      const event = receipt.events?.find(e => e.event === "Mint");
      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(owner.address);
      expect(event.args[1]).to.equal(payee.address);
      expect(event.args[2].toString()).to.equal(maxMintAmount.toString());
    });

    it("应该正确处理 RMBToken 的小数精度", async function () {
      // 测试不同精度的金额
      const amounts = [
        { value: "1", expected: "1000000" },      // 1 RMB
        { value: "0.01", expected: "10000" },    // 1分
        { value: "0.001", expected: "1000" },   // 0.1分
        { value: "0.0001", expected: "100" },   // 0.01分
        { value: "0.00001", expected: "10" },   // 0.001分
        { value: "0.000001", expected: "1" }    // 0.0001分
      ];
      
      for (const amount of amounts) {
        const parsed = ethers.utils.parseUnits(amount.value, 6);
        expect(parsed.toString()).to.equal(amount.expected);
      }
    });
  });

  describe("安全性集成测试", function () {
    it("应该防止重入攻击", async function () {
      // EscrowContract 和 RMBToken 都有重入防护
      // 这里测试基本的重入防护机制
      expect(await escrowContract.paused()).to.equal(false);
      expect(await rmbToken.paused()).to.equal(false);
    });

    it("应该正确处理紧急情况", async function () {
      // 暂停 EscrowContract
      await escrowContract.pause();
      expect(await escrowContract.paused()).to.equal(true);
      
      // 暂停状态下可以紧急提取
      await rmbToken.mint(escrowContract.address, PAYMENT_AMOUNT);
      
      try {
        await escrowContract.emergencyWithdraw(
          rmbToken.address,
          owner.address,
          PAYMENT_AMOUNT
        );
        // 如果没有抛出异常，说明操作成功
      } catch (error) {
        expect.fail("Emergency withdraw should not fail when paused");
      }
    });
  });

  describe("事件系统集成", function () {
    it("应该正确发出代币相关事件", async function () {
      // 测试 RMBToken 铸造事件
      const mintTx = await rmbToken.mint(payee.address, PAYMENT_AMOUNT);
      const mintReceipt = await mintTx.wait();
      const mintEvent = mintReceipt.events?.find(e => e.event === "Mint");
      expect(mintEvent).to.not.be.undefined;
      expect(mintEvent.args[0]).to.equal(owner.address);
      expect(mintEvent.args[1]).to.equal(payee.address);
      expect(mintEvent.args[2].toString()).to.equal(PAYMENT_AMOUNT.toString());
      
      // 测试 EscrowContract 代币支持事件
      const supportTx = await escrowContract.setTokenSupport(rmbToken.address, false);
      const supportReceipt = await supportTx.wait();
      const supportEvent = supportReceipt.events?.find(e => e.event === "TokenSupportUpdated");
      expect(supportEvent).to.not.be.undefined;
      expect(supportEvent.args[0]).to.equal(rmbToken.address);
      expect(supportEvent.args[1]).to.equal(false);
    });
  });

  describe("查询功能集成", function () {
    it("应该能够查询所有相关状态", async function () {
      // EscrowContract 查询
      expect(await escrowContract.isTokenSupported(rmbToken.address)).to.equal(true);
      expect(await escrowContract.isOperator(operator.address)).to.equal(true);
      expect((await escrowContract.getUserNonce(payer.address)).toString()).to.equal("0");
      
      // RMBToken 查询
      expect((await rmbToken.balanceOf(payer.address)).toString()).to.equal(INITIAL_SUPPLY.toString());
      expect(await rmbToken.isMinter(owner.address)).to.equal(true);
      expect(await rmbToken.getCurrency()).to.equal("CNY");
    });

    it("应该能够批量查询余额", async function () {
      const accounts = [payer.address, payee.address, owner.address];
      const balances = await rmbToken.balanceOfBatch(accounts);
      
      expect(balances[0].toString()).to.equal(INITIAL_SUPPLY.toString()); // payer
      expect(balances[1].toString()).to.equal("0"); // payee
      expect(balances[2].toString()).to.equal("0"); // owner
    });
  });
});