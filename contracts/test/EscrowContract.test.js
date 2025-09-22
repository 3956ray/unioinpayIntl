const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EscrowContract", function () {
  let escrowContract;
  let mockToken;
  let mockPermit2;
  let owner;
  let operator;
  let user;
  let otherAccount;

  beforeEach(async function () {
    [owner, operator, user, otherAccount] = await ethers.getSigners();

    // 部署 MockERC20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Test Token", "TEST", 18);
    await mockToken.deployed();

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

    // 给用户铸造代币
    await mockToken.mint(user.address, ethers.utils.parseEther("1000"));
    await mockToken.mint(escrowContract.address, ethers.utils.parseEther("100"));
  });

  describe("部署", function () {
    it("应该正确设置初始状态", async function () {
      expect(await escrowContract.owner()).to.equal(owner.address);
      expect(await escrowContract.permit2()).to.equal(mockPermit2.address);
    });
  });

  describe("操作员管理", function () {
    it("所有者可以注册操作员", async function () {
      await escrowContract.registerOperator(operator.address, "Test Operator");
      expect(await escrowContract.isOperator(operator.address)).to.be.true;
    });

    it("只有所有者可以注册操作员", async function () {
      try {
        await escrowContract.connect(user).registerOperator(operator.address, "Test Operator");
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("revert");
      }
    });
  });

  describe("代币管理", function () {
    it("所有者可以设置代币支持", async function () {
      await escrowContract.setTokenSupport(mockToken.address, true);
      expect(await escrowContract.supportedTokens(mockToken.address)).to.be.true;
    });

    it("只有所有者可以设置代币支持", async function () {
      try {
        await escrowContract.connect(user).setTokenSupport(mockToken.address, true);
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("revert");
      }
    });
  });

  describe("查询函数", function () {
    it("应该返回正确的用户nonce", async function () {
      const nonce = await escrowContract.getUserNonce(user.address);
      expect(nonce.toNumber()).to.equal(0);
    });
  });

  describe("暂停功能", function () {
    it("所有者可以暂停和恢复合约", async function () {
      await escrowContract.pause();
      expect(await escrowContract.paused()).to.be.true;
      
      await escrowContract.unpause();
      expect(await escrowContract.paused()).to.be.false;
    });

    it("只有所有者可以暂停合约", async function () {
      try {
        await escrowContract.connect(user).pause();
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("revert");
      }
    });
  });

  describe("紧急提取", function () {
    it("可以成功紧急提取代币", async function () {
      // 暂停合约
      await escrowContract.pause();
      
      const initialBalance = await mockToken.balanceOf(owner.address);
      
      // 紧急提取
      await escrowContract.emergencyWithdraw(
        mockToken.address,
        owner.address,
        ethers.utils.parseEther("50")
      );
      
      const finalBalance = await mockToken.balanceOf(owner.address);
      const expectedAmount = ethers.utils.parseEther("50");
      expect(finalBalance.sub(initialBalance).toString()).to.equal(expectedAmount.toString());
    });

    it("只有在暂停状态下才能紧急提取", async function () {
      try {
        await escrowContract.emergencyWithdraw(
          mockToken.address,
          owner.address,
          ethers.utils.parseEther("50")
        );
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("revert");
      }
    });

    it("只有所有者可以紧急提取", async function () {
      await escrowContract.pause();
      
      try {
        await escrowContract.connect(user).emergencyWithdraw(
          mockToken.address,
          owner.address,
          ethers.utils.parseEther("50")
        );
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("revert");
      }
    });
  });
});