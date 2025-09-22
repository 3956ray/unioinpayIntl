# EscrowContract MVP 分阶段实现计划

## 概述

本文档将 EscrowContract PRD 中的 MVP 功能按照技术依赖关系和实现复杂度进行分阶段规划，确保每个阶段都有明确的交付目标和验收标准。

## 实施原则

- **渐进式开发**：每个阶段都基于前一阶段的成果
- **独立验证**：每个阶段完成后都可以独立测试和验证
- **风险控制**：优先实现核心功能，后续添加增强特性
- **质量保证**：每个阶段都包含相应的测试要求

---

## 第一阶段：基础合约结构和数据模型

### 🎯 目标
建立合约的基础架构和核心数据结构，为后续功能实现奠定基础。

### 📋 任务清单
- [ ] 创建 EscrowContract 基础合约
- [ ] 定义 PaymentIntent 结构体
- [ ] 定义 EscrowRecord 结构体
- [ ] 定义 Status 枚举类型
- [ ] 实现基础的存储映射
- [ ] 添加基础的修饰符（modifiers）

### 🔧 技术要点
```solidity
// 核心数据结构
struct PaymentIntent {
    address payer;
    address payee;
    address token;
    uint256 amount;
    uint256 expiryTime;
    bytes32 intentHash;
    uint256 nonce;
}

struct EscrowRecord {
    address payer;
    address payee;
    address token;
    uint256 amount;
    uint256 createdAt;
    uint256 expiryTime;
    Status status;
    address operator;
}

enum Status {
    NONE,
    AUTHORIZED,
    CAPTURED,
    REFUNDED,
    EXPIRED
}
```

### ✅ 验收标准
- 合约可以成功编译
- 数据结构定义完整且类型正确
- 基础存储映射可以正常读写
- 通过基础结构测试用例

### ⏱️ 预估时间
2-3 天

---

## 第二阶段：签名验证机制

### 🎯 目标
实现 EIP-712 结构化签名验证，确保支付意图的真实性和完整性。

### 📋 任务清单
- [ ] 实现 EIP-712 域分隔符（Domain Separator）
- [ ] 定义 PaymentIntent 的类型哈希
- [ ] 实现支付意图哈希计算
- [ ] 实现签名验证逻辑
- [ ] 添加 nonce 管理机制

### 🔧 技术要点
```solidity
// EIP-712 相关常量
bytes32 public constant PAYMENT_INTENT_TYPEHASH = keccak256(
    "PaymentIntent(address payer,address payee,address token,uint256 amount,uint256 expiryTime,uint256 nonce)"
);

// 签名验证函数
function _verifyPaymentIntentSignature(
    PaymentIntent calldata intent,
    bytes calldata signature
) internal view returns (bool)
```

### ✅ 验收标准
- EIP-712 签名验证功能正常
- 可以正确识别有效和无效签名
- Nonce 机制防止重放攻击
- 通过签名验证测试用例

### ⏱️ 预估时间
3-4 天

---

## 第三阶段：Permit2 授权集成

### 🎯 目标
集成 Uniswap Permit2 合约，实现无 Gas 的代币授权机制。

### 📋 任务清单
- [ ] 集成 Permit2 接口定义
- [ ] 实现 Permit2 授权验证
- [ ] 实现代币转移逻辑
- [ ] 添加 Permit2 相关的错误处理
- [ ] 实现授权状态检查

### 🔧 技术要点
```solidity
// Permit2 集成
import {ISignatureTransfer} from "permit2/src/interfaces/ISignatureTransfer.sol";

// 授权转移函数
function _transferWithPermit2(
    ISignatureTransfer.PermitTransferFrom calldata permit,
    bytes calldata signature,
    address to
) internal
```

### ✅ 验收标准
- 成功集成 Permit2 合约
- 可以通过 Permit2 进行代币转移
- 授权验证机制工作正常
- 通过 Permit2 集成测试

### ⏱️ 预估时间
4-5 天

---

## 第四阶段：支付授权功能

