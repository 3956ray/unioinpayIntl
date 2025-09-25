// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../Escrow.sol";

/// @title TokenCollector
/// @notice Base contract for collecting tokens from users
abstract contract TokenCollector {
    /// @notice Types of token collectors
    enum CollectorType {
        Payment,
        Refund
    }

    /// @notice The Escrow contract that calls to collect tokens
    address public immutable escrow;

    /// @notice The type of collector
    function collectorType() external view virtual returns (CollectorType);

    /// @notice Only the Escrow contract can call this function
    error OnlyEscrow();

    /// @notice Constructor
    /// @param escrow_ Escrow singleton that calls to collect tokens
    constructor(address escrow_) {
        escrow = escrow_;
    }

    /// @notice Collect tokens from a user
    /// @param paymentInfo Payment information
    /// @param tokenStore Address of the token store
    /// @param amount Amount of tokens to collect
    /// @param collectorData Additional data needed for collection
    function collectTokens(
        Escrow.PaymentInfo calldata paymentInfo,
        address tokenStore,
        uint256 amount,
        bytes calldata collectorData
    ) external {
        if (msg.sender != escrow) revert OnlyEscrow();
        _collectTokens(paymentInfo, tokenStore, amount, collectorData);
    }

    /// @notice Internal function to collect tokens
    /// @param paymentInfo Payment information
    /// @param tokenStore Address of the token store
    /// @param amount Amount of tokens to collect
    /// @param collectorData Additional data needed for collection
    function _collectTokens(
        Escrow.PaymentInfo calldata paymentInfo,
        address tokenStore,
        uint256 amount,
        bytes calldata collectorData
    ) internal virtual;

    /// @notice Get a hash that is unique for a payment
    /// @param paymentInfo Payment information
    function _getHashPayerAgnostic(Escrow.PaymentInfo calldata paymentInfo) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                paymentInfo.token,
                paymentInfo.maxAmount,
                paymentInfo.preApprovalExpiry,
                paymentInfo.salt
            )
        );
    }
}