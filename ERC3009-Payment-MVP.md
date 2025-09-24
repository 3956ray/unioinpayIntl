# ERC3009支付MVP实现指南

本文档提供了基于ERC3009标准实现最小可行产品(MVP)支付系统的详细指南。该系统利用Coinbase的`commerce-payments`合约框架，专注于ERC3009支付路径。

## 目录

- [所需合约](#所需合约)
- [依赖关系](#依赖关系)
- [支付流程](#支付流程)
- [实现步骤](#实现步骤)
- [部署指南](#部署指南)
- [集成示例](#集成示例)

## 所需合约

### 核心合约

1. **Escrow.sol**
   - 主要托管合约，负责整个支付流程管理
   - 实现授权(authorize)、收款(capture)、取消(void)和退款(refund)功能
   - 为每个操作者创建TokenStore实例

2. **ERC3009PaymentCollector.sol**
   - 实现ERC3009代币收集功能
   - 处理receiveWithAuthorization签名
   - 支持智能合约钱包签名(ERC6492)

3. **TokenStore.sol**
   - 为每个操作者存储代币的合约
   - 使用CREATE2确保地址确定性
   - 只允许Escrow调用其sendTokens函数

### 辅助合约和接口

1. **TokenCollector.sol**
   - 抽象基类，定义代币收集器接口
   - 提供collectTokens函数和CollectorType枚举

2. **ERC6492SignatureHandler.sol**
   - 处理智能合约钱包的签名
   - 支持尚未部署的合约签名验证

3. **IERC3009.sol**
   - ERC3009标准接口
   - 定义receiveWithAuthorization函数

## 依赖关系

### 外部库

1. **OpenZeppelin**
   - SafeERC20和IERC20：安全的ERC20代币操作
   
2. **Solady**
   - ReentrancyGuardTransient：防止重入攻击
   - LibClone：高效的合约克隆功能

### 代币要求

- 必须支持ERC3009标准的代币（如USDC）
- 代币必须实现receiveWithAuthorization函数

## 支付流程

### 授权流程

1. **用户签名**
   - 用户使用私钥签署ERC3009 receiveWithAuthorization消息
   - 签名包含：金额、有效期、接收者地址和唯一nonce

2. **授权(Authorize)**
   - 操作者调用Escrow.authorize()
   - 传入支付信息、金额、ERC3009PaymentCollector地址和签名数据
   - 代币从用户钱包转移到TokenStore

3. **收款(Capture)**
   - 操作者调用Escrow.capture()
   - 代币从TokenStore转移到接收者地址
   - 可选择收取费用

### 一步式支付流程

1. **收费(Charge)**
   - 操作者调用Escrow.charge()
   - 结合授权和收款步骤为一体
   - 代币直接从用户钱包转移到接收者地址

### 取消和退款流程

1. **取消(Void)**
   - 操作者可以在收款前取消授权
   - 代币返回给用户

2. **退款(Refund)**
   - 操作者可以在退款期限内退款
   - 需要使用OperatorRefundCollector

## 实现步骤

### 1. 合约部署

```javascript
// 部署Escrow
const Escrow = await Escrow.deploy();

// 部署ERC3009PaymentCollector
const multicall3Address = "0xcA11bde05977b3631167028862bE2a173976CA11"; // Base链上的Multicall3地址
const erc3009PaymentCollector = await ERC3009PaymentCollector.deploy(
  Escrow.address,
  multicall3Address
);
```

### 2. 前端签名生成

```javascript
// 生成ERC3009签名
async function generateERC3009Signature(signer, paymentInfo) {
  const domain = {
    name: "USD Coin",
    version: "2",
    chainId: await signer.getChainId(),
    verifyingContract: paymentInfo.token
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
  
  const value = {
    from: paymentInfo.payer,
    to: erc3009PaymentCollector.address,
    value: paymentInfo.maxAmount,
    validAfter: 0,
    validBefore: paymentInfo.preApprovalExpiry,
    nonce: ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["uint256", "address", "bytes32"],
        [await signer.getChainId(), Escrow.address, paymentInfoHash]
      )
    )
  };
  
  return signer._signTypedData(domain, types, value);
}
```

### 3. 调用授权函数

```javascript
// 创建PaymentInfo对象
const paymentInfo = {
  operator: operatorAddress,
  payer: payerAddress,
  receiver: receiverAddress,
  token: usdcAddress,
  maxAmount: ethers.utils.parseUnits("100", 6), // 100 USDC
  preApprovalExpiry: Math.floor(Date.now() / 1000) + 3600, // 1小时后过期
  authorizationExpiry: Math.floor(Date.now() / 1000) + 86400, // 24小时后过期
  refundExpiry: Math.floor(Date.now() / 1000) + 604800, // 7天后过期
  minFeeBps: 0,
  maxFeeBps: 100, // 最高1%费用
  feeReceiver: feeReceiverAddress,
  salt: ethers.BigNumber.from(ethers.utils.randomBytes(32))
};

// 获取签名
const signature = await generateERC3009Signature(signer, paymentInfo);

// 调用authorize函数
await Escrow.authorize(
  paymentInfo,
  ethers.utils.parseUnits("100", 6), // 授权100 USDC
  erc3009PaymentCollector.address,
  signature
);
```

### 4. 调用收款函数

```javascript
// 调用capture函数
await Escrow.capture(
  paymentInfo,
  ethers.utils.parseUnits("100", 6), // 收款100 USDC
  50, // 0.5%费用
  feeReceiverAddress
);
```

## 部署指南

### 测试网部署

1. 确保使用支持ERC3009的USDC测试代币
2. 部署顺序：
   - 首先部署Escrow
   - 然后部署ERC3009PaymentCollector，传入Escrow地址

### 主网部署

1. 使用多签钱包部署合约以增强安全性
2. 确保使用正确的Multicall3地址
3. 进行全面的安全审计

## 集成示例

### 后端集成

```javascript
// 示例：创建支付请求
async function createPayment(amount, payerAddress, receiverAddress) {
  const paymentInfo = {
    operator: operatorAddress,
    payer: payerAddress,
    receiver: receiverAddress,
    token: usdcAddress,
    maxAmount: amount,
    preApprovalExpiry: Math.floor(Date.now() / 1000) + 3600,
    authorizationExpiry: Math.floor(Date.now() / 1000) + 86400,
    refundExpiry: Math.floor(Date.now() / 1000) + 604800,
    minFeeBps: 0,
    maxFeeBps: 100,
    feeReceiver: feeReceiverAddress,
    salt: ethers.BigNumber.from(ethers.utils.randomBytes(32))
  };
  
  // 存储paymentInfo以便后续使用
  return paymentInfo;
}
```

### 前端集成

```javascript
// 示例：用户签名授权
async function signPayment(paymentInfo) {
  // 连接用户钱包
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = provider.getSigner();
  
  // 生成签名
  const signature = await generateERC3009Signature(signer, paymentInfo);
  
  // 将签名发送到后端
  return signature;
}
```

---

## 注意事项

1. 确保所有时间戳和金额计算正确
2. 实现适当的错误处理和异常情况
3. 考虑gas优化，特别是在高网络拥堵时期
4. 实现监控系统跟踪支付状态
5. 定期审计合约安全性

## 参考资源

- [ERC3009标准](https://eips.ethereum.org/EIPS/eip-3009)
- [Coinbase Commerce Payments](https://github.com/base/commerce-payments)
- [USDC文档](https://developers.circle.com/stablecoins/docs)