# EscrowContract - 去中心化托管合约

基于Coinbase Commerce Payments Protocol的去中心化托管合约，为电商支付提供安全的资金托管服务，实现用户无Gas费的支付体验。

## 功能特性

### 核心功能
- **支付授权**: 使用EIP-712签名验证用户支付意图
- **Permit2集成**: 实现无Gas费的代币授权和转移
- **支付捕获**: 商家确认后将托管资金转给收款方
- **退款处理**: 支持手动退款和自动过期退款
- **操作员管理**: 灵活的权限管理系统

### 安全特性
- **重入保护**: 防止重入攻击
- **暂停机制**: 紧急情况下可暂停合约
- **访问控制**: 基于角色的权限管理
- **签名验证**: EIP-712结构化数据签名
- **过期保护**: 自动处理过期支付

## 合约架构

### 核心数据结构

```solidity
// 支付意图
struct PaymentIntent {
    address payer;      // 付款方
    address payee;      // 收款方
    address token;      // 代币地址
    uint256 amount;     // 支付金额
    uint256 expiryTime; // 过期时间
    bytes32 intentHash; // 意图哈希
    uint256 nonce;      // 防重放随机数
}

// 托管记录
struct EscrowRecord {
    address payer;      // 付款方
    address payee;      // 收款方
    address token;      // 代币地址
    uint256 amount;     // 托管金额
    uint256 createdAt;  // 创建时间
    uint256 expiryTime; // 过期时间
    Status status;      // 托管状态
    address operator;   // 操作员
}
```

### 状态枚举

```solidity
enum Status {
    NONE,       // 不存在
    AUTHORIZED, // 已授权
    CAPTURED,   // 已捕获
    REFUNDED,   // 已退款
    EXPIRED     // 已过期
}
```

## 主要函数

### 支付流程

1. **支付授权**
```solidity
function authorizePaymentWithPermit2(
    PaymentIntent calldata intent,
    bytes calldata intentSignature,
    IPermit2.PermitTransferFrom calldata permit,
    bytes calldata permitSignature
) external;
```

2. **支付捕获**
```solidity
function capturePayment(bytes32 intentHash) external;
```

3. **退款处理**
```solidity
function refundPayment(
    bytes32 intentHash,
    string calldata reason
) external;

function autoRefundExpired(bytes32 intentHash) external;
```

### 管理功能

```solidity
// 操作员管理
function registerOperator(address operator, string calldata name) external;
function removeOperator(address operator) external;

// 代币管理
function setTokenSupport(address token, bool supported) external;

// 紧急控制
function pause() external;
function unpause() external;
function emergencyWithdraw(address token, address to, uint256 amount) external;
```

## 部署和测试

### 安装依赖

```bash
npm install
```

### 编译合约

```bash
npx hardhat compile
```

### 运行测试

```bash
npx hardhat test
```

### 部署合约

```bash
# 本地测试网络
npx hardhat run scripts/deploy.js --network localhost

# 主网部署
npx hardhat run scripts/deploy.js --network mainnet
```

## 项目结构

```
contracts/
├── contracts/
│   ├── EscrowContract.sol      # 主合约
│   ├── interfaces/
│   │   └── IPermit2.sol        # Permit2接口
│   └── mocks/
│       ├── MockERC20.sol       # 测试用ERC20代币
│       └── MockPermit2.sol     # 测试用Permit2合约
├── scripts/
│   └── deploy.js               # 部署脚本
├── test/
│   └── EscrowContract.test.js  # 测试文件
└── README.md                   # 项目文档
```

## 许可证

MIT License
