# EscrowContract PRD - 托管合约产品需求文档

## 项目概述

### 产品定位
基于Coinbase Commerce Payments Protocol的去中心化托管合约，为电商支付提供安全的资金托管服务。实现用户无Gas费的支付体验，同时保证资金安全和交易的去中心化特性。

### 核心价值
- **用户友好**：用户只需签名确认，无需支付Gas费用
- **资金安全**：智能合约托管，防止资金被恶意使用
- **去中心化**：无需信任第三方，完全由智能合约控制
- **标准兼容**：支持EIP-2612 Permit和Permit2授权机制

## MVP功能范围

### 第一阶段：核心托管功能 (MVP)

#### ✅ 必须实现的功能
- [ ] **支付意图验证与授权**
  - EIP-712结构化签名验证
  - Permit2授权集成
  - 资金从用户转入托管合约

- [ ] **支付捕获功能**
  - 商家履约后释放资金
  - 资金从托管合约转给商家
  - 状态管理和事件记录

- [ ] **退款处理功能**
  - 用户主动退款
  - 超时自动退款
  - 资金退回原付款用户

- [ ] **操作员权限管理**
  - Operator注册和管理
  - 权限验证机制
  - 基础访问控制

- [ ] **基础安全机制**
  - 重入攻击防护
  - 时间锁定机制
  - 紧急暂停功能

#### 🔄 第二阶段功能 (后续版本)
- [ ] 批量操作支持
- [ ] 多代币支持扩展
- [ ] 争议解决机制
- [ ] 手续费管理
- [ ] 合约升级机制

## 技术架构

### 核心合约结构
```
EscrowContract
├── 支付意图管理
│   ├── PaymentIntent结构体
│   ├── EIP-712签名验证
│   └── 状态跟踪
├── Permit2集成
│   ├── 授权验证
│   ├── 资金转移
│   └── 无Gas体验
├── 托管管理
│   ├── 资金锁定
│   ├── 状态变更
│   └── 事件记录
└── 安全机制
    ├── 权限控制
    ├── 重入防护
    └── 紧急控制
```

### 数据结构设计

#### PaymentIntent 支付意图
```solidity
struct PaymentIntent {
    address payer;          // 付款方
    address payee;          // 收款方
    address token;          // 代币地址
    uint256 amount;         // 支付金额
    uint256 e piryTime;     // 过期时间
    bytes32 intentHash;     // 意图哈希
    uint256 nonce;          // 防重放随机数
}
```

#### EscrowRecord 托管记录
```solidity
struct EscrowRecord {
    address payer;          // 付款方
    address payee;          // 收款方
    address token;          // 代币地址
    uint256 amount;         // 托管金额
    uint256 createdAt;      // 创建时间
    uint256 e piryTime;     // 过期时间
    Status status;          // 托管状态
    address operator;       // 操作员
}

enum Status {
    NONE,           // 不存在
    AUTHORIZED,     // 已授权
    CAPTURED,       // 已捕获
    REFUNDED,       // 已退款
    E PIRED         // 已过期
}
```

## 核心功能详述

### 1. 支付授权流程

#### 功能描述
用户通过离线签名创建支付意图，Operator代为提交到区块链，实现无Gas支付体验。

#### 核心函数
```solidity
function authorizePaymentWithPermit2(
    PaymentIntent calldata intent,
    bytes calldata intentSignature,
    ISignatureTransfer.PermitTransferFrom calldata permit,
    bytes calldata permitSignature
) e ternal onlyOperator
```

#### 验证步骤
1. 验证支付意图EIP-712签名
2. 验证Permit2授权签名
3. 检查支付意图有效期
4. 验证Operator权限
5. 执行资金转移
6. 创建托管记录

### 2. 支付捕获流程

#### 功能描述
商家履行义务后，Operator调用捕获函数，将托管资金转移给商家。

#### 核心函数
```solidity
function capturePayment(
    bytes32 intentHash
) e ternal onlyOperator
```

#### 执行步骤
1. 验证托管记录存在且状态为AUTHORIZED
2. 检查调用者权限
3. 转移资金给收款方
4. 更新状态为CAPTURED
5. 发出PaymentCaptured事件

### 3. 退款处理流程

#### 功能描述
处理订单取消、争议或超时情况，将资金退回给原付款用户。

