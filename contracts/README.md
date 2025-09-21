# RMB 稳定币合约 (RMBTokenV1)

基于 USDC 设计模式的人民币稳定币智能合约，采用可升级代理模式实现。

## 功能特性

### 核心功能
- **ERC20 标准**: 完全兼容 ERC20 代币标准
- **EIP-2612 Permit**: 支持无 gas 授权功能
- **可升级性**: 采用 UUPS 代理模式，支持合约升级
- **角色管理**: 基于 OpenZeppelin AccessControl 的细粒度权限控制

### 合规功能
- **暂停机制**: 紧急情况下可暂停所有转账操作
- **黑名单管理**: 支持单个和批量黑名单操作
- **受控铸币**: 只有授权角色可以铸造代币
- **受控销毁**: 支持强制销毁和用户自愿销毁

### 供应量控制
- **最大供应量**: 可设置代币最大供应量上限
- **供应量开关**: 可启用/禁用供应量限制

### 安全功能
- **资产找回**: 可找回误转到合约的 ERC20 代币和 ETH
- **升级授权**: 只有授权角色可以升级合约

## 角色说明

| 角色 | 权限 | 说明 |
|------|------|------|
| `DEFAULT_ADMIN_ROLE` | 管理所有角色 | 超级管理员，可以授予/撤销其他角色 |
| `PAUSER_ROLE` | 暂停/恢复合约 | 紧急情况下暂停合约操作 |
| `MINTER_ROLE` | 铸造代币 | 铸造新的代币到指定地址 |
| `BURNER_ROLE` | 销毁代币 | 强制销毁指定地址的代币 |
| `BLACKLISTER_ROLE` | 黑名单管理 | 添加/移除黑名单地址 |
| `RESCUER_ROLE` | 资产找回 | 找回误转到合约的资产 |
| `UPGRADER_ROLE` | 合约升级 | 升级合约实现 |

## 部署和使用

### 环境要求

```bash
# 安装依赖
npm install

# 编译合约
npx hardhat compile

# 运行测试
npx hardhat test
```

### 部署合约

```bash
# 部署到本地网络
npx hardhat run scripts/deploy-rmb-token.ts --network localhost

# 部署到测试网
npx hardhat run scripts/deploy-rmb-token.ts --network sepolia
```

### 合约初始化

```solidity
// 初始化合约
function initialize(
    address admin,      // 管理员地址
    string memory name, // 代币名称，如 "RMB Stablecoin"
    string memory symbol // 代币符号，如 "RMB"
) public initializer
```

### 基本操作示例

```javascript
// 设置角色
await rmbToken.setupRoles(
    adminAddress,
    pauserAddress,
    minterAddress,
    blacklisterAddress,
    rescuerAddress,
    upgraderAddress,
    burnerAddress
);

// 铸造代币
await rmbToken.connect(minter).mint(userAddress, ethers.parseUnits("1000", 6));

// 设置黑名单
await rmbToken.connect(blacklister).setBlacklisted(badActorAddress, true);

// 设置供应量上限
await rmbToken.setMaxSupply(ethers.parseUnits("1000000000", 6)); // 10亿 RMB
await rmbToken.toggleSupplyCap(true);

// 暂停合约
await rmbToken.connect(pauser).pause();
```

## 安全考虑

### 生产环境建议

1. **多签钱包**: 所有关键角色应使用多签钱包
2. **时间锁**: 升级操作应添加时间锁延迟
3. **审计**: 部署前进行专业安全审计
4. **监控**: 部署监控系统跟踪关键操作
5. **应急预案**: 制定紧急情况处理流程

### 权限分离

- 不同角色应分配给不同的地址
- 避免单点故障
- 定期轮换密钥
- 使用硬件钱包存储私钥

## 合约信息

- **Solidity 版本**: ^0.8.20
- **代币精度**: 6 位小数（与 USDC 一致）
- **代理模式**: UUPS (Universal Upgradeable Proxy Standard)
- **依赖库**: OpenZeppelin Contracts Upgradeable v5.4.0

## 测试

合约包含完整的测试套件，覆盖以下场景：

- 部署和初始化
- 铸币和销毁
- 转账和授权
- 黑名单功能
- 暂停机制
- 供应量控制
- 角色管理
- 升级功能

运行测试：

```bash
npx hardhat test
```

## 许可证

MIT License

## 免责声明

此合约仅供教学和参考使用，未经过专业安全审计。在生产环境中使用前，请务必进行全面的安全审计和测试。
