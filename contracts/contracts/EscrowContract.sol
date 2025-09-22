// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IPermit2.sol";

/**
 * @title EscrowContract
 * @dev 基于Coinbase Commerce Payments Protocol的去中心化托管合约
 * @dev 为电商支付提供安全的资金托管服务，实现用户无Gas费的支付体验
 */
contract EscrowContract is ReentrancyGuard, Pausable, Ownable, EIP712 {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    // ============ 数据结构定义 ============

    /**
     * @dev 托管状态枚举
     */
    enum Status {
        NONE,           // 不存在
        AUTHORIZED,     // 已授权
        CAPTURED,       // 已捕获
        REFUNDED,       // 已退款
        EXPIRED         // 已过期
    }

    /**
     * @dev 支付意图结构体
     * @param payer 付款方地址
     * @param payee 收款方地址
     * @param token 代币合约地址
     * @param amount 支付金额
     * @param expiryTime 过期时间
     * @param intentHash 意图哈希
     * @param nonce 防重放随机数
     */
    struct PaymentIntent {
        address payer;
        address payee;
        address token;
        uint256 amount;
        uint256 expiryTime;
        bytes32 intentHash;
        uint256 nonce;
    }

    /**
     * @dev 托管记录结构体
     * @param payer 付款方
     * @param payee 收款方
     * @param token 代币地址
     * @param amount 托管金额
     * @param createdAt 创建时间
     * @param expiryTime 过期时间
     * @param status 托管状态
     * @param operator 操作员
     */
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

    // ============ EIP-712 类型哈希 ============

    /**
     * @dev PaymentIntent的EIP-712类型哈希
     */
    bytes32 public constant PAYMENT_INTENT_TYPEHASH = keccak256(
        "PaymentIntent(address payer,address payee,address token,uint256 amount,uint256 expiryTime,uint256 nonce)"
    );

    // ============ 状态变量 ============

    /// @dev Permit2合约地址
    IPermit2 public immutable permit2;
    
    /// @dev 操作员权限映射
    mapping(address => bool) public operators;
    
    /// @dev 操作员名称映射
    mapping(address => string) public operatorNames;
    
    /// @dev 用户nonce映射，防止重放攻击
    mapping(address => uint256) public nonces;
    
    /// @dev 托管记录映射 intentHash => EscrowRecord
    mapping(bytes32 => EscrowRecord) public escrowRecords;
    
    /// @dev 支持的代币列表
    mapping(address => bool) public supportedTokens;

    // ============ 事件定义 ============

    /**
     * @dev 支付授权事件
     * @param intentHash 支付意图哈希
     * @param payer 付款方
     * @param payee 收款方
     * @param token 代币地址
     * @param amount 支付金额
     * @param expiryTime 过期时间
     */
    event PaymentAuthorized(
        bytes32 indexed intentHash,
        address indexed payer,
        address indexed payee,
        address token,
        uint256 amount,
        uint256 expiryTime
    );

    /**
     * @dev 支付捕获事件
     * @param intentHash 支付意图哈希
     * @param operator 操作员
     * @param amount 捕获金额
     */
    event PaymentCaptured(
        bytes32 indexed intentHash,
        address indexed operator,
        uint256 amount
    );

    /**
     * @dev 支付退款事件
     * @param intentHash 支付意图哈希
     * @param refundRecipient 退款接收方
     * @param amount 退款金额
     * @param reason 退款原因
     */
    event PaymentRefunded(
        bytes32 indexed intentHash,
        address indexed refundRecipient,
        uint256 amount,
        string reason
    );

    /**
     * @dev 操作员注册事件
     * @param operator 操作员地址
     * @param name 操作员名称
     */
    event OperatorRegistered(
        address indexed operator,
        string name
    );

    /**
     * @dev 操作员移除事件
     * @param operator 操作员地址
     */
    event OperatorRemoved(
        address indexed operator
    );

    /**
     * @dev 代币支持状态更新事件
     * @param token 代币地址
     * @param supported 是否支持
     */
    event TokenSupportUpdated(
        address indexed token,
        bool supported
    );

    // ============ 修饰符 ============

    /**
     * @dev 只有授权操作员可以调用
     */
    modifier onlyOperator() {
        require(operators[msg.sender], "EscrowContract: Not authorized operator");
        _;
    }

    /**
     * @dev 只有支持的代币可以使用
     */
    modifier onlySupportedToken(address token) {
        require(supportedTokens[token], "EscrowContract: Token not supported");
        _;
    }

    // ============ 构造函数 ============

    /**
     * @dev 构造函数
     * @param _owner 合约所有者
     * @param _permit2 Permit2合约地址
     * @param _name EIP-712域名
     * @param _version EIP-712版本
     */
    constructor(
        address _owner,
        address _permit2,
        string memory _name,
        string memory _version
    ) EIP712(_name, _version) {
        require(_owner != address(0), "EscrowContract: Invalid owner address");
        require(_permit2 != address(0), "EscrowContract: Invalid permit2 address");
        
        permit2 = IPermit2(_permit2);
        _transferOwnership(_owner);
    }

    // ============ EIP-712 签名验证 ============

    /**
     * @dev 计算支付意图的结构化哈希
     * @param intent 支付意图
     * @return 结构化哈希
     */
    function _hashPaymentIntent(PaymentIntent calldata intent) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                PAYMENT_INTENT_TYPEHASH,
                intent.payer,
                intent.payee,
                intent.token,
                intent.amount,
                intent.expiryTime,
                intent.nonce
            )
        );
    }

    /**
     * @dev 验证支付意图签名
     * @param intent 支付意图
     * @param signature 签名
     * @return 签名是否有效
     */
    function _verifyPaymentIntentSignature(
        PaymentIntent calldata intent,
        bytes calldata signature
    ) internal view returns (bool) {
        bytes32 structHash = _hashPaymentIntent(intent);
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(signature);
        return signer == intent.payer;
    }

    /**
     * @dev 生成支付意图哈希
     * @param intent 支付意图
     * @return 意图哈希
     */
    function generateIntentHash(PaymentIntent calldata intent) external pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                intent.payer,
                intent.payee,
                intent.token,
                intent.amount,
                intent.expiryTime,
                intent.nonce
            )
        );
    }

    // ============ 操作员管理 ============

    /**
     * @dev 注册操作员
     * @param operator 操作员地址
     * @param name 操作员名称
     */
    function registerOperator(address operator, string calldata name) external onlyOwner {
        require(operator != address(0), "EscrowContract: Invalid operator address");
        require(bytes(name).length > 0, "EscrowContract: Empty operator name");
        
        operators[operator] = true;
        operatorNames[operator] = name;
        
        emit OperatorRegistered(operator, name);
    }

    /**
     * @dev 移除操作员
     * @param operator 操作员地址
     */
    function removeOperator(address operator) external onlyOwner {
        require(operators[operator], "EscrowContract: Operator not registered");
        
        operators[operator] = false;
        delete operatorNames[operator];
        
        emit OperatorRemoved(operator);
    }

    // ============ 代币管理 ============

    /**
     * @dev 设置代币支持状态
     * @param token 代币地址
     * @param supported 是否支持
     */
    function setTokenSupport(address token, bool supported) external onlyOwner {
        require(token != address(0), "EscrowContract: Invalid token address");
        
        supportedTokens[token] = supported;
        
        emit TokenSupportUpdated(token, supported);
    }

    // ============ 查询函数 ============

    /**
     * @dev 获取用户当前nonce
     * @param user 用户地址
     * @return 当前nonce
     */
    function getUserNonce(address user) external view returns (uint256) {
        return nonces[user];
    }

    /**
     * @dev 获取托管记录
     * @param intentHash 意图哈希
     * @return 托管记录
     */
    function getEscrowRecord(bytes32 intentHash) external view returns (EscrowRecord memory) {
        return escrowRecords[intentHash];
    }

    /**
     * @dev 检查操作员是否已注册
     * @param operator 操作员地址
     * @return 是否已注册
     */
    function isOperator(address operator) external view returns (bool) {
        return operators[operator];
    }

    /**
     * @dev 检查代币是否支持
     * @param token 代币地址
     * @return 是否支持
     */
    function isTokenSupported(address token) external view returns (bool) {
        return supportedTokens[token];
    }

    // ============ 紧急控制 ============

    /**
     * @dev 暂停合约
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev 恢复合约
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev 紧急提取代币（仅在暂停状态下）
     * @param token 代币地址
     * @param to 接收地址
     * @param amount 提取金额
     */
    function emergencyWithdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner whenPaused {
        require(to != address(0), "EscrowContract: Invalid recipient address");
        require(amount > 0, "EscrowContract: Invalid amount");
        
        IERC20(token).safeTransfer(to, amount);
    }

    // ============ 待实现的核心功能 ============
    // 注意：以下函数将在后续阶段实现

    /**
     * @dev 使用Permit2授权支付
     * @param intent 支付意图
     * @param intentSignature 支付意图签名
     * @param permit Permit2授权数据
     * @param permitSignature Permit2签名
     */
    function authorizePaymentWithPermit2(
        PaymentIntent calldata intent,
        bytes calldata intentSignature,
        IPermit2.PermitTransferFrom calldata permit,
        bytes calldata permitSignature
    ) external onlyOperator whenNotPaused onlySupportedToken(intent.token) nonReentrant {
        // 1. 验证支付意图基本参数
        require(intent.payer != address(0), "EscrowContract: Invalid payer");
        require(intent.payee != address(0), "EscrowContract: Invalid payee");
        require(intent.amount > 0, "EscrowContract: Invalid amount");
        require(intent.expiryTime > block.timestamp, "EscrowContract: Intent expired");
        require(intent.nonce == nonces[intent.payer], "EscrowContract: Invalid nonce");
        
        // 2. 验证支付意图签名
        require(
            _verifyPaymentIntentSignature(intent, intentSignature),
            "EscrowContract: Invalid intent signature"
        );
        
        // 3. 生成意图哈希
        bytes32 intentHash = keccak256(
            abi.encodePacked(
                intent.payer,
                intent.payee,
                intent.token,
                intent.amount,
                intent.expiryTime,
                intent.nonce
            )
        );
        
        // 4. 检查托管记录是否已存在
        require(
            escrowRecords[intentHash].status == Status.NONE,
            "EscrowContract: Intent already processed"
        );
        
        // 5. 验证Permit2参数
        require(permit.permitted.token == intent.token, "EscrowContract: Token mismatch");
        require(permit.permitted.amount >= intent.amount, "EscrowContract: Insufficient permit amount");
        require(permit.deadline > block.timestamp, "EscrowContract: Permit expired");
        
        // 6. 使用Permit2转移代币到托管合约
        IPermit2.SignatureTransferDetails memory transferDetails = IPermit2.SignatureTransferDetails({
            to: address(this),
            requestedAmount: intent.amount
        });
        
        permit2.permitTransferFrom(
            permit,
            transferDetails,
            intent.payer,
            permitSignature
        );
        
        // 7. 创建托管记录
        escrowRecords[intentHash] = EscrowRecord({
            payer: intent.payer,
            payee: intent.payee,
            token: intent.token,
            amount: intent.amount,
            createdAt: block.timestamp,
            expiryTime: intent.expiryTime,
            status: Status.AUTHORIZED,
            operator: msg.sender
        });
        
        // 8. 更新用户nonce
        nonces[intent.payer]++;
        
        // 9. 发出事件
        emit PaymentAuthorized(
            intentHash,
            intent.payer,
            intent.payee,
            intent.token,
            intent.amount,
            intent.expiryTime
        );
    }

    /**
     * @dev 捕获支付 - 将托管资金转给收款方
     * @param intentHash 支付意图哈希
     */
    function capturePayment(bytes32 intentHash) external onlyOperator whenNotPaused nonReentrant {
        EscrowRecord storage record = escrowRecords[intentHash];
        
        // 1. 验证托管记录状态
        require(record.status == Status.AUTHORIZED, "EscrowContract: Invalid status for capture");
        require(record.expiryTime > block.timestamp, "EscrowContract: Payment expired");
        require(record.amount > 0, "EscrowContract: Invalid amount");
        
        // 2. 更新状态
        record.status = Status.CAPTURED;
        
        // 3. 转移代币给收款方
        IERC20(record.token).safeTransfer(record.payee, record.amount);
        
        // 4. 发出事件
        emit PaymentCaptured(intentHash, msg.sender, record.amount);
    }

    /**
     * @dev 退款处理 - 将托管资金退回给付款方
     * @param intentHash 支付意图哈希
     * @param reason 退款原因
     */
    function refundPayment(
        bytes32 intentHash,
        string calldata reason
    ) external whenNotPaused nonReentrant {
        EscrowRecord storage record = escrowRecords[intentHash];
        
        // 1. 验证调用权限（操作员或付款方本人）
        require(
            operators[msg.sender] || msg.sender == record.payer,
            "EscrowContract: Not authorized for refund"
        );
        
        // 2. 验证托管记录状态
        require(record.status == Status.AUTHORIZED, "EscrowContract: Invalid status for refund");
        require(record.amount > 0, "EscrowContract: Invalid amount");
        
        // 3. 更新状态
        record.status = Status.REFUNDED;
        
        // 4. 退款给付款方
        IERC20(record.token).safeTransfer(record.payer, record.amount);
        
        // 5. 发出事件
        emit PaymentRefunded(intentHash, record.payer, record.amount, reason);
    }

    /**
     * @dev 自动退款过期支付
     * @param intentHash 支付意图哈希
     */
    function autoRefundExpired(bytes32 intentHash) external whenNotPaused nonReentrant {
        EscrowRecord storage record = escrowRecords[intentHash];
        
        // 1. 验证托管记录状态
        require(record.status == Status.AUTHORIZED, "EscrowContract: Invalid status for auto refund");
        require(record.expiryTime <= block.timestamp, "EscrowContract: Payment not expired");
        require(record.amount > 0, "EscrowContract: Invalid amount");
        
        // 2. 更新状态
        record.status = Status.EXPIRED;
        
        // 3. 退款给付款方
        IERC20(record.token).safeTransfer(record.payer, record.amount);
        
        // 4. 发出事件
        emit PaymentRefunded(intentHash, record.payer, record.amount, "Auto refund - payment expired");
    }
}