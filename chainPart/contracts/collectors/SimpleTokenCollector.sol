// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./TokenCollector.sol";

/// @title SimpleTokenCollector
/// @notice A simple implementation of TokenCollector for basic ERC20 transfers
contract SimpleTokenCollector is TokenCollector {
    using SafeERC20 for IERC20;

    /// @notice Constructor
    /// @param escrow_ Address of the Escrow contract
    constructor(address escrow_) TokenCollector(escrow_) {}

    /// @notice Returns the collector type
    function collectorType() external pure override returns (CollectorType) {
        return CollectorType.Payment;
    }

    /// @notice Internal implementation of token collection
    /// @param paymentInfo Payment information
    /// @param tokenStore Address of the token store
    /// @param amount Amount of tokens to collect
    /// @param collectorData Additional data (used to determine transfer direction)
    function _collectTokens(
        Escrow.PaymentInfo calldata paymentInfo,
        address tokenStore,
        uint256 amount,
        bytes calldata collectorData
    ) internal override {
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