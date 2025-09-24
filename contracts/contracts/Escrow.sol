// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Create2.sol";

import "./TokenStore.sol";
import "./interfaces/IERC3009.sol";

/**
 * @title Escrow
 * @notice 基于ERC3009的支付托管合约 - MVP版本
 * @dev 实现授权(authorize)、收款(capture)、取消(void)和退款(refund)功能
 */
contract Escrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice 支付信息结构体，包含授权和收款所需的所有信息
    struct PaymentInfo {
        address operator;      // 负责驱动支付流程的实体
        address payer;         // 授权支付的付款人地址
        address receiver;      // 接收支付的地址(扣除费用后)
        address token;         // 代币合约地址
        uint120 maxAmount;     // 可以授权的代币数量
        uint48 preApprovalExpiry;    // 付款人预授权过期时间戳
        uint48 authorizationExpiry;  // 授权可以被收款的过期时间戳
        uint48 refundExpiry;         // 成功支付可以被退款的过期时间戳
        uint16 minFeeBps;      // 最小费用百分比(基点)
        uint16 maxFeeBps;      // 最大费用百分比(基点)
        address feeReceiver;   // 接收费用的地址，如果为0则操作者可以在收款时设置
        uint256 salt;          // 熵源，确保不同支付的哈希唯一性
    }

    /// @notice 支付状态结构体，用于跟踪支付的生命周期
    struct PaymentState {
        bool hasCollectedPayment;    // 如果支付已被授权或收费则为true
        uint120 capturableAmount;    // 当前在托管中可以被收款的代币数量
        uint120 refundableAmount;    // 之前已收款可以被退款的代币数量
    }

    /// @notice 用于哈希PaymentInfo结构体的类型哈希
    bytes32 public constant PAYMENT_INFO_TYPEHASH = keccak256(
        "PaymentInfo(address operator,address payer,address receiver,address token,uint120 maxAmount,uint48 preApprovalExpiry,uint48 authorizationExpiry,uint48 refundExpiry,uint16 minFeeBps,uint16 maxFeeBps,address feeReceiver,uint256 salt)"
    );

    uint16 internal constant _MAX_FEE_BPS = 10_000;

    /// @notice 操作者代币存储的实现合约
    address public immutable tokenStoreImplementation;

    /// @notice 每个唯一支付的状态
    mapping(bytes32 paymentInfoHash => PaymentState state) public paymentState;

    // 事件定义
    event PaymentCharged(
        bytes32 indexed paymentInfoHash,
        PaymentInfo paymentInfo,
        uint256 amount,
        address tokenCollector,
        uint16 feeBps,
        address feeReceiver
    );

    event PaymentAuthorized(
        bytes32 indexed paymentInfoHash, 
        PaymentInfo paymentInfo, 
        uint256 amount, 
        address tokenCollector
    );

    event PaymentCaptured(
        bytes32 indexed paymentInfoHash, 
        uint256 amount, 
        uint16 feeBps, 
        address feeReceiver
    );

    event PaymentVoided(bytes32 indexed paymentInfoHash, uint256 amount);
    event PaymentReclaimed(bytes32 indexed paymentInfoHash, uint256 amount);
    event PaymentRefunded(bytes32 indexed paymentInfoHash, uint256 amount, address tokenCollector);
    event TokenStoreCreated(address indexed operator, address tokenStore);

    // 错误定义
    error InvalidSender(address sender, address expected);
    error ZeroAmount();
    error AmountOverflow(uint256 amount, uint256 limit);
    error ExceedsMaxAmount(uint256 amount, uint256 maxAmount);
    error AfterPreApprovalExpiry(uint48 timestamp, uint48 expiry);
    error InvalidExpiries(uint48 preApproval, uint48 authorization, uint48 refund);
    error FeeBpsOverflow(uint16 feeBps);
    error InvalidFeeBpsRange(uint16 minFeeBps, uint16 maxFeeBps);
    error FeeBpsOutOfRange(uint16 feeBps, uint16 minFeeBps, uint16 maxFeeBps);
    error ZeroFeeReceiver();
    error InvalidFeeReceiver(address attempted, address expected);
    error TokenCollectionFailed();
    error PaymentAlreadyCollected(bytes32 paymentInfoHash);
    error AfterAuthorizationExpiry(uint48 timestamp, uint48 expiry);
    error InsufficientAuthorization(bytes32 paymentInfoHash, uint256 authorizedAmount, uint256 requestedAmount);
    error ZeroAuthorization(bytes32 paymentInfoHash);
    error BeforeAuthorizationExpiry(uint48 timestamp, uint48 expiry);
    error AfterRefundExpiry(uint48 timestamp, uint48 expiry);
    error RefundExceedsCapture(uint256 refund, uint256 captured);

    /// @notice 检查调用发送者是指定地址
    modifier onlySender(address sender) {
        if (msg.sender != sender) revert InvalidSender(msg.sender, sender);
        _;
    }

    /// @notice 确保金额非零且不会溢出存储
    modifier validAmount(uint256 amount) {
        if (amount == 0) revert ZeroAmount();
        if (amount > type(uint120).max) revert AmountOverflow(amount, type(uint120).max);
        _;
    }

    /// @notice 构造函数，自动部署TokenStore实现以供克隆
    constructor() {
        tokenStoreImplementation = address(new TokenStore(address(this)));
    }

    /// @notice 一步式从付款人转账到接收者
    /// @param paymentInfo PaymentInfo结构体
    /// @param amount 要收费和收款的金额
    /// @param tokenCollector 代币收集器地址
    /// @param collectorData 传递给代币收集器的数据
    /// @param feeBps 要应用的费用百分比(必须在最小/最大范围内)
    /// @param feeReceiver 接收费用的地址
    function charge(
        PaymentInfo calldata paymentInfo,
        uint256 amount,
        address tokenCollector,
        bytes calldata collectorData,
        uint16 feeBps,
        address feeReceiver
    ) external nonReentrant onlySender(paymentInfo.operator) validAmount(amount) {
        // 检查支付信息有效
        _validatePayment(paymentInfo, amount);

        // 检查费用参数有效
        _validateFee(paymentInfo, feeBps, feeReceiver);

        // 检查支付尚未收集
        bytes32 paymentInfoHash = getHash(paymentInfo);
        if (paymentState[paymentInfoHash].hasCollectedPayment) revert PaymentAlreadyCollected(paymentInfoHash);

        // 设置支付状态，包含可退款金额
        paymentState[paymentInfoHash] =
            PaymentState({hasCollectedPayment: true, capturableAmount: 0, refundableAmount: uint120(amount)});
        emit PaymentCharged(paymentInfoHash, paymentInfo, amount, tokenCollector, feeBps, feeReceiver);

        // 将代币转入托管
        _collectTokens(paymentInfo, amount, tokenCollector, collectorData);

        // 将代币转给接收者和费用接收者
        _distributeTokens(paymentInfo.token, paymentInfo.receiver, amount, feeBps, feeReceiver);
    }

    /// @notice 将资金从付款人转移到托管
    /// @param paymentInfo PaymentInfo结构体
    /// @param amount 要授权的金额
    /// @param tokenCollector 代币收集器地址
    /// @param collectorData 传递给代币收集器的数据
    function authorize(
        PaymentInfo calldata paymentInfo,
        uint256 amount,
        address tokenCollector,
        bytes calldata collectorData
    ) external nonReentrant onlySender(paymentInfo.operator) validAmount(amount) {
        // 检查支付信息有效
        _validatePayment(paymentInfo, amount);

        // 检查支付尚未收集
        bytes32 paymentInfoHash = getHash(paymentInfo);
        if (paymentState[paymentInfoHash].hasCollectedPayment) revert PaymentAlreadyCollected(paymentInfoHash);

        // 设置支付状态，包含可收款金额
        paymentState[paymentInfoHash] =
            PaymentState({hasCollectedPayment: true, capturableAmount: uint120(amount), refundableAmount: 0});
        emit PaymentAuthorized(paymentInfoHash, paymentInfo, amount, tokenCollector);

        // 将代币转入托管
        _collectTokens(paymentInfo, amount, tokenCollector, collectorData);
    }

    /// @notice 将之前托管的资金转给接收者
    /// @param paymentInfo PaymentInfo结构体
    /// @param amount 要收款的金额
    /// @param feeBps 要应用的费用百分比(必须在最小/最大范围内)
    /// @param feeReceiver 接收费用的地址
    function capture(
        PaymentInfo calldata paymentInfo, 
        uint256 amount, 
        uint16 feeBps, 
        address feeReceiver
    )
        external
        nonReentrant
        onlySender(paymentInfo.operator)
        validAmount(amount)
    {
        // 检查费用参数有效
        _validateFee(paymentInfo, feeBps, feeReceiver);

        // 检查在授权过期之前
        if (block.timestamp >= paymentInfo.authorizationExpiry) {
            revert AfterAuthorizationExpiry(uint48(block.timestamp), paymentInfo.authorizationExpiry);
        }

        // 检查托管中有足够的金额可收款
        bytes32 paymentInfoHash = getHash(paymentInfo);
        PaymentState memory state = paymentState[paymentInfoHash];
        if (state.capturableAmount < amount) {
            revert InsufficientAuthorization(paymentInfoHash, state.capturableAmount, amount);
        }

        // 更新支付状态，将可收款金额转换为可退款金额
        state.capturableAmount -= uint120(amount);
        state.refundableAmount += uint120(amount);
        paymentState[paymentInfoHash] = state;
        emit PaymentCaptured(paymentInfoHash, amount, feeBps, feeReceiver);

        // 将代币转给接收者和费用接收者
        _distributeTokens(paymentInfo.token, paymentInfo.receiver, amount, feeBps, feeReceiver);
    }

    /// @notice 永久取消支付授权
    /// @param paymentInfo PaymentInfo结构体
    function void(PaymentInfo calldata paymentInfo) external nonReentrant onlySender(paymentInfo.operator) {
        // 检查授权非零
        bytes32 paymentInfoHash = getHash(paymentInfo);
        uint256 authorizedAmount = paymentState[paymentInfoHash].capturableAmount;
        if (authorizedAmount == 0) revert ZeroAuthorization(paymentInfoHash);

        // 清除可收款金额状态
        paymentState[paymentInfoHash].capturableAmount = 0;
        emit PaymentVoided(paymentInfoHash, authorizedAmount);

        // 将代币从代币存储转给付款人
        _sendTokens(paymentInfo.operator, paymentInfo.token, paymentInfo.payer, authorizedAmount);
    }

    /// @notice 将托管的资金返还给付款人
    /// @param paymentInfo PaymentInfo结构体
    function reclaim(PaymentInfo calldata paymentInfo) external nonReentrant onlySender(paymentInfo.payer) {
        // 检查不在授权过期之前
        if (block.timestamp < paymentInfo.authorizationExpiry) {
            revert BeforeAuthorizationExpiry(uint48(block.timestamp), paymentInfo.authorizationExpiry);
        }

        // 检查授权非零
        bytes32 paymentInfoHash = getHash(paymentInfo);
        uint256 authorizedAmount = paymentState[paymentInfoHash].capturableAmount;
        if (authorizedAmount == 0) revert ZeroAuthorization(paymentInfoHash);

        // 清除可收款金额状态
        paymentState[paymentInfoHash].capturableAmount = 0;
        emit PaymentReclaimed(paymentInfoHash, authorizedAmount);

        // 将代币从代币存储转给付款人
        _sendTokens(paymentInfo.operator, paymentInfo.token, paymentInfo.payer, authorizedAmount);
    }

    /// @notice 将之前收款的代币返还给付款人
    /// @param paymentInfo PaymentInfo结构体
    /// @param amount 要退款的金额
    /// @param tokenCollector 代币收集器地址
    /// @param collectorData 传递给代币收集器的数据
    function refund(
        PaymentInfo calldata paymentInfo,
        uint256 amount,
        address tokenCollector,
        bytes calldata collectorData
    ) external nonReentrant onlySender(paymentInfo.operator) validAmount(amount) {
        // 检查退款尚未过期
        if (block.timestamp >= paymentInfo.refundExpiry) {
            revert AfterRefundExpiry(uint48(block.timestamp), paymentInfo.refundExpiry);
        }

        // 限制退款金额不超过之前收款的金额
        bytes32 paymentInfoHash = getHash(paymentInfo);
        uint120 captured = paymentState[paymentInfoHash].refundableAmount;
        if (captured < amount) revert RefundExceedsCapture(amount, captured);

        // 更新可退款金额
        paymentState[paymentInfoHash].refundableAmount = captured - uint120(amount);
        emit PaymentRefunded(paymentInfoHash, amount, tokenCollector);

        // 将代币转入托管并转发给付款人
        _collectTokens(paymentInfo, amount, tokenCollector, collectorData);
        _sendTokens(paymentInfo.operator, paymentInfo.token, paymentInfo.payer, amount);
    }

    /// @notice 获取PaymentInfo结构体的哈希
    /// @param paymentInfo PaymentInfo结构体
    /// @return 当前链和合约地址的支付信息哈希
    function getHash(PaymentInfo calldata paymentInfo) public view returns (bytes32) {
        bytes32 paymentInfoHash = keccak256(abi.encode(PAYMENT_INFO_TYPEHASH, paymentInfo));
        return keccak256(abi.encode(block.chainid, address(this), paymentInfoHash));
    }

    /// @notice 获取操作者的代币存储地址
    /// @param operator 要获取代币存储的操作者
    /// @return 操作者的代币存储地址
    function getTokenStore(address operator) public view returns (address) {
        return Create2.computeAddress(
            bytes32(bytes20(operator)),
            keccak256(abi.encodePacked(type(TokenStore).creationCode, abi.encode(address(this))))
        );
    }

    /// @notice 验证支付信息
    /// @param paymentInfo PaymentInfo结构体
    /// @param amount 要验证的金额
    function _validatePayment(PaymentInfo calldata paymentInfo, uint256 amount) internal view {
        // 检查金额不超过最大金额
        if (amount > paymentInfo.maxAmount) revert ExceedsMaxAmount(amount, paymentInfo.maxAmount);

        // 检查不在预授权过期之后
        if (block.timestamp >= paymentInfo.preApprovalExpiry) {
            revert AfterPreApprovalExpiry(uint48(block.timestamp), paymentInfo.preApprovalExpiry);
        }

        // 检查过期时间戳有效
        if (
            paymentInfo.preApprovalExpiry > paymentInfo.authorizationExpiry ||
            paymentInfo.authorizationExpiry > paymentInfo.refundExpiry
        ) {
            revert InvalidExpiries(
                paymentInfo.preApprovalExpiry,
                paymentInfo.authorizationExpiry,
                paymentInfo.refundExpiry
            );
        }

        // 检查费用范围有效
        if (paymentInfo.minFeeBps > paymentInfo.maxFeeBps) {
            revert InvalidFeeBpsRange(paymentInfo.minFeeBps, paymentInfo.maxFeeBps);
        }

        // 检查最大费用不超过100%
        if (paymentInfo.maxFeeBps > _MAX_FEE_BPS) revert FeeBpsOverflow(paymentInfo.maxFeeBps);
    }

    /// @notice 验证费用参数
    /// @param paymentInfo PaymentInfo结构体
    /// @param feeBps 费用百分比
    /// @param feeReceiver 费用接收者
    function _validateFee(PaymentInfo calldata paymentInfo, uint16 feeBps, address feeReceiver) internal pure {
        // 检查费用在允许范围内
        if (feeBps < paymentInfo.minFeeBps || feeBps > paymentInfo.maxFeeBps) {
            revert FeeBpsOutOfRange(feeBps, paymentInfo.minFeeBps, paymentInfo.maxFeeBps);
        }

        // 如果有费用，检查费用接收者非零
        if (feeBps > 0 && feeReceiver == address(0)) revert ZeroFeeReceiver();

        // 如果PaymentInfo指定了费用接收者，检查匹配
        if (paymentInfo.feeReceiver != address(0) && feeReceiver != paymentInfo.feeReceiver) {
            revert InvalidFeeReceiver(feeReceiver, paymentInfo.feeReceiver);
        }
    }

    /// @notice 将代币转入此合约
    /// @param paymentInfo PaymentInfo结构体
    /// @param amount 要收集的代币数量
    /// @param tokenCollector 代币收集器地址
    /// @param collectorData 传递给代币收集器的数据
    function _collectTokens(
        PaymentInfo calldata paymentInfo,
        uint256 amount,
        address tokenCollector,
        bytes calldata collectorData
    ) internal {
        // 测量代币存储余额变化，确保等于预期金额
        address token = paymentInfo.token;
        address tokenStore = getTokenStore(paymentInfo.operator);
        uint256 tokenStoreBalanceBefore = IERC20(token).balanceOf(tokenStore);
        
        // 确保TokenStore已部署
        if (tokenStore.code.length == 0) {
            bytes memory bytecode = abi.encodePacked(type(TokenStore).creationCode, abi.encode(address(this)));
            address deployedTokenStore = Create2.deploy(0, bytes32(bytes20(paymentInfo.operator)), bytecode);
            emit TokenStoreCreated(paymentInfo.operator, deployedTokenStore);
        }
        
        // 调用代币收集器收集代币
        (bool success,) = tokenCollector.call(
            abi.encodeWithSignature(
                "collectTokens((address,address,address,address,uint120,uint48,uint48,uint48,uint16,uint16,address,uint256),address,uint256,bytes)",
                paymentInfo,
                tokenStore,
                amount,
                collectorData
            )
        );
        require(success, "Token collection failed");
        
        uint256 tokenStoreBalanceAfter = IERC20(token).balanceOf(tokenStore);
        if (tokenStoreBalanceAfter != tokenStoreBalanceBefore + amount) revert TokenCollectionFailed();
    }

    /// @notice 从操作者的代币存储发送代币
    /// @param operator 要使用其代币存储的操作者
    /// @param token 要发送的代币
    /// @param recipient 接收代币的地址
    /// @param amount 要发送的代币数量
    function _sendTokens(address operator, address token, address recipient, uint256 amount) internal {
        // 尝试转移代币
        address tokenStore = getTokenStore(operator);
        (bool success,) = tokenStore.call(
            abi.encodeWithSignature("sendTokens(address,address,uint256)", token, recipient, amount)
        );
        require(success, "Token send failed");
    }

    /// @notice 分配代币给接收者和费用接收者
    /// @param token 代币地址
    /// @param receiver 接收者地址
    /// @param amount 总金额
    /// @param feeBps 费用百分比
    /// @param feeReceiver 费用接收者地址
    function _distributeTokens(
        address token,
        address receiver,
        uint256 amount,
        uint16 feeBps,
        address feeReceiver
    ) internal {
        // 计算费用金额
        uint256 feeAmount = (amount * feeBps) / _MAX_FEE_BPS;
        uint256 receiverAmount = amount - feeAmount;

        // 转移代币给接收者
        if (receiverAmount > 0) {
            IERC20(token).safeTransfer(receiver, receiverAmount);
        }

        // 转移费用给费用接收者
        if (feeAmount > 0) {
            IERC20(token).safeTransfer(feeReceiver, feeAmount);
        }
    }
}