#### 核心函数
```solidity
function refundPayment(
    bytes32 intentHash,
    string calldata reason
) e ternal

function autoRefundE pired(
    bytes32 intentHash
) e ternal
```

#### 退款条件
- 用户主动申请退款
- 商家同意退款
- 支付意图过期
- 系统检测到异常

## 安全机制

### 1. 权限控制
- **Operator注册**：只有注册的Operator可以执行操作
- **多重验证**：支付意图和授权都需要用户签名
- **时间限制**：所有操作都有明确的时间窗口

### 2. 防攻击机制
- **重入防护**：使用ReentrancyGuard防止重入攻击
- **签名验证**：严格验证所有EIP-712和Permit2签名
- **状态检查**：每次操作前检查合约和记录状态

### 3. 紧急控制
- **暂停机制**：管理员可以暂停合约操作
- **紧急提取**：在紧急情况下保护用户资金
- **升级支持**：支持合约逻辑升级

## 事件系统

### 核心事件定义
```solidity
event PaymentAuthorized(
    bytes32 inde ed intentHash,
    address inde ed payer,
    address inde ed payee,
    address token,
    uint256 amount,
    uint256 e piryTime
);

event PaymentCaptured(
    bytes32 inde ed intentHash,
    address inde ed operator,
    uint256 amount
);

event PaymentRefunded(
    bytes32 inde ed intentHash,
    address inde ed refundRecipient,
    uint256 amount,
    string reason
);

event OperatorRegistered(
    address inde ed operator,
    string name
);
```

## 与RMBToken集成

### 集成要点
- **Permit支持**：充分利用RMBToken的EIP-2612 Permit功能
- **精度处理**：正确处理RMBToken的6位小数精度
- **权限兼容**：与RMBToken的权限系统协同工作
- **安全协同**：利用RMBToken的安全机制

### 特殊处理
- **铸造限制**：考虑RMBToken的单次铸造限制（100万RMB）
- **暂停状态**：检查RMBToken的暂停状态
- **重入防护**：与RMBToken的重入防护机制协同

## 部署要求

### 依赖合约
- **Permit2合约**：Uniswap的统一授权合约
- **RMBToken合约**：项目的人民币稳定币
- **OpenZeppelin库**：安全基础组件

### 初始化参数
- Permit2合约地址
- 管理员地址
- 支持的代币列表（包括RMBToken）
- 默认过期时间设置

### 网络支持
- 以太坊主网
- Polygon
- Arbitrum
- Optimism

## 测试策略

### 单元测试
- 支付意图验证测试
- Permit2集成测试
- 状态转换测试
- 权限控制测试
- 安全机制测试

### 集成测试
- 与RMBToken的完整交互流程
- 多用户并发测试
- 异常情况处理测试
- Gas优化验证

### 安全审计
- 智能合约安全审计
- 经济模型验证
- 攻击向量分析
- 形式化验证

## 性能指标

### Gas消耗目标
- 支付授权：< 150,000 gas
- 支付捕获：< 80,000 gas
- 退款处理：< 80,000 gas

### 响应时间
- 签名验证：< 100ms
- 状态查询：< 50ms
- 事件监听：实时

## 风险评估

### 技术风险
- **智能合约漏洞**：通过审计和测试降低
- **Permit2依赖**：使用成熟的Uniswap合约
- **网络拥堵**：支持多链部署分散风险

### 业务风险
- **用户接受度**：提供清晰的用户教育
- **监管合规**：遵循相关法律法规
- **竞争压力**：持续优化用户体验

## 发布计划

### MVP版本 (v1.0.0)
- 核心托管功能
- RMBToken集成
- 基础安全机制
- 测试网部署

### 增强版本 (v1.1.0)
- 批量操作支持
- 多代币扩展
- 性能优化
- 主网部署

### 完整版本 (v2.0.0)
- 争议解决机制
- 高级安全功能
- 跨链支持
- 企业级功能

## 成功指标

### 技术指标
- 合约部署成功率：100%
- 交易成功率：> 99.9%
- 平均Gas消耗达标
- 零安全事故

### 业务指标
- 用户采用率增长
- 交易量增长
- 用户满意度评分
- 生态系统集成数量

---

**版本**: 1.0.0-MVP  
**最后更新**: 2024年  
**负责人**: 开发团队  
**状态**: 设计阶段