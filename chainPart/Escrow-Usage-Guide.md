# Escrow 合约使用指南

## 概述

Escrow 合约是一个基于 ERC3009 标准的支付托管合约，实现了完整的支付生命周期管理，包括授权、收款、取消和退款功能。该合约为去中心化支付系统提供了安全、灵活的托管服务。

## 核心概念

### PaymentInfo 结构体
支付信息是所有操作的核心，包含以下字段：

```solidity
struct PaymentInfo {
    address operator;           // 负责驱动支付流程的实体
    address payer;             // 授权支付的付款人地址
    address receiver;          // 接收支付的地址(扣除费用后)
    address token;             // 代币合约地址
    uint120 maxAmount;         // 可以授权的代币数量
    uint48 preApprovalExpiry;  // 付款人预授权过期时间戳
    uint48 authorizationExpiry; // 授权可以被收款的过期时间戳
    uint48 refundExpiry;       // 成功支付可以被退款的过期时间戳
    uint16 minFeeBps;          // 最小费用百分比(基点)
    uint16 maxFeeBps;          // 最大费用百分比(基点)
    address feeReceiver;       // 接收费用的地址，如果为0则操作者可以在收款时设置
    uint256 salt;              // 熵源，确保不同支付的哈希唯一性
}
```

### PaymentState 结构体
跟踪支付的当前状态：

```solidity
struct PaymentState {
    bool hasCollectedPayment;    // 如果支付已被授权或收费则为true
    uint120 capturableAmount;    // 当前在托管中可以被收款的代币数量
    uint120 refundableAmount;    // 之前已收款可以被退款的代币数量
}
```

## 主要功能

### 1. 一步式支付 (charge)

**功能描述**: 直接从付款人转账到接收者，无需预先授权。

**使用场景**: 即时支付，类似于传统的信用卡收费。

**函数签名**:
```solidity
function charge(
    PaymentInfo calldata paymentInfo,
    uint256 amount,
    address tokenCollector,
    bytes calldata collectorData,
    uint16 feeBps,
    address feeReceiver
) external
```

**参数说明**:
- `paymentInfo`: 支付信息结构体
- `amount`: 要收费和收款的金额
- `tokenCollector`: 代币收集器地址（负责从付款人收集代币）
- `collectorData`: 传递给代币收集器的数据
- `feeBps`: 要应用的费用百分比（基点，1% = 100 bps）
- `feeReceiver`: 接收费用的地址

**使用示例**:
```javascript
const paymentInfo = {
    operator: operatorAddress,
    payer: payerAddress,
    receiver: receiverAddress,
    token: tokenAddress,
    maxAmount: ethers.parseUnits("1000", 6), // 1000 RMB
    preApprovalExpiry: Math.floor(Date.now() / 1000) + 3600, // 1小时后过期
    authorizationExpiry: Math.floor(Date.now() / 1000) + 7200, // 2小时后过期
    refundExpiry: Math.floor(Date.now() / 1000) + 86400, // 24小时后过期
    minFeeBps: 100, // 1%
    maxFeeBps: 500, // 5%
    feeReceiver: feeReceiverAddress,
    salt: ethers.randomBytes(32)
};

await escrow.charge(
    paymentInfo,
    ethers.parseUnits("100", 6), // 100 RMB
    tokenCollectorAddress,
    collectorData,
    250, // 2.5% 费用
    feeReceiverAddress
);
```

### 2. 授权支付 (authorize)

**功能描述**: 将资金从付款人转移到托管，但不立即转给接收者。

**使用场景**: 预授权支付，后续可以收款或取消。

**函数签名**:
```solidity
function authorize(
    PaymentInfo calldata paymentInfo,
    uint256 amount,
    address tokenCollector,
    bytes calldata collectorData
) external
```

**使用示例**:
```javascript
await escrow.authorize(
    paymentInfo,
    ethers.parseUnits("100", 6), // 授权100 RMB
    tokenCollectorAddress,
    collectorData
);
```

### 3. 收款 (capture)

**功能描述**: 将之前授权的资金转给接收者。

**使用场景**: 在授权后确认收款，完成支付流程。

**函数签名**:
```solidity
function capture(
    PaymentInfo calldata paymentInfo, 
    uint256 amount, 
    uint16 feeBps, 
    address feeReceiver
) external
```

**使用示例**:
```javascript
await escrow.capture(
    paymentInfo,
    ethers.parseUnits("80", 6), // 收款80 RMB（可以少于授权金额）
    250, // 2.5% 费用
    feeReceiverAddress
);
```

### 4. 取消授权 (void)

