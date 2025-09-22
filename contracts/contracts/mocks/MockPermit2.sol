// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IPermit2.sol";

/**
 * @title MockPermit2
 * @dev 用于测试的模拟Permit2合约
 */
contract MockPermit2 is IPermit2 {
    using SafeERC20 for IERC20;

    /// @dev 用户nonce位图
    mapping(address => mapping(uint256 => uint256)) public override nonceBitmap;

    /// @dev 域分隔符
    bytes32 public override DOMAIN_SEPARATOR;

    constructor() {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
                keccak256("Permit2"),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @dev 模拟permitTransferFrom功能
     * 简化实现，不进行签名验证
     */
    function permitTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external override {
        // 简化实现：直接转移代币，不验证签名
        require(permit.deadline > block.timestamp, "MockPermit2: Permit expired");
        require(transferDetails.requestedAmount <= permit.permitted.amount, "MockPermit2: Insufficient amount");
        
        // 标记nonce为已使用
        _useNonce(owner, permit.nonce);
        
        // 转移代币
        IERC20(permit.permitted.token).safeTransferFrom(
            owner,
            transferDetails.to,
            transferDetails.requestedAmount
        );
    }

    /**
     * @dev 返回permit transfer from的哈希
     */
    function hashPermitTransferFrom(
        PermitTransferFrom memory permit,
        address spender,
        uint256 sigDeadline
    ) external pure override returns (bytes32) {
        return keccak256(
            abi.encode(
                permit.permitted.token,
                permit.permitted.amount,
                permit.nonce,
                permit.deadline,
                spender,
                sigDeadline
            )
        );
    }

    /**
     * @dev 使nonce失效
     */
    function invalidateUnorderedNonces(uint256 wordPos, uint256 mask) external override {
        nonceBitmap[msg.sender][wordPos] |= mask;
    }

    /**
     * @dev 获取nonce的位图位置
     */
    function bitmapPositions(uint256 nonce) external pure override returns (uint256 wordPos, uint256 bitPos) {
        wordPos = uint248(nonce >> 8);
        bitPos = uint8(nonce);
    }

    /**
     * @dev 获取nonce位图值
     */
    function nonceBitmapValue(address owner, uint256 nonce) external view override returns (uint256) {
        (uint256 wordPos, uint256 bitPos) = this.bitmapPositions(nonce);
        return (nonceBitmap[owner][wordPos] >> bitPos) & 1;
    }

    /**
     * @dev 检查nonce是否有效
     */
    function isValidNonce(address owner, uint256 nonce) external view override returns (bool) {
        return this.nonceBitmapValue(owner, nonce) == 0;
    }

    /**
     * @dev 内部函数：使用nonce
     */
    function _useNonce(address owner, uint256 nonce) internal {
        (uint256 wordPos, uint256 bitPos) = this.bitmapPositions(nonce);
        uint256 mask = 1 << bitPos;
        require(nonceBitmap[owner][wordPos] & mask == 0, "MockPermit2: Nonce already used");
        nonceBitmap[owner][wordPos] |= mask;
    }

    /**
     * @dev 测试辅助函数：重置nonce状态
     */
    function resetNonce(address owner, uint256 nonce) external {
        (uint256 wordPos, uint256 bitPos) = this.bitmapPositions(nonce);
        uint256 mask = ~(1 << bitPos);
        nonceBitmap[owner][wordPos] &= mask;
    }

    /**
     * @dev 测试辅助函数：批量设置代币授权
     */
    function setTokenAllowance(address token, address owner, address spender, uint256 amount) external {
        // 这是一个测试辅助函数，实际Permit2不会有这个功能
        // 用于在测试中模拟代币授权
    }
}