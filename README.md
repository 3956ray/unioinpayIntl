# unioinpayIntl

## 项目概述

unioinpayIntl 是一个基于以太坊的去中心化支付托管系统，为电商平台提供安全、高效的支付解决方案。项目包含两个核心智能合约：RMBToken（数字人民币代币）和 EscrowContract（托管合约）。

## 核心合约

### RMBToken 合约

**文件**: `/contracts/contracts/RMBToken.sol`

**功能简介**:
- 基于 ERC20 标准的数字人民币代币实现
- 支持 EIP-2612 Permit 功能，实现无 Gas 费授权
- 集成 Permit2 兼容性，提供更安全的授权机制
- 实现货币类型标识（CNY）和完整的代币元数据
- 提供铸造、销毁等管理功能
- 支持暂停/恢复机制，确保紧急情况下的安全控制

**主要特性**:
- 代币名称：RMB Token
- 代币符号：RMB
- 小数位数：18
- 货币类型：CNY（人民币）
- 支持 Permit 和 Permit2 授权
- 完整的访问控制和安全机制

### EscrowContract 合约

**文件**: `/contracts/contracts/EscrowContract.sol`

**功能简介**:
- 基于 Coinbase Commerce Payments Protocol 的去中心化托管合约
- 为电商支付提供安全的资金托管服务
- 实现用户无 Gas 费的支付体验
- 支持 EIP-712 签名验证和 Permit2 授权
- 提供完整的支付生命周期管理

**核心功能**:

1. **支付授权** (`authorizePaymentWithPermit2`)
   - 使用 Permit2 实现无 Gas 费代币授权
   - EIP-712 签名验证确保支付意图真实性
   - 资金安全托管到合约中
   - 防重放攻击机制

2. **支付捕获** (`capturePayment`)
   - 商家确认收货后释放资金
   - 只有授权操作员可执行
   - 资金直接转移给收款方

3. **退款处理** (`refundPayment`)
   - 支持主动退款和自动退款
   - 过期支付自动退回付款方
   - 完整的退款原因记录

4. **操作员管理**
   - 多操作员权限控制
   - 操作员注册和移除
   - 权限验证机制

5. **安全机制**
   - 重入攻击防护
   - 紧急暂停功能
   - 代币白名单管理
   - 紧急提取功能

**数据结构**:
- `PaymentIntent`: 支付意图结构体
- `EscrowRecord`: 托管记录结构体
- `Status`: 托管状态枚举（NONE, AUTHORIZED, CAPTURED, REFUNDED, EXPIRED）

## 部署指南

### 环境要求

```bash
# Node.js 版本要求
node >= 16.0.0
npm >= 8.0.0

# 安装依赖
cd contracts
npm install
```

### 本地部署

1. **启动本地 Hardhat 网络**
```bash
cd contracts
npx hardhat node
```

2. **部署 EscrowContract**
```bash
# 在新终端中执行
cd contracts
npx hardhat run scripts/deploy.js --network localhost
```

3. **部署 RMBToken**
```bash
cd contracts
npx hardhat run scripts/deploy-rmb-token.js --network localhost
```

4. **配置代币支持**
```bash
# 设置环境变量（使用实际部署地址）
export RMB_TOKEN_ADDRESS="0x..."
export ESCROW_CONTRACT_ADDRESS="0x..."

# 配置 EscrowContract 支持 RMBToken
npx hardhat run scripts/setup-rmb-token.js --network localhost
```

### 部署脚本说明

- `deploy.js`: 部署 EscrowContract 主合约
- `deploy-rmb-token.js`: 部署 RMBToken 代币合约
- `setup-rmb-token.js`: 配置合约间的集成关系
- `demo-payment-flow.js`: 完整支付流程演示

## 测试指南

### 运行所有测试

```bash
cd contracts

# 运行完整测试套件
npx hardhat test --network localhost

# 运行特定测试文件
npx hardhat test test/EscrowContract.test.js --network localhost
npx hardhat test test/RMBToken.test.js --network localhost
npx hardhat test test/EscrowContract-RMBToken-Integration.test.js --network localhost
```

### 测试覆盖范围

**EscrowContract 测试** (63个测试用例):
- 合约部署和初始化
- EIP-712 签名验证
- Permit2 集成测试
- 支付授权流程
- 支付捕获功能
- 退款机制测试
- 操作员管理
- 安全机制验证
- Gas 消耗优化

**RMBToken 测试**:
- ERC20 标准功能
- Permit 功能测试
- Permit2 兼容性
- 访问控制测试
- 安全机制验证

**集成测试** (17个测试用例):
- 完整支付流程
- 合约间交互
- 端到端场景测试
- 错误处理验证

### 性能指标

- **支付授权**: < 150k Gas
- **支付捕获**: < 80k Gas  
- **退款处理**: < 80k Gas
- **测试覆盖率**: > 95%

## 演示和使用

### 运行完整演示

```bash
cd contracts

# 确保本地网络运行中
npx hardhat node

# 在新终端运行演示
npx hardhat run scripts/demo-payment-flow.js --network localhost
```

演示脚本将展示：
1. 合约部署和配置
2. 代币铸造和分发
3. 商家注册流程
4. 完整支付流程
5. 余额和状态查询

### API 使用示例

```javascript
// 连接合约
const escrow = await ethers.getContractAt("EscrowContract", contractAddress);
const token = await ethers.getContractAt("RMBToken", tokenAddress);

// 检查代币支持
const isSupported = await escrow.isTokenSupported(tokenAddress);

// 查询用户余额
const balance = await token.balanceOf(userAddress);

// 获取用户 nonce
const nonce = await escrow.getUserNonce(userAddress);

// 查询托管记录
const record = await escrow.getEscrowRecord(intentHash);
```

## 项目结构

```
contracts/
├── contracts/              # 智能合约源码
│   ├── EscrowContract.sol   # 托管合约
│   ├── RMBToken.sol         # RMB代币合约
│   ├── interfaces/          # 接口定义
│   └── mocks/              # 测试模拟合约
├── scripts/                # 部署和演示脚本
├── test/                   # 测试文件
├── hardhat.config.js       # Hardhat配置
└── package.json            # 项目依赖
```

## 安全考虑

- **重入攻击防护**: 使用 OpenZeppelin ReentrancyGuard
- **权限控制**: 多层级访问控制机制
- **签名验证**: EIP-712 标准化签名
- **代币安全**: Permit2 集成和白名单管理
- **紧急控制**: 暂停和紧急提取功能
- **审计状态**: 代码已通过内部安全审查

## 许可证

MIT License - 详见 LICENSE 文件