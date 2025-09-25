const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RMBToken", function () {
  let rmbToken;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    
    const RMBToken = await ethers.getContractFactory("RMBToken");
    rmbToken = await RMBToken.deploy(
      "RMB Token",
      "RMB", 
      "CNY",
      owner.address
    );
    await rmbToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await rmbToken.owner()).to.equal(owner.address);
    });

    it("Should have correct name and symbol", async function () {
      expect(await rmbToken.name()).to.equal("RMB Token");
      expect(await rmbToken.symbol()).to.equal("RMB");
    });

    it("Should have 6 decimals", async function () {
      expect(await rmbToken.decimals()).to.equal(6);
    });

    it("Should have zero initial supply", async function () {
      const totalSupply = await rmbToken.totalSupply();
      expect(totalSupply.toString()).to.equal("0");
    });

    it("Should have correct currency", async function () {
      expect(await rmbToken.currency()).to.equal("CNY");
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const mintAmount = ethers.parseUnits("1000", 6);
      await rmbToken.mint(addr1.address, mintAmount);
      
      const balance = await rmbToken.balanceOf(addr1.address);
      const totalSupply = await rmbToken.totalSupply();
      
      expect(balance.toString()).to.equal(mintAmount.toString());
      expect(totalSupply.toString()).to.equal(mintAmount.toString());
    });

    it("Should not allow non-owner to mint tokens", async function () {
      const mintAmount = ethers.parseUnits("1000", 6);
      
      try {
        await rmbToken.connect(addr1).mint(addr2.address, mintAmount);
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("RMBToken: caller is not a minter");
      }
    });

    it("Should allow adding and removing minters", async function () {
      // Add minter
      await rmbToken.addMinter(addr1.address);
      expect(await rmbToken.minters(addr1.address)).to.be.true;
      
      // Minter should be able to mint
      const mintAmount = ethers.parseUnits("500", 6);
      await rmbToken.connect(addr1).mint(addr2.address, mintAmount);
      
      const balance = await rmbToken.balanceOf(addr2.address);
      expect(balance.toString()).to.equal(mintAmount.toString());
      
      // Remove minter
      await rmbToken.removeMinter(addr1.address);
      expect(await rmbToken.minters(addr1.address)).to.be.false;
      
      // Should not be able to mint anymore
      try {
        await rmbToken.connect(addr1).mint(addr2.address, mintAmount);
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("RMBToken: caller is not a minter");
      }
    });
  });

  describe("ERC20 Basic Functions", function () {
    beforeEach(async function () {
      // Mint some tokens for testing
      const mintAmount = ethers.parseUnits("1000", 6);
      await rmbToken.mint(owner.address, mintAmount);
    });

    it("Should transfer tokens between accounts", async function () {
      const transferAmount = ethers.parseUnits("100", 6);
      
      await rmbToken.transfer(addr1.address, transferAmount);
      
      const addr1Balance = await rmbToken.balanceOf(addr1.address);
      const ownerBalance = await rmbToken.balanceOf(owner.address);
      const expectedOwnerBalance = ethers.parseUnits("900", 6);
      
      expect(addr1Balance.toString()).to.equal(transferAmount.toString());
      expect(ownerBalance.toString()).to.equal(expectedOwnerBalance.toString());
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const transferAmount = ethers.parseUnits("2000", 6);
      
      try {
        await rmbToken.transfer(addr1.address, transferAmount);
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("transfer amount exceeds balance");
      }
    });

    it("Should approve and transferFrom", async function () {
      const approveAmount = ethers.parseUnits("100", 6);
      
      await rmbToken.approve(addr1.address, approveAmount);
      
      const allowance = await rmbToken.allowance(owner.address, addr1.address);
      expect(allowance.toString()).to.equal(approveAmount.toString());
      
      await rmbToken.connect(addr1).transferFrom(owner.address, addr2.address, approveAmount);
      
      const addr2Balance = await rmbToken.balanceOf(addr2.address);
      const newAllowance = await rmbToken.allowance(owner.address, addr1.address);
      
      expect(addr2Balance.toString()).to.equal(approveAmount.toString());
      expect(newAllowance.toString()).to.equal("0");
    });
  });

  describe("Pause Functionality", function () {
    beforeEach(async function () {
      const mintAmount = ethers.parseUnits("1000", 6);
      await rmbToken.mint(owner.address, mintAmount);
    });

    it("Should allow owner to pause and unpause", async function () {
      // Pause the contract
      await rmbToken.pause();
      expect(await rmbToken.paused()).to.be.true;
      
      // Should not be able to transfer when paused
      const transferAmount = ethers.parseUnits("100", 6);
      await expect(
        rmbToken.transfer(addr1.address, transferAmount)
      ).to.be.reverted;
      
      // Unpause the contract
      await rmbToken.unpause();
      expect(await rmbToken.paused()).to.be.false;
      
      // Should be able to transfer again
      await rmbToken.transfer(addr1.address, transferAmount);
      const balance = await rmbToken.balanceOf(addr1.address);
      expect(balance.toString()).to.equal(transferAmount.toString());
    });

    it("Should not allow non-owner to pause", async function () {
      await expect(
        rmbToken.connect(addr1).pause()
      ).to.be.reverted;
    });
  });

  describe("EIP-3009 Functionality", function () {
    beforeEach(async function () {
      const mintAmount = ethers.parseUnits("1000", 6);
      await rmbToken.mint(owner.address, mintAmount);
    });

    it("Should have DOMAIN_SEPARATOR function", async function () {
      const domainSeparator = await rmbToken.DOMAIN_SEPARATOR();
      expect(domainSeparator).to.not.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    });

    it("Should check authorization state", async function () {
      const nonce = ethers.randomBytes(32);
      const isUsed = await rmbToken.authorizationState(owner.address, nonce);
      expect(isUsed).to.be.false;
    });

    it("Should support receiveWithAuthorization function", async function () {
      const from = owner.address;
      const to = addr1.address;
      const value = ethers.parseUnits("100", 6);
      const validAfter = 0;
      const validBefore = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const nonce = ethers.randomBytes(32);
      
      const domain = {
        name: await rmbToken.name(),
        version: "1.0.0",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await rmbToken.getAddress()
      };
      
      const types = {
        ReceiveWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" }
        ]
      };
      
      const message = {
        from: from,
        to: to,
        value: value,
        validAfter: validAfter,
        validBefore: validBefore,
        nonce: nonce
      };
      
      const signature = await owner.signTypedData(domain, types, message);
      
      const initialFromBalance = await rmbToken.balanceOf(from);
      const initialToBalance = await rmbToken.balanceOf(to);
      
      await rmbToken.receiveWithAuthorization(
        from,
        to,
        value,
        validAfter,
        validBefore,
        nonce,
        signature
      );
      
      expect(await rmbToken.balanceOf(from)).to.equal(initialFromBalance - value);
      expect(await rmbToken.balanceOf(to)).to.equal(initialToBalance + value);
      expect(await rmbToken.authorizationState(from, nonce)).to.be.true;
    });

    it("Should reject expired authorization", async function () {
      const from = owner.address;
      const to = addr1.address;
      const value = ethers.parseUnits("100", 6);
      const validAfter = 0;
      const validBefore = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago (expired)
      const nonce = ethers.randomBytes(32);
      
      const domain = {
        name: await rmbToken.name(),
        version: "1.0.0",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await rmbToken.getAddress()
      };
      
      const types = {
        ReceiveWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" }
        ]
      };
      
      const message = {
        from: from,
        to: to,
        value: value,
        validAfter: validAfter,
        validBefore: validBefore,
        nonce: nonce
      };
      
      const signature = await owner.signTypedData(domain, types, message);
      
      await expect(
        rmbToken.receiveWithAuthorization(
          from,
          to,
          value,
          validAfter,
          validBefore,
          nonce,
          signature
        )
      ).to.be.revertedWithCustomError(rmbToken, "AuthorizationExpired");
    });

    it("Should reject reused authorization", async function () {
      const from = owner.address;
      const to = addr1.address;
      const value = ethers.parseUnits("50", 6);
      const validAfter = 0;
      const validBefore = Math.floor(Date.now() / 1000) + 3600;
      const nonce = ethers.randomBytes(32);
      
      const domain = {
        name: await rmbToken.name(),
        version: "1.0.0",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await rmbToken.getAddress()
      };
      
      const types = {
        ReceiveWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" }
        ]
      };
      
      const message = {
        from: from,
        to: to,
        value: value,
        validAfter: validAfter,
        validBefore: validBefore,
        nonce: nonce
      };
      
      const signature = await owner.signTypedData(domain, types, message);
      
      // First use should succeed
      await rmbToken.receiveWithAuthorization(
        from,
        to,
        value,
        validAfter,
        validBefore,
        nonce,
        signature
      );
      
      // Second use should fail
      await expect(
        rmbToken.receiveWithAuthorization(
          from,
          to,
          value,
          validAfter,
          validBefore,
          nonce,
          signature
        )
      ).to.be.revertedWithCustomError(rmbToken, "AuthorizationAlreadyUsed");
    });
  });

  describe("Permission Management", function () {
    it("Should allow owner to transfer ownership", async function () {
      // Transfer ownership to addr1
      await rmbToken.transferOwnership(addr1.address);
      
      // Check new owner
      expect(await rmbToken.owner()).to.equal(addr1.address);
      
      // Old owner should not be able to mint anymore
       const mintAmount = ethers.parseUnits("100", 6);
       try {
         await rmbToken.mint(addr2.address, mintAmount);
         expect.fail("Expected transaction to revert");
       } catch (error) {
         expect(error.message).to.include("caller is not a minter");
       }
      
      // New owner should be able to mint
      await rmbToken.connect(addr1).mint(addr2.address, mintAmount);
      const balance = await rmbToken.balanceOf(addr2.address);
      expect(balance.toString()).to.equal(mintAmount.toString());
    });

    it("Should not allow non-owner to transfer ownership", async function () {
      await expect(
        rmbToken.connect(addr1).transferOwnership(addr2.address)
      ).to.be.reverted;
    });

    it("Should allow owner to renounce ownership", async function () {
      await rmbToken.renounceOwnership();
      
      // Check that owner is now zero address
      expect(await rmbToken.owner()).to.equal("0x0000000000000000000000000000000000000000");
      
      // No one should be able to mint anymore
       const mintAmount = ethers.parseUnits("100", 6);
       try {
         await rmbToken.mint(addr1.address, mintAmount);
         expect.fail("Expected transaction to revert");
       } catch (error) {
         expect(error.message).to.include("caller is not a minter");
       }
    });

    it("Should not allow non-owner to add minters", async function () {
      await expect(
        rmbToken.connect(addr1).addMinter(addr2.address)
      ).to.be.reverted;
    });

    it("Should not allow non-owner to remove minters", async function () {
      // First add a minter as owner
      await rmbToken.addMinter(addr1.address);
      
      // Try to remove minter as non-owner
      await expect(
        rmbToken.connect(addr1).removeMinter(addr1.address)
      ).to.be.reverted;
    });

    it("Should prevent adding zero address as minter", async function () {
       try {
         await rmbToken.addMinter("0x0000000000000000000000000000000000000000");
         expect.fail("Expected transaction to revert");
       } catch (error) {
         expect(error.message).to.include("RMBToken: zero address");
       }
     });

    it("Should prevent adding existing minter", async function () {
      // Add minter first time
      await rmbToken.addMinter(addr1.address);
      
      // Try to add same minter again
      try {
        await rmbToken.addMinter(addr1.address);
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("RMBToken: address is already a minter");
      }
    });

    it("Should prevent removing non-existent minter", async function () {
      try {
        await rmbToken.removeMinter(addr1.address);
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("RMBToken: address is not a minter");
      }
    });
  });

  describe("Edge Cases and Error Conditions", function () {
    beforeEach(async function () {
      const mintAmount = ethers.parseUnits("1000", 6);
      await rmbToken.mint(owner.address, mintAmount);
    });

    it("Should reject zero amount transfers", async function () {
      try {
        await rmbToken.transfer(addr1.address, 0);
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("transfer amount must be greater than 0");
      }
    });

    it("Should reject zero amount transferFrom", async function () {
      const approveAmount = ethers.parseUnits("100", 6);
      await rmbToken.approve(addr1.address, approveAmount);
      
      try {
        await rmbToken.connect(addr1).transferFrom(owner.address, addr2.address, 0);
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("transfer amount must be greater than 0");
      }
    });

    it("Should reject transfers to zero address", async function () {
      const transferAmount = ethers.parseUnits("100", 6);
      
      try {
        await rmbToken.transfer("0x0000000000000000000000000000000000000000", transferAmount);
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("RMBToken: zero address");
      }
    });

    it("Should reject approve to zero address", async function () {
      const approveAmount = ethers.parseUnits("100", 6);
      
      try {
        await rmbToken.approve("0x0000000000000000000000000000000000000000", approveAmount);
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("RMBToken: zero address");
      }
    });

    it("Should reject minting to zero address", async function () {
      const mintAmount = ethers.parseUnits("100", 6);
      
      try {
        await rmbToken.mint("0x0000000000000000000000000000000000000000", mintAmount);
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("RMBToken: zero address");
      }
    });

    it("Should reject zero amount minting", async function () {
      try {
        await rmbToken.mint(addr1.address, 0);
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("RMBToken: mint amount must be greater than 0");
      }
    });

    it("Should handle maximum allowed mint amount", async function () {
       // Test with maximum allowed amount (1 million RMB)
       const maxAmount = ethers.parseUnits("1000000", 6); // 1 million RMB
       
       await rmbToken.mint(addr1.address, maxAmount);
       const balance = await rmbToken.balanceOf(addr1.address);
       expect(balance.toString()).to.equal(maxAmount.toString());
     });

     it("Should reject minting above maximum limit", async function () {
       // Test with amount exceeding the limit
       const excessiveAmount = ethers.parseUnits("1000001", 6); // 1 million + 1 RMB
       
       try {
         await rmbToken.mint(addr1.address, excessiveAmount);
         expect.fail("Expected transaction to revert");
       } catch (error) {
         expect(error.message).to.include("mint amount exceeds maximum limit");
       }
     });

    it("Should maintain precision with 6 decimals", async function () {
      // Test fractional amounts
      const fractionalAmount = "123456"; // 0.123456 RMB
      
      await rmbToken.mint(addr1.address, fractionalAmount);
      const balance = await rmbToken.balanceOf(addr1.address);
      expect(balance.toString()).to.equal(fractionalAmount);
    });

    it("Should prevent operations when paused", async function () {
      await rmbToken.pause();
      
      const transferAmount = ethers.parseUnits("100", 6);
      
      // Test transfer
      await expect(
        rmbToken.transfer(addr1.address, transferAmount)
      ).to.be.reverted;
      
      // Test approve
      await expect(
        rmbToken.approve(addr1.address, transferAmount)
      ).to.be.reverted;
      
      // Test mint
      await expect(
        rmbToken.mint(addr1.address, transferAmount)
      ).to.be.reverted;
    });

    it("Should handle multiple consecutive operations", async function () {
      const amount = ethers.parseUnits("100", 6);
      
      // Multiple transfers
      await rmbToken.transfer(addr1.address, amount);
      await rmbToken.transfer(addr2.address, amount);
      
      const balance1 = await rmbToken.balanceOf(addr1.address);
      const balance2 = await rmbToken.balanceOf(addr2.address);
      
      expect(balance1.toString()).to.equal(amount.toString());
      expect(balance2.toString()).to.equal(amount.toString());
    });
  });

  describe("Integration Test - Coffee Purchase Scenario", function () {
    let customer, merchant, platform;
    
    beforeEach(async function () {
      [, customer, merchant, platform] = await ethers.getSigners();
      
      // Setup: Mint some RMB tokens to customer
      const initialAmount = ethers.parseUnits("1000", 6); // 1000 RMB
      await rmbToken.mint(customer.address, initialAmount);
    });
    
    it("Should complete a coffee purchase transaction", async function () {
      const coffeePrice = ethers.parseUnits("25", 6); // 25 RMB for coffee
       const platformFee = ethers.parseUnits("1", 6); // 1 RMB platform fee
      
      // Customer approves merchant to spend tokens
      await rmbToken.connect(customer).approve(merchant.address, coffeePrice + platformFee);
      
      // Merchant processes payment (coffee + platform fee)
      await rmbToken.connect(merchant).transferFrom(customer.address, merchant.address, coffeePrice);
      await rmbToken.connect(merchant).transferFrom(customer.address, platform.address, platformFee);
      
      // Verify balances
      const customerBalance = await rmbToken.balanceOf(customer.address);
      const merchantBalance = await rmbToken.balanceOf(merchant.address);
      const platformBalance = await rmbToken.balanceOf(platform.address);
      
      expect(customerBalance.toString()).to.equal(ethers.parseUnits("974", 6).toString()); // 1000 - 25 - 1
       expect(merchantBalance.toString()).to.equal(coffeePrice.toString());
       expect(platformBalance.toString()).to.equal(platformFee.toString());
    });
    
    it("Should handle insufficient balance scenario", async function () {
      const expensiveCoffee = ethers.parseUnits("1500", 6); // 1500 RMB (more than customer has)
      
      await rmbToken.connect(customer).approve(merchant.address, expensiveCoffee);
      
      try {
        await rmbToken.connect(merchant).transferFrom(customer.address, merchant.address, expensiveCoffee);
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("transfer amount exceeds balance");
      }
    });
    
    it("Should handle multiple coffee purchases", async function () {
      const coffeePrice = ethers.parseUnits("20", 6); // 20 RMB per coffee
      const numCoffees = 3;
      
      // Approve total amount for multiple purchases
      const totalAmount = coffeePrice * BigInt(numCoffees);
      await rmbToken.connect(customer).approve(merchant.address, totalAmount);
      
      // Process multiple purchases
      for (let i = 0; i < numCoffees; i++) {
        await rmbToken.connect(merchant).transferFrom(customer.address, merchant.address, coffeePrice);
      }
      
      // Verify final balances
      const customerBalance = await rmbToken.balanceOf(customer.address);
      const merchantBalance = await rmbToken.balanceOf(merchant.address);
      
      expect(customerBalance.toString()).to.equal(ethers.parseUnits("940", 6).toString()); // 1000 - 60
       expect(merchantBalance.toString()).to.equal(totalAmount.toString());
    });
    
    it("Should prevent transactions when paused", async function () {
       const coffeePrice = ethers.parseUnits("25", 6);
       
       // First approve before pausing
       await rmbToken.connect(customer).approve(merchant.address, coffeePrice);
       
       // Then pause the contract
       await rmbToken.pause();
       
       await expect(
         rmbToken.connect(merchant).transferFrom(customer.address, merchant.address, coffeePrice)
       ).to.be.reverted;
     });
  });

  describe("Multi-User Interaction Scenarios", function () {
    let user1, user2, user3, minter1, minter2;
    
    beforeEach(async function () {
      [, user1, user2, user3, minter1, minter2] = await ethers.getSigners();
      
      // Add multiple minters
      await rmbToken.addMinter(minter1.address);
      await rmbToken.addMinter(minter2.address);
      
      // Mint tokens to users
      await rmbToken.connect(minter1).mint(user1.address, ethers.parseUnits("500", 6));
      await rmbToken.connect(minter2).mint(user2.address, ethers.parseUnits("300", 6));
      await rmbToken.connect(minter1).mint(user3.address, ethers.parseUnits("200", 6));
    });
    
    it("Should handle complex multi-party transactions", async function () {
      const amount1 = ethers.parseUnits("50", 6);
      const amount2 = ethers.parseUnits("30", 6);
      const amount3 = ethers.parseUnits("20", 6);
      
      // User1 sends to User2
      await rmbToken.connect(user1).transfer(user2.address, amount1);
      
      // User2 sends to User3
      await rmbToken.connect(user2).transfer(user3.address, amount2);
      
      // User3 sends back to User1
      await rmbToken.connect(user3).transfer(user1.address, amount3);
      
      // Verify final balances
      const balance1 = await rmbToken.balanceOf(user1.address);
      const balance2 = await rmbToken.balanceOf(user2.address);
      const balance3 = await rmbToken.balanceOf(user3.address);
      
      expect(balance1.toString()).to.equal(ethers.parseUnits("470", 6).toString()); // 500 - 50 + 20
      expect(balance2.toString()).to.equal(ethers.parseUnits("320", 6).toString()); // 300 + 50 - 30
      expect(balance3.toString()).to.equal(ethers.parseUnits("210", 6).toString()); // 200 + 30 - 20
    });
    
    it("Should handle multiple minters working simultaneously", async function () {
      const mintAmount = ethers.parseUnits("100", 6);
      
      // Both minters mint to different users
      await rmbToken.connect(minter1).mint(user1.address, mintAmount);
      await rmbToken.connect(minter2).mint(user2.address, mintAmount);
      
      // Verify balances increased
      const balance1 = await rmbToken.balanceOf(user1.address);
      const balance2 = await rmbToken.balanceOf(user2.address);
      
      expect(balance1.toString()).to.equal(ethers.parseUnits("600", 6).toString()); // 500 + 100
      expect(balance2.toString()).to.equal(ethers.parseUnits("400", 6).toString()); // 300 + 100
    });
    
    it("Should handle allowance delegation chain", async function () {
      const allowanceAmount = ethers.parseUnits("100", 6);
      const transferAmount = ethers.parseUnits("40", 6);
      
      // User1 allows User2 to spend
      await rmbToken.connect(user1).approve(user2.address, allowanceAmount);
      
      // User2 allows User3 to spend from User2's own balance
      await rmbToken.connect(user2).approve(user3.address, allowanceAmount);
      
      // User2 transfers from User1 to User3
      await rmbToken.connect(user2).transferFrom(user1.address, user3.address, transferAmount);
      
      // User3 transfers from User2 to User1
      await rmbToken.connect(user3).transferFrom(user2.address, user1.address, transferAmount);
      
      // Verify balances
      const balance1 = await rmbToken.balanceOf(user1.address);
      const balance2 = await rmbToken.balanceOf(user2.address);
      const balance3 = await rmbToken.balanceOf(user3.address);
      
      expect(balance1.toString()).to.equal(ethers.parseUnits("500", 6).toString()); // 500 - 40 + 40
      expect(balance2.toString()).to.equal(ethers.parseUnits("260", 6).toString()); // 300 - 40
      expect(balance3.toString()).to.equal(ethers.parseUnits("240", 6).toString()); // 200 + 40
    });
    
    it("Should handle minter removal and re-addition", async function () {
      const mintAmount = ethers.parseUnits("50", 6);
      
      // Remove minter1
      await rmbToken.removeMinter(minter1.address);
      
      // minter1 should not be able to mint
      try {
        await rmbToken.connect(minter1).mint(user1.address, mintAmount);
        expect.fail("Expected transaction to revert");
      } catch (error) {
        expect(error.message).to.include("caller is not a minter");
      }
      
      // minter2 should still be able to mint
      await rmbToken.connect(minter2).mint(user2.address, mintAmount);
      
      // Re-add minter1
      await rmbToken.addMinter(minter1.address);
      
      // minter1 should be able to mint again
      await rmbToken.connect(minter1).mint(user3.address, mintAmount);
      
      // Verify balances
      const balance2 = await rmbToken.balanceOf(user2.address);
      const balance3 = await rmbToken.balanceOf(user3.address);
      
      expect(balance2.toString()).to.equal(ethers.parseUnits("350", 6).toString()); // 300 + 50
      expect(balance3.toString()).to.equal(ethers.parseUnits("250", 6).toString()); // 200 + 50
    });
    
    it("Should handle concurrent operations under stress", async function () {
      const operations = [];
      const amount = ethers.parseUnits("10", 6);
      
      // Create multiple concurrent operations
      operations.push(rmbToken.connect(user1).transfer(user2.address, amount));
      operations.push(rmbToken.connect(user2).transfer(user3.address, amount));
      operations.push(rmbToken.connect(user3).transfer(user1.address, amount));
      operations.push(rmbToken.connect(minter1).mint(user1.address, amount));
      operations.push(rmbToken.connect(minter2).mint(user2.address, amount));
      
      // Execute all operations concurrently
      await Promise.all(operations);
      
      // Verify total supply increased by minted amounts
      const totalSupply = await rmbToken.totalSupply();
      const expectedSupply = ethers.parseUnits("1020", 6); // 1000 initial + 20 minted
      expect(totalSupply.toString()).to.equal(expectedSupply.toString());
    });
  });

  describe("Query Functions", function () {
    it("Should return domain separator", async function () {
      const domainSeparator = await rmbToken.DOMAIN_SEPARATOR();
      expect(domainSeparator).to.not.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    });
  });

  describe("Gas Optimization Tests", function () {
    beforeEach(async function () {
      const mintAmount = ethers.parseUnits("1000", 6);
      await rmbToken.mint(owner.address, mintAmount);
    });

    it("Should have efficient deployment gas usage", async function () {
       const RMBToken = await ethers.getContractFactory("RMBToken");
       const deployTx = await RMBToken.deploy(
         "RMB Token",
         "RMB", 
         "CNY",
         owner.address
       );
       const receipt = await deployTx.deploymentTransaction().wait();
       
       // Deployment should use reasonable gas (less than 5M gas)
       expect(Number(receipt.gasUsed)).to.be.lessThan(5000000);
       console.log(`Deployment gas used: ${receipt.gasUsed}`);
     });

    it("Should have efficient transfer gas usage", async function () {
      const transferAmount = ethers.parseUnits("100", 6);
      
      const tx = await rmbToken.transfer(addr1.address, transferAmount);
      const receipt = await tx.wait();
      
      // Transfer should use reasonable gas (less than 100k gas)
      expect(Number(receipt.gasUsed)).to.be.lessThan(100000);
    });

    it("Should have efficient mint gas usage", async function () {
      const mintAmount = ethers.parseUnits("100", 6);
      
      const tx = await rmbToken.mint(addr1.address, mintAmount);
      const receipt = await tx.wait();
      
      // Mint should use reasonable gas (less than 150k gas)
      expect(Number(receipt.gasUsed)).to.be.lessThan(150000);
    });

    it("Should have efficient approve gas usage", async function () {
      const approveAmount = ethers.parseUnits("100", 6);
      
      const tx = await rmbToken.approve(addr1.address, approveAmount);
      const receipt = await tx.wait();
      
      // Approve should use reasonable gas (less than 80k gas)
      expect(Number(receipt.gasUsed)).to.be.lessThan(80000);
    });

    it("Should have efficient pause/unpause gas usage", async function () {
        const pauseTx = await rmbToken.pause();
        const pauseReceipt = await pauseTx.wait();
        
        const unpauseTx = await rmbToken.unpause();
        const unpauseReceipt = await unpauseTx.wait();
        
        // Pause/unpause should use reasonable gas (less than 80k gas each)
        expect(Number(pauseReceipt.gasUsed)).to.be.lessThan(80000);
        expect(Number(unpauseReceipt.gasUsed)).to.be.lessThan(80000);
        console.log(`Pause gas used: ${pauseReceipt.gasUsed}`);
        console.log(`Unpause gas used: ${unpauseReceipt.gasUsed}`);
      });
  });
});