### 🎯 目标
实现完整的支付授权流程，将用户资金转入托管合约。

### 📋 任务清单
- [ ] 实现 `authorizePaymentWithPermit2` 函数
- [ ] 集成支付意图验证和 Permit2 授权
- [ ] 实现托管记录创建
- [ ] 添加支付授权事件
- [ ] 实现状态管理逻辑

### 🔧 技术要点
```solidity
function authorizePaymentWithPermit2(
    PaymentIntent calldata intent,
    bytes calldata intentSignature,
    ISignatureTransfer.PermitTransferFrom calldata permit,
    bytes calldata permitSignature
) external onlyOperator {
    // 1. 验证支付意图签名
    // 2. 验证 Permit2 授权
    // 3. 执行资金转移
    // 4. 创建托管记录
    // 5. 发出事件
}
```

### ✅ 验收标准
- 支付授权流程完整可用
- 资金可以成功转入托管合约
- 托管记录正确创建和存储
- 事件正确发出
- 通过支付授权集成测试

### ⏱️ 预估时间
5-6 天

---

## 第五阶段：支付捕获功能

### 🎯 目标
实现支付捕获机制，将托管资金释放给商家。

### 📋 任务清单
- [ ] 实现 `capturePayment` 函数
- [ ] 添加托管状态验证
- [ ] 实现资金转移给收款方
- [ ] 添加支付捕获事件
- [ ] 实现状态更新逻辑

### 🔧 技术要点
```solidity
function capturePayment(
    bytes32 intentHash
) external onlyOperator {
    // 1. 验证托管记录存在
    // 2. 检查状态为 AUTHORIZED
    // 3. 转移资金给收款方
    // 4. 更新状态为 CAPTURED
    // 5. 发出事件
}
```

### ✅ 验收标准
- 支付捕获功能正常工作
- 资金可以正确转移给收款方
- 状态更新机制正确
- 事件记录完整
- 通过支付捕获测试

### ⏱️ 预估时间
3-4 天

---

## 第六阶段：退款处理机制

### 🎯 目标
实现完整的退款处理流程，包括主动退款和超时退款。

### 📋 任务清单
- [ ] 实现 `refundPayment` 函数
- [ ] 实现 `autoRefundExpired` 函数
- [ ] 添加退款条件验证
- [ ] 实现资金退回逻辑
- [ ] 添加退款事件和原因记录

### 🔧 技术要点
```solidity
function refundPayment(
    bytes32 intentHash,
    string calldata reason
) external {
    // 1. 验证调用权限
    // 2. 检查托管状态
    // 3. 退回资金给付款方
    // 4. 更新状态为 REFUNDED
    // 5. 记录退款原因
}

function autoRefundExpired(
    bytes32 intentHash
) external {
    // 1. 检查是否过期
    // 2. 自动退款处理
}
```

### ✅ 验收标准
- 退款功能完整可用
- 超时退款机制正常
- 资金可以正确退回
- 退款原因正确记录
- 通过退款流程测试

### ⏱️ 预估时间
4-5 天

---

## 第七阶段：操作员权限管理

### 🎯 目标
实现操作员注册和权限管理系统，确保只有授权的操作员可以执行关键操作。

### 📋 任务清单
- [ ] 实现操作员注册机制
- [ ] 添加 `onlyOperator` 修饰符
- [ ] 实现操作员权限验证
- [ ] 添加操作员管理事件
- [ ] 实现操作员状态管理

### 🔧 技术要点
```solidity
// 操作员管理
mapping(address => bool) public operators;
mapping(address => string) public operatorNames;

modifier onlyOperator() {
    require(operators[msg.sender], "Not authorized operator");
    _;
}

function registerOperator(
    address operator,
    string calldata name
) external onlyOwner
```

### ✅ 验收标准
- 操作员注册功能正常
- 权限验证机制有效
- 只有授权操作员可以执行关键操作
- 操作员管理事件正确发出
- 通过权限管理测试

### ⏱️ 预估时间
2-3 天

---

## 第八阶段：安全机制完善

