import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { RMBTokenV1 } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("RMBTokenV1", function () {
  let rmbToken: RMBTokenV1;
  let owner: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let blacklister: HardhatEthersSigner;

  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const BLACKLISTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BLACKLISTER_ROLE"));
  const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));
  const BURNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BURNER_ROLE"));

  beforeEach(async function () {
    [owner, minter, user1, user2, blacklister] = await ethers.getSigners();

    const RMBTokenV1Factory = await ethers.getContractFactory("RMBTokenV1");
    rmbToken = await upgrades.deployProxy(
      RMBTokenV1Factory,
      [owner.address, "RMB Stablecoin", "RMB"],
      { initializer: "initialize", kind: "uups" }
    ) as unknown as RMBTokenV1;

    await rmbToken.waitForDeployment();

    // 设置角色
    await rmbToken.grantRole(MINTER_ROLE, minter.address);
    await rmbToken.grantRole(BLACKLISTER_ROLE, blacklister.address);
    await rmbToken.grantRole(PAUSER_ROLE, owner.address);
    await rmbToken.grantRole(BURNER_ROLE, owner.address);
  });

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      expect(await rmbToken.name()).to.equal("RMB Stablecoin");
      expect(await rmbToken.symbol()).to.equal("RMB");
    });

    it("Should set the right decimals", async function () {
      expect(await rmbToken.decimals()).to.equal(6);
    });

    it("Should set the right admin", async function () {
      const DEFAULT_ADMIN_ROLE = await rmbToken.DEFAULT_ADMIN_ROLE();
      expect(await rmbToken.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should return correct version", async function () {
      expect(await rmbToken.version()).to.equal("1.0.0");
    });
  });

  describe("Minting", function () {
    it("Should allow minter to mint tokens", async function () {
      const amount = ethers.parseUnits("1000", 6);
      await expect(rmbToken.connect(minter).mint(user1.address, amount))
        .to.emit(rmbToken, "Mint")
        .withArgs(user1.address, amount);

      expect(await rmbToken.balanceOf(user1.address)).to.equal(amount);
      expect(await rmbToken.totalSupply()).to.equal(amount);
    });

    it("Should not allow non-minter to mint tokens", async function () {
      const amount = ethers.parseUnits("1000", 6);
      await expect(
        rmbToken.connect(user1).mint(user2.address, amount)
      ).to.be.revertedWithCustomError(rmbToken, "AccessControlUnauthorizedAccount");
    });

    it("Should not mint to blacklisted address", async function () {
      await rmbToken.connect(blacklister).setBlacklisted(user1.address, true);
      const amount = ethers.parseUnits("1000", 6);
      
      await expect(
        rmbToken.connect(minter).mint(user1.address, amount)
      ).to.be.revertedWith("RMB: recipient is blacklisted");
    });

    it("Should respect max supply when enabled", async function () {
      const maxSupply = ethers.parseUnits("1000", 6);
      await rmbToken.setMaxSupply(maxSupply);
      await rmbToken.toggleSupplyCap(true);

      const amount = ethers.parseUnits("1001", 6);
      await expect(
        rmbToken.connect(minter).mint(user1.address, amount)
      ).to.be.revertedWith("RMB: mint would exceed max supply");
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      const amount = ethers.parseUnits("1000", 6);
      await rmbToken.connect(minter).mint(user1.address, amount);
    });

    it("Should allow user to burn their own tokens", async function () {
      const burnAmount = ethers.parseUnits("100", 6);
      await expect(rmbToken.connect(user1).burn(burnAmount))
        .to.emit(rmbToken, "Burn")
        .withArgs(user1.address, burnAmount);

      expect(await rmbToken.balanceOf(user1.address)).to.equal(
        ethers.parseUnits("900", 6)
      );
    });

    it("Should allow burner to burn from any address", async function () {
      const burnAmount = ethers.parseUnits("100", 6);
      await expect(rmbToken.connect(owner).burnFromAddress(user1.address, burnAmount))
        .to.emit(rmbToken, "Burn")
        .withArgs(user1.address, burnAmount);

      expect(await rmbToken.balanceOf(user1.address)).to.equal(
        ethers.parseUnits("900", 6)
      );
    });
  });

  describe("Blacklist", function () {
    it("Should allow blacklister to blacklist addresses", async function () {
      await expect(rmbToken.connect(blacklister).setBlacklisted(user1.address, true))
        .to.emit(rmbToken, "Blacklisted")
        .withArgs(user1.address, true);

      expect(await rmbToken.isBlacklisted(user1.address)).to.be.true;
    });

    it("Should allow batch blacklisting", async function () {
      const addresses = [user1.address, user2.address];
      await rmbToken.connect(blacklister).setBlacklistedBatch(addresses, true);

      expect(await rmbToken.isBlacklisted(user1.address)).to.be.true;
      expect(await rmbToken.isBlacklisted(user2.address)).to.be.true;
    });

    it("Should prevent blacklisted addresses from transferring", async function () {
      const amount = ethers.parseUnits("1000", 6);
      await rmbToken.connect(minter).mint(user1.address, amount);
      await rmbToken.connect(blacklister).setBlacklisted(user1.address, true);

      await expect(
        rmbToken.connect(user1).transfer(user2.address, amount)
      ).to.be.revertedWith("RMB: sender is blacklisted");
    });
  });

  describe("Pause", function () {
    it("Should allow pauser to pause the contract", async function () {
      await rmbToken.connect(owner).pause();
      expect(await rmbToken.paused()).to.be.true;
    });

    it("Should prevent transfers when paused", async function () {
      const amount = ethers.parseUnits("1000", 6);
      await rmbToken.connect(minter).mint(user1.address, amount);
      await rmbToken.connect(owner).pause();

      await expect(
        rmbToken.connect(user1).transfer(user2.address, amount)
      ).to.be.revertedWithCustomError(rmbToken, "EnforcedPause");
    });
  });

  describe("Supply Control", function () {
    it("Should allow admin to set max supply", async function () {
      const maxSupply = ethers.parseUnits("1000000", 6);
      await expect(rmbToken.setMaxSupply(maxSupply))
        .to.emit(rmbToken, "MaxSupplyUpdated")
        .withArgs(0, maxSupply);

      expect(await rmbToken.maxSupply()).to.equal(maxSupply);
    });

    it("Should allow admin to toggle supply cap", async function () {
      await expect(rmbToken.toggleSupplyCap(true))
        .to.emit(rmbToken, "SupplyCapToggled")
        .withArgs(true);

      expect(await rmbToken.supplyCapEnabled()).to.be.true;
    });
  });

  describe("Contract Info", function () {
    it("Should return correct contract information", async function () {
      const info = await rmbToken.getContractInfo();
      expect(info[0]).to.equal("RMB Stablecoin"); // name
      expect(info[1]).to.equal("RMB"); // symbol
      expect(info[2]).to.equal(6); // decimals
      expect(info[3]).to.equal(0); // totalSupply
      expect(info[4]).to.equal(0); // maxSupply
      expect(info[5]).to.equal(false); // supplyCapEnabled
      expect(info[6]).to.equal("1.0.0"); // version
    });
  });
});