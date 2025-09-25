# UnioinPay International - ERC3009 Payment System

基于 ERC3009 标准的去中心化支付系统，支持人民币代币（RMBToken）和托管合约（Escrow）的完整支付解决方案。

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- Git

### 安装依赖

```bash
# 克隆项目
git clone <repository-url>
cd unioinpayIntl

# 安装根目录依赖
npm install

# 安装链上合约依赖
cd chainPart
npm install
```

## 📁 项目结构

```
unioinpayIntl/
├── README.md                          # 项目主文档
├── ERC3009-Payment-MVP.md             # ERC3009 支付MVP文档
├── backend-abi-config.md              # 后端ABI配置文档
├── backend-integration-guide.md       # 后端集成指南
├── LICENSE                            # 许可证
├── package.json                       # 根目录依赖配置
└── chainPart/                         # 区块链合约部分
    ├── contracts/                     # 智能合约
    │   ├── Escrow.sol                # 托管合约
    │   ├── RMBToken.sol              # 人民币代币合约
    │   ├── TokenStore.sol            # 代币存储合约
    │   ├── collectors/               # 收集器合约
    │   │   ├── ERC3009PaymentCollector.sol  # ERC3009支付收集器
    │   │   ├── ERC6492SignatureHandler.sol # ERC6492签名处理器
    │   │   └── TokenCollector.sol           # 代币收集器
    │   ├── interfaces/               # 接口定义
    │   │   └── IERC3009.sol         # ERC3009接口
    │   ├── mocks/                    # 测试模拟合约
    │   │   ├── MockCollector.sol    # 模拟收集器
    │   │   └── MockERC20.sol        # 模拟ERC20代币
    │   └── transfers/                # 转账相关合约
    │       └── TokenStore.sol       # 代币存储实现
    ├── scripts/                      # 部署和工具脚本
    │   ├── deploy-all.js            # 一键部署脚本
    │   ├── verify-deployment.js     # 部署验证脚本
    │   ├── demo-payment-flow.js     # 支付流程演示
    │   └── send-op-tx.ts           # 操作交易脚本
    ├── test/                        # 测试文件
    │   ├── Escrow.functional.test.js # Escrow功能测试
    │   ├── Escrow.test.js           # Escrow单元测试
    │   ├── RMBToken.test.js         # RMBToken测试
    ├── hardhat.config.js            # Hardhat配置
    ├── package.json                 # 合约项目依赖
    └── tsconfig.json               # TypeScript配置
```

## 🔧 开发环境设置

### 1. 启动本地区块链网络

```bash
cd chainPart
npx hardhat node
```

这将启动一个本地 Hardhat 网络，运行在 `http://127.0.0.1:8545`，并提供 20 个预充值账户。

### 2. 编译合约

```bash
cd chainPart
npx hardhat compile
```

### 3. 运行测试

```bash
cd chainPart

# 运行所有测试
npx hardhat test

# 运行特定测试文件
npx hardhat test test/Escrow.functional.test.js
npx hardhat test test/RMBToken.test.js
```

## 🚀 部署合约

### 本地部署

```bash
cd chainPart

# 确保本地网络正在运行
npx hardhat node

# 在新终端中部署合约
npx hardhat run scripts/deploy-all.js --network localhost
```

部署完成后，您将看到：
- RMBToken 合约地址
- Escrow 合约地址
- 初始代币分配信息

### 验证部署

```bash
cd chainPart
npx hardhat run scripts/verify-deployment.js --network localhost
```

## 🧪 测试

### 运行测试
```bash
cd chainPart
npm test
```

### 测试覆盖率
```bash
npm run coverage
```

### 测试文件
- `Escrow.test.js`: Escrow 合约单元测试
- `Escrow.functional.test.js`: Escrow 功能测试
- `RMBToken.test.js`: RMBToken 合约测试
- `Counter.ts`: 计数器合约测试（TypeScript）

### 测试覆盖

项目包含 87 个测试用例，覆盖以下功能：

#### RMBToken 测试
- ✅ 基本 ERC20 功能
- ✅ ERC3009 支付功能
- ✅ 权限管理
- ✅ 铸造和销毁

