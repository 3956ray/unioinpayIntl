# SimpleTokenCollector 部署脚本测试文档

## 概述
`deploy-simple-collector.js` 是用于部署 `SimpleTokenCollector` 合约的脚本。该合约是一个简单的代币收集器，用于处理基本的 ERC20 代币转账操作。

## 合约架构
- **SimpleTokenCollector**: 继承自 `TokenCollector` 的简单实现
- **功能**: 执行基本的 ERC20 代币转账
- **类型**: Payment 类型收集器 (collectorType = 0)
- **依赖**: 需要与 Escrow 合约配合使用

## 最新测试结果 ✅

**测试时间**: 2024年最新测试  
**测试环境**: Hardhat 本地网络  
**部署状态**: 成功  

### 部署验证
- ✅ **合约部署**: 成功部署到 `0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E`
- ✅ **Escrow 关联**: 正确关联到 `0xc6e7DF5E7b4f2A278906862b61205850344D4e7d`
- ✅ **收集器类型**: 正确设置为 0 (Payment)

### 功能测试
- ✅ **权限控制**: 非 Escrow 调用被正确拒绝
- ✅ **代币转账**: 成功执行 5.0 RMB 支付
- ✅ **费用计算**: 1% 费率正确计算和分配 (0.05 RMB)
- ✅ **余额更新**: 所有参与方余额正确更新
- ✅ **集成测试**: 完整支付流程验证通过

### 测试场景
```
支付金额: 5.0 RMB
费率: 1% (100 bps)
实际结果:
- 付款人 (小明): -5.0 RMB ✅
- 收款人 (咖啡店): +4.95 RMB ✅
- 操作员: +0.05 RMB (费用) ✅

测试状态: 🎉 全部通过
```

## 部署前置条件

### 1. 环境检查
```bash
# 检查 Hardhat 网络是否运行
npx hardhat node

# 检查网络连接
npx hardhat console --network localhost
```

### 2. 依赖部署
确保以下合约已部署：
- ✅ **RMBToken**: `0x68B1D87F95878fE05B998F19b66F4baba5De1aed`
- ✅ **Escrow**: `0xc6e7DF5E7b4f2A278906862b61205850344D4e7d`

### 3. 地址更新
⚠️ **重要**: 更新脚本中的 `ESCROW_ADDRESS` 为最新部署的地址：
```javascript
const ESCROW_ADDRESS = "0xc6e7DF5E7b4f2A278906862b61205850344D4e7d";
```

## 测试步骤

### 1. 基础部署测试
```bash
# 部署 SimpleTokenCollector
npx hardhat run scripts/deploy-simple-collector.js --network localhost
```

**预期输出**:
```
部署 SimpleTokenCollector...
部署账户: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
✅ SimpleTokenCollector 部署成功!
SimpleTokenCollector 地址: 0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E

--- 验证部署 ---
关联的 Escrow 地址: 0xc6e7DF5E7b4f2A278906862b61205850344D4e7d
收集器类型: 0
部署完成!
```

### 2. 功能验证测试
```bash
# 运行功能测试
npx hardhat run scripts/test-simple-collector.js --network localhost
```

**测试覆盖**:
- 合约配置验证
- 权限控制测试
- 集成支付测试

### 3. 部署验证
```bash
# 验证所有部署
npx hardhat run scripts/verify-deployment.js --network localhost
```

### 4. 快速测试 ⚡
```bash
# 快速验证合约配置
npx hardhat run scripts/quick-test-simple-collector.js --network localhost
```

**预期输出**:
```
⚡ SimpleTokenCollector 快速测试
✅ 合约地址: 0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E
✅ Escrow: 0xc6e7DF5E7b4f2A278906862b61205850344D4e7d
✅ 类型: 0 (0=Payment)
🎉 快速测试通过!
```

## 常见问题排查

### 1. 部署失败
**问题**: `Error: invalid address`
**解决**: 检查 `ESCROW_ADDRESS` 是否为有效的以太坊地址

**问题**: `Error: contract not deployed`
**解决**: 确保 Escrow 合约已正确部署

### 2. 权限错误
**问题**: `OnlyEscrow` 错误
**解决**: 确保只通过 Escrow 合约调用 SimpleTokenCollector

### 3. 代币转账失败
**问题**: `ERC20: insufficient allowance`
**解决**: 确保付款人已授权足够的代币给收集器

## 测试用例

### 用例 1: 正常支付流程
- **场景**: 小明向咖啡店支付 5 RMB
- **费率**: 1%
- **预期**: 成功转账，费用正确计算

### 用例 2: 权限控制
- **场景**: 直接调用 collectTokens
- **预期**: 抛出 OnlyEscrow 错误

### 用例 3: 大额支付
- **场景**: 支付超过授权额度
- **预期**: 交易失败

## 与其他收集器对比

| 特性 | SimpleTokenCollector | ERC3009PaymentCollector |
|------|---------------------|------------------------|
| 签名要求 | 无 | ERC3009 签名 |
| 复杂度 | 简单 | 复杂 |
| Gas 消耗 | 低 | 高 |
| 安全性 | 基础 | 高级 |
| 适用场景 | 简单转账 | 授权支付 |

## 性能指标

### Gas 消耗
- **部署**: ~500,000 gas
- **单次支付**: ~80,000 gas
- **批量支付**: ~60,000 gas/笔

### 交易时间
- **本地网络**: < 1 秒
- **测试网络**: 15-30 秒
- **主网**: 1-5 分钟

## 安全考虑

### 1. 权限控制
- ✅ 只允许 Escrow 合约调用
- ✅ 防止直接调用攻击

### 2. 代币安全
- ✅ 使用 SafeERC20 库
- ✅ 检查转账结果

### 3. 重入攻击
- ✅ 遵循 CEI 模式
- ✅ 状态更新在外部调用前

## 部署清单

### 部署前检查
- [ ] Hardhat 网络运行中
- [ ] RMBToken 已部署
- [ ] Escrow 已部署
- [ ] ESCROW_ADDRESS 已更新
- [ ] 部署账户有足够 ETH

### 部署后验证
- [ ] SimpleTokenCollector 地址有效
- [ ] Escrow 关联正确
- [ ] 收集器类型为 0
- [ ] 权限控制正常
- [ ] 支付功能正常

### 集成测试
- [ ] 与 Escrow 集成正常
- [ ] 费用计算正确
- [ ] 余额更新准确
- [ ] 错误处理正常

## 维护建议

### 1. 定期测试
- 每次代码更新后运行完整测试
- 定期检查合约状态
- 监控 Gas 消耗变化

### 2. 地址管理
- 保持部署地址记录最新
- 定期验证合约关联
- 备份重要配置

### 3. 安全审计
- 定期进行安全审计
- 监控异常交易
- 及时更新安全补丁

## 相关文件

- **部署脚本**: `scripts/deploy-simple-collector.js`
- **完整测试脚本**: `scripts/test-simple-collector.js`
- **快速测试脚本**: `scripts/quick-test-simple-collector.js` ⚡
- **合约源码**: `contracts/collectors/SimpleTokenCollector.sol`
- **验证脚本**: `scripts/verify-deployment.js`
- **测试文档**: `SimpleTokenCollector测试文档.md`

## 联系信息

如有问题或建议，请联系开发团队。

---

**文档版本**: v1.0  
**最后更新**: 2024年  
**测试状态**: ✅ 通过