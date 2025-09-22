// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IPermit2
 * @dev Uniswap Permit2接口定义
 * @dev 用于实现无Gas费的代币授权和转移
 */
interface IPermit2 {
    /// @notice The token and amount details for a transfer signed in the permit transfer signature
    struct TokenPermissions {
        // ERC20 token address
        address token;
        // the maximum amount that can be spent
        uint256 amount;
    }

    /// @notice The signed permit message for a single token transfer
    struct PermitTransferFrom {
        TokenPermissions permitted;
        // a unique value for every token owner's signature to prevent signature replays
        uint256 nonce;
        // deadline on the permit signature
        uint256 deadline;
    }

    /// @notice Specifies the recipient address and amount for batched transfers.
    /// @dev Recipients and amounts correspond to the index of the signed token permissions array.
    /// @dev Reverts if the requested amount is greater than the permitted signed amount.
    struct SignatureTransferDetails {
        // recipient address
        address to;
        // spender requested amount
        uint256 requestedAmount;
    }

    /// @notice A map from token owner address and a caller specified word index to a bitmap. Used to set bits in the bitmap to prevent against signature replay protection
    /// @dev Uses unordered nonces so that permit messages do not need to be spent in a certain order
    /// @dev The mapping is indexed first by the token owner, then by an index specified in the nonce
    /// @dev It returns a uint256 bitmap
    /// @dev The index, or wordPosition is capped at type(uint248).max
    function nonceBitmap(address, uint256) external view returns (uint256);

    /// @notice Transfers a token using a signed permit message
    /// @dev Reverts if the requested amount is greater than the permitted signed amount
    /// @dev Reverts if the signature is invalid
    /// @dev Reverts if the permit is expired
    /// @param permit The permit data signed over by the owner
    /// @param owner The owner of the tokens to transfer
    /// @param transferDetails Specifies the recipient and requested amount for the token transfer
    /// @param signature The signature to verify
    function permitTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;

    /// @notice Returns the domain separator for the current chain
    function DOMAIN_SEPARATOR() external view returns (bytes32);

    /// @notice Returns the hash of the permit transfer from data
    function hashPermitTransferFrom(
        PermitTransferFrom memory permit,
        address spender,
        uint256 sigDeadline
    ) external view returns (bytes32);

    /// @notice Invalidates the bits specified in mask for the bitmap at the word position
    /// @dev The wordPos is maxed at type(uint248).max
    /// @param wordPos A number to index the nonceBitmap at
    /// @param mask A bitmap masked against msg.sender's current bitmap at the word position
    function invalidateUnorderedNonces(uint256 wordPos, uint256 mask) external;

    /// @notice Returns the index of the bitmap and the bit position within the bitmap. Used for unordered nonces
    /// @param nonce The nonce to get the associated word and bit positions
    /// @return wordPos The word position or index into the nonceBitmap
    /// @return bitPos The bit position
    function bitmapPositions(uint256 nonce) external pure returns (uint256 wordPos, uint256 bitPos);

    /// @notice Checks whether a nonce is taken and returns the associated bitmap value
    /// @param owner The owner of the nonce
    /// @param nonce The nonce to check
    /// @return The bitmap value at the nonce's position
    function nonceBitmapValue(address owner, uint256 nonce) external view returns (uint256);

    /// @notice Checks whether a nonce is taken
    /// @param owner The owner of the nonce
    /// @param nonce The nonce to check
    /// @return True if the nonce is taken, false otherwise
    function isValidNonce(address owner, uint256 nonce) external view returns (bool);
}