#### Escrow 测试
- ✅ 支付流程（charge/refund）
- ✅ 授权/捕获流程（authorize/capture）
- ✅ 过期时间验证
- ✅ 边界条件测试
- ✅ 错误处理

### 运行测试

```bash
cd chainPart

# 运行所有测试
npm test

# 运行特定测试套件
npx hardhat test test/Escrow.functional.test.js
npx hardhat test test/RMBToken.test.js

# 运行测试并显示详细输出
npx hardhat test --verbose
```

## 📋 核心合约

### RMBToken.sol
- **功能**: ERC20 + ERC3009 人民币代币
- **特性**: 
  - 支持传统转账和授权支付
  - 6位小数精度
  - 铸造和销毁功能
  - 货币类型标识（CNY）

### Escrow.sol
- **功能**: 托管支付合约
- **特性**:
  - 支持 charge/refund 流程
  - 支持 authorize/capture 流程
  - 多重过期时间验证
  - 灵活的收集器系统

### TokenStore.sol
- **功能**: 代币存储和管理
- **特性**:
  - 安全的代币存储
  - 批量操作支持
  - 权限控制

### 收集器合约

#### ERC3009PaymentCollector.sol
- **功能**: ERC3009 支付收集器
- **特性**: 处理基于 ERC3009 标准的授权支付

#### TokenCollector.sol
- **功能**: 通用代币收集器
- **特性**: 处理各种代币的收集和转移操作

#### ERC6492SignatureHandler.sol
- **功能**: ERC6492 签名处理器
- **特性**: 支持智能合约钱包的签名验证

## 🔗 网络配置

### 本地网络
- **网络名称**: localhost
- **RPC URL**: http://127.0.0.1:8545
- **链 ID**: 1337
- **货币符号**: ETH

### Hardhat 网络
- **网络名称**: hardhat
- **链 ID**: 31337
- **用途**: 测试和开发

## 📖 API 文档

### 部署后的合约地址

部署完成后，合约地址将保存在 `chainPart/deployments.json` 文件中：

```json
{
  "network": "localhost",
  "chainId": "1337",
  "contracts": {
    "RMBToken": "0x...",
    "Escrow": "0x..."
  }
}
```

### 主要合约方法

#### RMBToken
```solidity
// ERC20 标准方法
function transfer(address to, uint256 amount) external returns (bool)
function approve(address spender, uint256 amount) external returns (bool)

// ERC3009 支付方法
function transferWithAuthorization(...)
function receiveWithAuthorization(...)
```

#### Escrow
```solidity
// 支付流程
function charge(PaymentInfo calldata paymentInfo, bytes calldata signature)
function refund(PaymentInfo calldata paymentInfo, bytes calldata signature)

// 授权流程
function authorize(PaymentInfo calldata paymentInfo, bytes calldata signature)
function capture(PaymentInfo calldata paymentInfo, bytes calldata signature)
```

## 🛠️ 开发工具

### 可用脚本

```bash
npm run compile         # 编译合约
npm run test           # 运行测试
npm run test:coverage  # 生成测试覆盖率报告
npm run deploy:localhost # 部署到本地网络
npm run deploy:sepolia   # 部署到Sepolia测试网
npm run deploy:mainnet   # 部署到主网
npm run node           # 启动本地Hardhat节点
npm run clean          # 清理编译文件
npm run size           # 检查合约大小
npm run lint           # 代码检查
npm run lint:fix       # 自动修复代码问题
npm run format         # 格式化代码
```

### 调试

```bash
# 启动 Hardhat 控制台
npx hardhat console --network localhost

# 查看网络状态
npx hardhat node --show-stack-traces
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🆘 故障排除

### 常见问题

1. **编译错误**: 确保 Solidity 版本为 0.8.20
2. **测试失败**: 检查本地网络是否正在运行
3. **部署失败**: 验证账户余额是否充足
4. **Gas 估算错误**: 尝试增加 gas limit

### 获取帮助

- 查看 [Issues](../../issues) 页面
- 阅读 [ERC3009-Payment-MVP.md](ERC3009-Payment-MVP.md)
- 参考 [backend-integration-guide.md](backend-integration-guide.md)

---

**注意**: 本项目仅用于开发和测试目的。在生产环境中使用前，请进行充分的安全审计。