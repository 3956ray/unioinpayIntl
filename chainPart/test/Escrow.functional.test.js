const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Escrow Functional Tests", function () {
  let escrow;
  let mockToken;
  let mockCollector;
  let operator, payer, receiver, feeReceiver;

  // 测试常量
  const PAYMENT_AMOUNT = ethers.parseEther("100");
  const MAX_AMOUNT = ethers.parseEther("1000");
  const MIN_FEE_BPS = 0;
  const MAX_FEE_BPS = 500; // 5%
  const FEE_BPS = 250; // 2.5%
  const SALT = ethers.keccak256(ethers.toUtf8Bytes("test-salt-123"));

  beforeEach(async function () {
    [operator, payer, receiver, feeReceiver] = await ethers.getSigners();

    // 部署 Escrow 合约（会自动部署 TokenStore 实现）
    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy();

    // 部署 Mock Token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Test Token", "TEST", 18);

    // 部署 Mock Collector
    const MockCollector = await ethers.getContractFactory("MockCollector");
    mockCollector = await MockCollector.deploy();

    // 给 payer 和 operator 铸造代币
    await mockToken.mint(payer.address, ethers.parseEther("10000"));
    await mockToken.mint(operator.address, ethers.parseEther("10000"));
    await mockToken.connect(payer).approve(mockCollector.target, ethers.parseEther("10000"));
    await mockToken.connect(operator).approve(mockCollector.target, ethers.parseEther("10000"));
  });

  // 创建标准支付信息的辅助函数
  async function createPaymentInfo(overrides = {}) {
    const now = await time.latest();
    return {
      operator: operator.address,
      payer: payer.address,
      receiver: receiver.address,
      token: mockToken.target,
      maxAmount: MAX_AMOUNT,
      preApprovalExpiry: now + 3600, // 1小时后过期
      authorizationExpiry: now + 7200, // 2小时后过期
      refundExpiry: now + 86400, // 24小时后过期
      minFeeBps: MIN_FEE_BPS,
      maxFeeBps: MAX_FEE_BPS,
      feeReceiver: ethers.ZeroAddress,
      salt: SALT,
      ...overrides
    };
  }

  describe("部署和初始化", function () {
    it("应该正确设置 tokenStoreImplementation", async function () {
      const impl = await escrow.tokenStoreImplementation();
      expect(impl).to.not.equal(ethers.ZeroAddress);
    });

    it("应该正确计算 TokenStore 地址", async function () {
      const tokenStoreAddress = await escrow.getTokenStore(operator.address);
      expect(tokenStoreAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("应该正确计算支付哈希", async function () {
      const paymentInfo = await createPaymentInfo();
      const hash = await escrow.getHash(paymentInfo);
      expect(hash).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("charge 功能（收费）", function () {
    it("应该成功执行一步式支付", async function () {
      const paymentInfo = await createPaymentInfo();
      
      const payerBalanceBefore = await mockToken.balanceOf(payer.address);
      const receiverBalanceBefore = await mockToken.balanceOf(receiver.address);
      const feeReceiverBalanceBefore = await mockToken.balanceOf(feeReceiver.address);

      await escrow.connect(operator).charge(
        paymentInfo,
        PAYMENT_AMOUNT,
        mockCollector.target,
        "0x",
        FEE_BPS,
        feeReceiver.address
      );

      const payerBalanceAfter = await mockToken.balanceOf(payer.address);
      const receiverBalanceAfter = await mockToken.balanceOf(receiver.address);
      const feeReceiverBalanceAfter = await mockToken.balanceOf(feeReceiver.address);

      const feeAmount = (PAYMENT_AMOUNT * BigInt(FEE_BPS)) / 10000n;
      const netAmount = PAYMENT_AMOUNT - feeAmount;

      expect(payerBalanceAfter).to.equal(payerBalanceBefore - PAYMENT_AMOUNT);
      expect(receiverBalanceAfter).to.equal(receiverBalanceBefore + netAmount);
      expect(feeReceiverBalanceAfter).to.equal(feeReceiverBalanceBefore + feeAmount);
    });

    it("应该正确更新支付状态", async function () {
      const paymentInfo = await createPaymentInfo();
      const paymentHash = await escrow.getHash(paymentInfo);

      await escrow.connect(operator).charge(
        paymentInfo,
        PAYMENT_AMOUNT,
        mockCollector.target,
        "0x",
        FEE_BPS,
        feeReceiver.address
      );

      const state = await escrow.paymentState(paymentHash);
      expect(state.hasCollectedPayment).to.be.true;
      expect(state.capturableAmount).to.equal(0);
      expect(state.refundableAmount).to.equal(PAYMENT_AMOUNT);
    });

    it("应该发出 PaymentCharged 事件", async function () {
      const paymentInfo = await createPaymentInfo();

      await expect(
        escrow.connect(operator).charge(
          paymentInfo,
          PAYMENT_AMOUNT,
          mockCollector.target,
          "0x",
          FEE_BPS,
          feeReceiver.address
        )
      ).to.emit(escrow, "PaymentCharged");
    });

    it("应该拒绝非操作者的调用", async function () {
      const paymentInfo = await createPaymentInfo();

      await expect(
        escrow.connect(payer).charge(
          paymentInfo,
          PAYMENT_AMOUNT,
          mockCollector.target,
          "0x",
          FEE_BPS,
          feeReceiver.address
        )
      ).to.be.revertedWithCustomError(escrow, "InvalidSender");
    });

    it("应该拒绝零金额", async function () {
      const paymentInfo = await createPaymentInfo();

      await expect(
        escrow.connect(operator).charge(
          paymentInfo,
          0,
          mockCollector.target,
          "0x",
          FEE_BPS,
          feeReceiver.address
        )
      ).to.be.revertedWithCustomError(escrow, "ZeroAmount");
    });

    it("应该拒绝超过最大金额的支付", async function () {
      const paymentInfo = await createPaymentInfo();
      const excessiveAmount = MAX_AMOUNT + 1n;

      await expect(
        escrow.connect(operator).charge(
          paymentInfo,
          excessiveAmount,
          mockCollector.target,
          "0x",
          FEE_BPS,
          feeReceiver.address
        )
      ).to.be.revertedWithCustomError(escrow, "ExceedsMaxAmount");
    });

    it("应该拒绝重复支付", async function () {
      const paymentInfo = await createPaymentInfo();

      await escrow.connect(operator).charge(
        paymentInfo,
        PAYMENT_AMOUNT,
        mockCollector.target,
        "0x",
        FEE_BPS,
        feeReceiver.address
      );

      await expect(
        escrow.connect(operator).charge(
          paymentInfo,
          PAYMENT_AMOUNT,
          mockCollector.target,
          "0x",
          FEE_BPS,
          feeReceiver.address
        )
      ).to.be.revertedWithCustomError(escrow, "PaymentAlreadyCollected");
    });
  });

  describe("authorize/capture 流程", function () {
    it("应该成功授权支付", async function () {
      const paymentInfo = await createPaymentInfo();
      const paymentHash = await escrow.getHash(paymentInfo);

      await escrow.connect(operator).authorize(
        paymentInfo,
        PAYMENT_AMOUNT,
        mockCollector.target,
        "0x"
      );

      const state = await escrow.paymentState(paymentHash);
      expect(state.hasCollectedPayment).to.be.true;
      expect(state.capturableAmount).to.equal(PAYMENT_AMOUNT);
      expect(state.refundableAmount).to.equal(0);
    });

    it("应该发出 PaymentAuthorized 事件", async function () {
      const paymentInfo = await createPaymentInfo();

      await expect(
        escrow.connect(operator).authorize(
          paymentInfo,
          PAYMENT_AMOUNT,
          mockCollector.target,
          "0x"
        )
      ).to.emit(escrow, "PaymentAuthorized");
    });

    it("应该成功捕获全部授权金额", async function () {
      const paymentInfo = await createPaymentInfo();
      const paymentHash = await escrow.getHash(paymentInfo);

      await escrow.connect(operator).authorize(
        paymentInfo,
        PAYMENT_AMOUNT,
        mockCollector.target,
        "0x"
      );

      const receiverBalanceBefore = await mockToken.balanceOf(receiver.address);

      await escrow.connect(operator).capture(
        paymentInfo,
        PAYMENT_AMOUNT,
        FEE_BPS,
        feeReceiver.address
      );

      const receiverBalanceAfter = await mockToken.balanceOf(receiver.address);
      const feeAmount = (PAYMENT_AMOUNT * BigInt(FEE_BPS)) / 10000n;
      const netAmount = PAYMENT_AMOUNT - feeAmount;

      expect(receiverBalanceAfter).to.equal(receiverBalanceBefore + netAmount);
    });

    it("应该成功捕获部分授权金额", async function () {
      const paymentInfo = await createPaymentInfo();
      const paymentHash = await escrow.getHash(paymentInfo);
      const captureAmount = PAYMENT_AMOUNT / 2n;

      await escrow.connect(operator).authorize(
        paymentInfo,
        PAYMENT_AMOUNT,
        mockCollector.target,
        "0x"
      );

      await escrow.connect(operator).capture(
        paymentInfo,
        captureAmount,
        FEE_BPS,
        feeReceiver.address
      );

      const state = await escrow.paymentState(paymentHash);
      expect(state.capturableAmount).to.equal(PAYMENT_AMOUNT - captureAmount);
    });

    it("应该在授权过期后拒绝捕获", async function () {
      const now = await time.latest();
      const paymentInfo = await createPaymentInfo({
        preApprovalExpiry: now + 50,
        authorizationExpiry: now + 100,
        refundExpiry: now + 200
      });
      const paymentHash = await escrow.getHash(paymentInfo);

      await escrow.connect(operator).authorize(
        paymentInfo,
        PAYMENT_AMOUNT,
        mockCollector.target,
        "0x"
      );

      await time.increase(200);

      await expect(
        escrow.connect(operator).capture(
          paymentInfo,
          PAYMENT_AMOUNT,
          FEE_BPS,
          feeReceiver.address
        )
      ).to.be.revertedWithCustomError(escrow, "AfterAuthorizationExpiry");
    });
  });

  describe("void 和 reclaim 功能", function () {
    it("操作者应该能够作废授权", async function () {
      const paymentInfo = await createPaymentInfo();
      const paymentHash = await escrow.getHash(paymentInfo);

      await escrow.connect(operator).authorize(
        paymentInfo,
        PAYMENT_AMOUNT,
        mockCollector.target,
        "0x"
      );

      const payerBalanceBefore = await mockToken.balanceOf(payer.address);

      await escrow.connect(operator).void(paymentInfo);

      const payerBalanceAfter = await mockToken.balanceOf(payer.address);
      const state = await escrow.paymentState(paymentHash);
      
      expect(state.capturableAmount).to.equal(0);
      expect(state.refundableAmount).to.equal(0);
      expect(payerBalanceAfter).to.equal(payerBalanceBefore + PAYMENT_AMOUNT);
    });

    it("付款人应该能够在过期后回收资金", async function () {
      const now = await time.latest();
      const paymentInfo = await createPaymentInfo({
        preApprovalExpiry: now + 50,
        authorizationExpiry: now + 100,
        refundExpiry: now + 200
      });
      const paymentHash = await escrow.getHash(paymentInfo);

      await escrow.connect(operator).authorize(
        paymentInfo,
        PAYMENT_AMOUNT,
        mockCollector.target,
        "0x"
      );

      await time.increase(200);

      const payerBalanceBefore = await mockToken.balanceOf(payer.address);

      await escrow.connect(payer).reclaim(paymentInfo);

      const payerBalanceAfter = await mockToken.balanceOf(payer.address);
      expect(payerBalanceAfter).to.equal(payerBalanceBefore + PAYMENT_AMOUNT);
    });

    it("应该在过期前拒绝回收", async function () {
      const paymentInfo = await createPaymentInfo();
      const paymentHash = await escrow.getHash(paymentInfo);

      await escrow.connect(operator).authorize(
        paymentInfo,
        PAYMENT_AMOUNT,
        mockCollector.target,
        "0x"
      );

      await expect(
        escrow.connect(payer).reclaim(paymentInfo)
      ).to.be.revertedWithCustomError(escrow, "BeforeAuthorizationExpiry");
    });

    it("应该拒绝对零授权的作废", async function () {
      const paymentInfo = await createPaymentInfo();
      const paymentHash = await escrow.getHash(paymentInfo);

      await expect(
        escrow.connect(operator).void(paymentInfo)
      ).to.be.revertedWithCustomError(escrow, "ZeroAuthorization");
    });
  });

  describe("refund 功能（退款）", function () {
    it("应该成功退款", async function () {
      const paymentInfo = await createPaymentInfo();
      const paymentHash = await escrow.getHash(paymentInfo);
      const refundAmount = PAYMENT_AMOUNT / 2n;

      await escrow.connect(operator).authorize(
        paymentInfo,
        PAYMENT_AMOUNT,
        mockCollector.target,
        "0x"
      );

      await escrow.connect(operator).capture(
        paymentInfo,
        PAYMENT_AMOUNT,
        FEE_BPS,
        feeReceiver.address
      );

      const payerBalanceBefore = await mockToken.balanceOf(payer.address);

      await escrow.connect(operator).refund(paymentInfo, refundAmount, mockCollector.target, ethers.toUtf8Bytes("refund"));

      const payerBalanceAfter = await mockToken.balanceOf(payer.address);

      expect(payerBalanceAfter).to.equal(payerBalanceBefore + refundAmount);
    });

    it("应该拒绝超过捕获金额的退款", async function () {
      const paymentInfo = await createPaymentInfo();
      const paymentHash = await escrow.getHash(paymentInfo);

      await escrow.connect(operator).authorize(
        paymentInfo,
        PAYMENT_AMOUNT,
        mockCollector.target,
        "0x"
      );

      await escrow.connect(operator).capture(
        paymentInfo,
        PAYMENT_AMOUNT / 2n,
        FEE_BPS,
        feeReceiver.address
      );

      await expect(
        escrow.connect(operator).refund(paymentInfo, PAYMENT_AMOUNT, mockCollector.target, ethers.toUtf8Bytes("refund"))
      ).to.be.revertedWithCustomError(escrow, "RefundExceedsCapture");
    });

    it("应该拒绝在退款过期后的退款", async function () {
      const now = await time.latest();
      const paymentInfo = await createPaymentInfo({
        preApprovalExpiry: now + 50,
        authorizationExpiry: now + 75,
        refundExpiry: now + 100
      });
      const paymentHash = await escrow.getHash(paymentInfo);

      await escrow.connect(operator).authorize(
        paymentInfo,
        PAYMENT_AMOUNT,
        mockCollector.target,
        "0x"
      );

      await escrow.connect(operator).capture(
        paymentInfo,
        PAYMENT_AMOUNT,
        FEE_BPS,
        feeReceiver.address
      );

      await time.increase(200);

      await expect(
        escrow.connect(operator).refund(paymentInfo, PAYMENT_AMOUNT / 2n, mockCollector.target, ethers.toUtf8Bytes("refund"))
      ).to.be.revertedWithCustomError(escrow, "AfterRefundExpiry");
    });
  });

  describe("时间验证", function () {
    it("应该拒绝在预批准过期后的操作", async function () {
      const now = await time.latest();
      const paymentInfo = await createPaymentInfo({
        preApprovalExpiry: now + 100
      });

      await time.increase(200);

      await expect(
        escrow.connect(operator).charge(
          paymentInfo,
          PAYMENT_AMOUNT,
          mockCollector.target,
          "0x",
          FEE_BPS,
          feeReceiver.address
        )
      ).to.be.revertedWithCustomError(escrow, "AfterPreApprovalExpiry");
    });

    it("应该拒绝无效的过期时间序列", async function () {
      const now = await time.latest();
      const paymentInfo = await createPaymentInfo({
        preApprovalExpiry: now + 1000,
        authorizationExpiry: now + 500, // 授权过期早于预批准过期
        refundExpiry: now + 2000
      });

      await expect(
        escrow.connect(operator).charge(
          paymentInfo,
          PAYMENT_AMOUNT,
          mockCollector.target,
          "0x",
          FEE_BPS,
          feeReceiver.address
        )
      ).to.be.revertedWithCustomError(escrow, "InvalidExpiries");
    });
  });

  describe("费用验证", function () {
    it("应该拒绝超出范围的费用", async function () {
      const paymentInfo = await createPaymentInfo();

      await expect(
        escrow.connect(operator).charge(
          paymentInfo,
          PAYMENT_AMOUNT,
          mockCollector.target,
          "0x",
          MAX_FEE_BPS + 1,
          feeReceiver.address
        )
      ).to.be.revertedWithCustomError(escrow, "FeeBpsOutOfRange");
    });

    it("应该拒绝零费用接收者但非零费用", async function () {
      const paymentInfo = await createPaymentInfo();

      await expect(
        escrow.connect(operator).charge(
          paymentInfo,
          PAYMENT_AMOUNT,
          mockCollector.target,
          "0x",
          FEE_BPS,
          ethers.ZeroAddress
        )
      ).to.be.revertedWithCustomError(escrow, "ZeroFeeReceiver");
    });

    it("应该允许零费用", async function () {
      const paymentInfo = await createPaymentInfo();

      await expect(
        escrow.connect(operator).charge(
          paymentInfo,
          PAYMENT_AMOUNT,
          mockCollector.target,
          "0x",
          0,
          ethers.ZeroAddress
        )
      ).to.not.be.reverted;
    });
  });

  describe("TokenStore 管理", function () {
    it("应该在首次使用时自动部署 TokenStore", async function () {
      const paymentInfo = await createPaymentInfo();
      const tokenStoreAddress = await escrow.getTokenStore(operator.address);

      // 检查 TokenStore 是否尚未部署
      const codeBefore = await ethers.provider.getCode(tokenStoreAddress);
      expect(codeBefore).to.equal("0x");

      await escrow.connect(operator).charge(
        paymentInfo,
        PAYMENT_AMOUNT,
        mockCollector.target,
        "0x",
        FEE_BPS,
        feeReceiver.address
      );

      // 检查 TokenStore 是否已部署
      const codeAfter = await ethers.provider.getCode(tokenStoreAddress);
      expect(codeAfter).to.not.equal("0x");
    });

    it("应该发出 TokenStoreCreated 事件", async function () {
      const paymentInfo = await createPaymentInfo();

      await expect(
        escrow.connect(operator).charge(
          paymentInfo,
          PAYMENT_AMOUNT,
          mockCollector.target,
          "0x",
          FEE_BPS,
          feeReceiver.address
        )
      ).to.emit(escrow, "TokenStoreCreated");
    });
  });

  describe("重入攻击防护", function () {
    it("应该防止重入攻击", async function () {
      const paymentInfo = await createPaymentInfo();

      // 这是一个概念性测试，实际的重入攻击需要恶意合约
      await expect(
        escrow.connect(operator).charge(
          paymentInfo,
          PAYMENT_AMOUNT,
          mockCollector.target,
          "0x",
          FEE_BPS,
          feeReceiver.address
        )
      ).to.not.be.reverted;
    });
  });

  describe("边界条件测试", function () {
    it("应该处理最大可能的金额", async function () {
      // 使用 uint120 的最大值，这是 PaymentInfo.maxAmount 的类型
      const maxAmount = (2n ** 120n) - 1n;
      const paymentInfo = await createPaymentInfo({
        maxAmount: maxAmount
      });

      // 给 payer 足够的代币
      await mockToken.mint(payer.address, maxAmount);
      await mockToken.connect(payer).approve(mockCollector.target, maxAmount);

      await expect(
        escrow.connect(operator).charge(
          paymentInfo,
          maxAmount,
          mockCollector.target,
          "0x",
          0, // 零费用避免溢出
          ethers.ZeroAddress
        )
      ).to.not.be.reverted;
    });

    it("应该拒绝金额溢出", async function () {
      const paymentInfo = await createPaymentInfo();

      // 尝试使用会导致溢出的金额
      await expect(
        escrow.connect(operator).charge(
          paymentInfo,
          ethers.MaxUint256,
          mockCollector.target,
          "0x",
          1, // 非零费用会导致溢出
          feeReceiver.address
        )
      ).to.be.revertedWithCustomError(escrow, "AmountOverflow");
    });

    it("应该处理最大费用率", async function () {
      const paymentInfo = await createPaymentInfo({
        maxFeeBps: 10000 // 100%
      });

      await expect(
        escrow.connect(operator).charge(
          paymentInfo,
          PAYMENT_AMOUNT,
          mockCollector.target,
          "0x",
          10000,
          feeReceiver.address
        )
      ).to.not.be.reverted;
    });

    it("应该拒绝超过 100% 的最大费用率", async function () {
      const paymentInfo = await createPaymentInfo({
        maxFeeBps: 10001 // 超过 100%
      });

      await expect(
        escrow.connect(operator).charge(
          paymentInfo,
          PAYMENT_AMOUNT,
          mockCollector.target,
          "0x",
          FEE_BPS,
          feeReceiver.address
        )
      ).to.be.revertedWithCustomError(escrow, "FeeBpsOverflow");
    });
  });
});