**功能描述**: 永久取消支付授权，将资金返还给付款人。

**使用场景**: 操作者主动取消未收款的授权。

**函数签名**:
```solidity
function void(PaymentInfo calldata paymentInfo) external
```

**使用示例**:
```javascript
await escrow.void(paymentInfo);
```

### 5. 回收资金 (reclaim)

**功能描述**: 付款人在授权过期后回收未被收款的资金。

**使用场景**: 授权过期后，付款人主动回收资金。

**函数签名**:
```solidity
function reclaim(PaymentInfo calldata paymentInfo) external
```

**使用示例**:
```javascript
// 只能由付款人调用，且在授权过期后
await escrow.connect(payer).reclaim(paymentInfo);
```

### 6. 退款 (refund)

**功能描述**: 将之前收款的代币返还给付款人。

**使用场景**: 商品退货或服务取消后的退款。

**函数签名**:
```solidity
function refund(
    PaymentInfo calldata paymentInfo,
    uint256 amount,
    address tokenCollector,
    bytes calldata collectorData
) external
```

**使用示例**:
```javascript
await escrow.refund(
    paymentInfo,
    ethers.parseUnits("50", 6), // 退款50 RMB
    tokenCollectorAddress,
    collectorData
);
```

## 工具函数

### 获取支付哈希
```solidity
function getHash(PaymentInfo calldata paymentInfo) public view returns (bytes32)
```

### 获取操作者的代币存储地址
```solidity
function getTokenStore(address operator) public view returns (address)
```

## 支付流程示例

### 流程1: 即时支付
```
1. 调用 charge() → 直接完成支付
```

### 流程2: 预授权支付
```
1. 调用 authorize() → 资金进入托管
2. 调用 capture() → 完成收款
3. 可选: 调用 refund() → 部分退款
```

### 流程3: 取消支付
```
1. 调用 authorize() → 资金进入托管
2. 调用 void() → 取消授权，返还资金
```

### 流程4: 过期回收
```
1. 调用 authorize() → 资金进入托管
2. 等待授权过期
3. 付款人调用 reclaim() → 回收资金
```

## 时间管理

合约使用三个时间戳来管理支付生命周期：

1. **preApprovalExpiry**: 预授权过期时间
   - 在此时间之前可以进行 authorize 或 charge 操作
   
2. **authorizationExpiry**: 授权过期时间
   - 在此时间之前可以进行 capture 操作
   - 在此时间之后付款人可以 reclaim 资金
   
3. **refundExpiry**: 退款过期时间
   - 在此时间之前可以进行 refund 操作

**时间关系**: `preApprovalExpiry ≤ authorizationExpiry ≤ refundExpiry`

## 费用管理

- 费用以基点（bps）表示，1% = 100 bps
- 最大费用不能超过 100%（10,000 bps）
- 每个支付可以设置最小和最大费用范围
- 实际费用必须在设定的范围内

## 安全特性

1. **重入保护**: 所有外部调用都有重入保护
2. **权限控制**: 只有指定的操作者或付款人可以调用相应函数
3. **金额验证**: 严格验证所有金额和时间参数
4. **状态管理**: 防止重复操作和无效状态转换

## 事件监听

合约会发出以下事件，便于前端监听：

- `PaymentCharged`: 一步式支付完成
- `PaymentAuthorized`: 支付授权完成
- `PaymentCaptured`: 收款完成
- `PaymentVoided`: 授权取消
- `PaymentReclaimed`: 资金回收
- `PaymentRefunded`: 退款完成
- `TokenStoreCreated`: 代币存储创建

## 错误处理

合约定义了详细的错误类型，帮助诊断问题：

- `InvalidSender`: 调用者权限错误
- `ZeroAmount`: 金额为零
- `AmountOverflow`: 金额溢出
- `ExceedsMaxAmount`: 超过最大金额
- `AfterPreApprovalExpiry`: 预授权已过期
- `PaymentAlreadyCollected`: 支付已被收集
- 等等...

## 最佳实践

1. **时间设置**: 合理设置三个过期时间，确保有足够的操作窗口
2. **费用范围**: 设置合理的费用范围，避免过高的费用
3. **金额管理**: 确保授权金额不超过付款人余额
4. **错误处理**: 在前端妥善处理各种错误情况
5. **事件监听**: 监听相关事件以更新UI状态
6. **测试**: 在主网部署前充分测试各种场景

## 集成示例

详细的集成示例请参考项目中的测试文件：
- `test/Escrow.test.js`: 单元测试
- `test/Escrow.functional.test.js`: 功能测试
- `scripts/demo-payment-flow.js`: 支付流程演示