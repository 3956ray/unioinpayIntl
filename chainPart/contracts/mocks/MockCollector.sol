// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockCollector {
    using SafeERC20 for IERC20;

    // 模拟 collectTokens 函数，用于测试 Escrow 合约
    function collectTokens(
        IEscrow.PaymentInfo calldata paymentInfo,
        address tokenStore,
        uint256 amount,
        bytes calldata collectorData
    ) external {
        IERC20 token = IERC20(paymentInfo.token);
        
        // 使用 collectorData 来确定转移方向
        // 如果 collectorData 是 "refund"，从操作者转移
        // 否则从付款人转移（默认行为）
        if (collectorData.length > 0 && keccak256(collectorData) == keccak256("refund")) {
            // 退款场景：从操作者转移代币到 tokenStore
            token.safeTransferFrom(paymentInfo.operator, tokenStore, amount);
        } else {
            // 授权/收费场景：从付款人转移代币到 tokenStore
            token.safeTransferFrom(paymentInfo.payer, tokenStore, amount);
        }
    }
}

// 定义 IEscrow.PaymentInfo 结构体，以便 MockCollector 能够使用
interface IEscrow {
    struct PaymentInfo {
        address operator;
        address payer;
        address receiver;
        address token;
        uint120 maxAmount;
        uint48 preApprovalExpiry;
        uint48 authorizationExpiry;
        uint48 refundExpiry;
        uint16 minFeeBps;
        uint16 maxFeeBps;
        address feeReceiver;
        uint256 salt;
    }
}