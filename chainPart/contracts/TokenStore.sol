// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title TokenStore
/// @notice Holds funds for payments associated with a single operator
/// @dev Deployed on demand by Escrow via CREATE2
contract TokenStore {
    /// @notice Escrow singleton that created this token store
    address public immutable escrow;

    /// @notice Call sender is not Escrow
    error OnlyEscrow();

    /// @notice Constructor
    /// @param escrow_ Escrow singleton that created this token store
    constructor(address escrow_) {
        escrow = escrow_;
    }

    /// @notice Send tokens to a recipient, called by escrow during capture/refund
    /// @param token The token being sent
    /// @param recipient Address to receive the tokens
    /// @param amount Amount of tokens to send
    /// @return success True if the transfer was successful
    function sendTokens(address token, address recipient, uint256 amount) external returns (bool) {
        if (msg.sender != escrow) revert OnlyEscrow();
        SafeERC20.safeTransfer(IERC20(token), recipient, amount);
        return true;
    }
}