### 🎯 目标
实现全面的安全防护机制，包括重入防护、紧急控制等。

### 📋 任务清单
- [ ] 集成 ReentrancyGuard 防重入
- [ ] 实现紧急暂停机制
- [ ] 添加时间锁定验证
- [ ] 实现紧急提取功能
- [ ] 添加安全事件记录

### 🔧 技术要点
```solidity
// 安全机制
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";

// 紧急暂停
function pause() external onlyOwner {
    _pause();
}

// 紧急提取
function emergencyWithdraw(
    address token,
    address to,
    uint256 amount
) external onlyOwner whenPaused
```

### ✅ 验收标准
- 重入攻击防护有效
- 紧急暂停机制工作正常
- 时间锁定验证正确
- 紧急提取功能可用
- 通过安全机制测试

### ⏱️ 预估时间
3-4 天

---

## 第九阶段：事件系统和测试

### 🎯 目标
完善事件记录系统，编写全面的测试用例，确保合约质量。

### 📋 任务清单
- [ ] 完善所有核心事件定义
- [ ] 确保事件参数完整性
- [ ] 编写单元测试用例
- [ ] 编写集成测试用例
- [ ] 进行 Gas 优化测试
- [ ] 编写安全测试用例

### 🔧 技术要点
```solidity
// 完整事件系统
event PaymentAuthorized(
    bytes32 indexed intentHash,
    address indexed payer,
    address indexed payee,
    address token,
    uint256 amount,
    uint256 expiryTime
);

event PaymentCaptured(
    bytes32 indexed intentHash,
    address indexed operator,
    uint256 amount
);

event PaymentRefunded(
    bytes32 indexed intentHash,
    address indexed refundRecipient,
    uint256 amount,
    string reason
);
```

### 📋 测试覆盖范围
- **单元测试**：每个函数的独立测试
- **集成测试**：完整流程测试
- **边界测试**：异常情况和边界条件
- **安全测试**：攻击向量和安全漏洞
- **性能测试**：Gas 消耗和优化

### ✅ 验收标准
- 事件系统完整可用
- 测试覆盖率 > 95%
- 所有测试用例通过
- Gas 消耗符合目标
- 安全审计通过

### ⏱️ 预估时间
6-8 天

---

## 总体时间规划

| 阶段 | 功能 | 预估时间 | 累计时间 |
|------|------|----------|----------|
| 1 | 基础结构 | 2-3 天 | 2-3 天 |
| 2 | 签名验证 | 3-4 天 | 5-7 天 |
| 3 | Permit2 集成 | 4-5 天 | 9-12 天 |
| 4 | 支付授权 | 5-6 天 | 14-18 天 |
| 5 | 支付捕获 | 3-4 天 | 17-22 天 |
| 6 | 退款机制 | 4-5 天 | 21-27 天 |
| 7 | 权限管理 | 2-3 天 | 23-30 天 |
| 8 | 安全机制 | 3-4 天 | 26-34 天 |
| 9 | 事件和测试 | 6-8 天 | 32-42 天 |

**总计：约 5-6 周**

## 风险控制

### 技术风险
- **Permit2 集成复杂性**：预留额外时间进行集成测试
- **签名验证准确性**：使用标准库和参考实现
- **安全漏洞风险**：每个阶段都进行安全审查

### 进度风险
- **依赖关系管理**：确保前置阶段完全完成再开始下一阶段
- **测试时间预留**：为测试和调试预留充足时间
- **代码审查时间**：每个阶段都需要代码审查

## 质量保证

### 代码质量
- 遵循 Solidity 最佳实践
- 使用 OpenZeppelin 标准库
- 进行代码审查和静态分析

### 测试质量
- 单元测试覆盖率 > 95%
- 集成测试覆盖主要流程
- 安全测试覆盖攻击向量

### 文档质量
- 每个阶段都更新技术文档
- 维护 API 文档和使用说明
- 记录已知问题和解决方案

---

**版本**: 1.0.0  
**创建时间**: 2024年  
**负责人**: 开发团队  
**状态**: 规划阶段