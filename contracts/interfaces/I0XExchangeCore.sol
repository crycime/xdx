// SPDX-License-Identifier: MIT

pragma solidity >=0.8.3;
pragma abicoder v2;

/// @dev Interface to the V3 Exchange.
interface I0XExchangeV3 {
    enum OrderStatus {
        INVALID, // Default value
        INVALID_MAKER_ASSET_AMOUNT, // Order does not have a valid maker asset amount
        INVALID_TAKER_ASSET_AMOUNT, // Order does not have a valid taker asset amount
        FILLABLE, // Order is fillable
        EXPIRED, // Order has already expired
        FULLY_FILLED, // Order is fully filled
        CANCELLED // Order has been cancelled
    }

    struct Order {
        address makerAddress; // Address that created the order.
        address takerAddress; // Address that is allowed to fill the order. If set to 0, any address is allowed to fill the order.
        address feeRecipientAddress; // Address that will recieve fees when order is filled.
        address senderAddress; // Address that is allowed to call Exchange contract methods that affect this order. If set to 0, any address is allowed to call these methods.
        uint256 makerAssetAmount; // Amount of makerAsset being offered by maker. Must be greater than 0.
        uint256 takerAssetAmount; // Amount of takerAsset being bid on by maker. Must be greater than 0.
        uint256 makerFee; // Fee paid to feeRecipient by maker when order is filled.
        uint256 takerFee; // Fee paid to feeRecipient by taker when order is filled.
        uint256 expirationTimeSeconds; // Timestamp in seconds at which order expires.
        uint256 salt; // Arbitrary number to facilitate uniqueness of the order's hash.
        bytes makerAssetData; // Encoded data that can be decoded by a specified proxy contract when transferring makerAsset. The leading bytes4 references the id of the asset proxy.
        bytes takerAssetData; // Encoded data that can be decoded by a specified proxy contract when transferring takerAsset. The leading bytes4 references the id of the asset proxy.
        bytes makerFeeAssetData; // Encoded data that can be decoded by a specified proxy contract when transferring makerFeeAsset. The leading bytes4 references the id of the asset proxy.
        bytes takerFeeAssetData; // Encoded data that can be decoded by a specified proxy contract when transferring takerFeeAsset. The leading bytes4 references the id of the asset proxy.
    }
    // solhint-enable max-line-length

    /// @dev Order information returned by `getOrderInfo()`.
    struct OrderInfo {
        OrderStatus orderStatus; // Status that describes order's validity and fillability.
        bytes32 orderHash; // EIP712 typed data hash of the order (see LibOrder.getTypedDataHash).
        uint256 orderTakerAssetFilledAmount; // Amount of order that has already been filled.
    }

    struct FillResults {
        uint256 makerAssetFilledAmount; // Total amount of makerAsset(s) filled.
        uint256 takerAssetFilledAmount; // Total amount of takerAsset(s) filled.
        uint256 makerFeePaid; // Total amount of fees paid by maker(s) to feeRecipient(s).
        uint256 takerFeePaid; // Total amount of fees paid by taker to feeRecipients(s).
        uint256 protocolFeePaid; // Total amount of fees paid by taker to the staking contract.
    }

    /// @dev Fills the input order.
    /// @param order Order struct containing order specifications.
    /// @param takerAssetFillAmount Desired amount of takerAsset to sell.
    /// @param signature Proof that order has been created by maker.
    /// @return fillResults Amounts filled and fees paid by maker and taker.
    function fillOrder(
        Order calldata order,
        uint256 takerAssetFillAmount,
        bytes calldata signature
    ) external payable returns (FillResults memory fillResults);

    function getOrderInfo(Order memory order) external view returns (OrderInfo memory orderInfo);
}

// interface I0XExchangeV2 {
//     enum OrderStatus {
//         INVALID, // Default value
//         INVALID_MAKER_ASSET_AMOUNT, // Order does not have a valid maker asset amount
//         INVALID_TAKER_ASSET_AMOUNT, // Order does not have a valid taker asset amount
//         FILLABLE, // Order is fillable
//         EXPIRED, // Order has already expired
//         FULLY_FILLED, // Order is fully filled
//         CANCELLED // Order has been cancelled
//     }

//     // solhint-disable max-line-length
//     // struct Order {
//     //     address makerAddress;           // Address that created the order.
//     //     address takerAddress;           // Address that is allowed to fill the order. If set to 0, any address is allowed to fill the order.
//     //     address feeRecipientAddress;    // Address that will recieve fees when order is filled.
//     //     address senderAddress;          // Address that is allowed to call Exchange contract methods that affect this order. If set to 0, any address is allowed to call these methods.
//     //     uint256 makerAssetAmount;       // Amount of makerAsset being offered by maker. Must be greater than 0.
//     //     uint256 takerAssetAmount;       // Amount of takerAsset being bid on by maker. Must be greater than 0.
//     //     uint256 makerFee;               // Fee paid to feeRecipient by maker when order is filled.
//     //     uint256 takerFee;               // Fee paid to feeRecipient by taker when order is filled.
//     //     uint256 expirationTimeSeconds;  // Timestamp in seconds at which order expires.
//     //     uint256 salt;                   // Arbitrary number to facilitate uniqueness of the order's hash.
//     //     bytes makerAssetData;           // Encoded data that can be decoded by a specified proxy contract when transferring makerAsset. The leading bytes4 references the id of the asset proxy.
//     //     bytes takerAssetData;           // Encoded data that can be decoded by a specified proxy contract when transferring takerAsset. The leading bytes4 references the id of the asset proxy.
//     //     bytes makerFeeAssetData;        // Encoded data that can be decoded by a specified proxy contract when transferring makerFeeAsset. The leading bytes4 references the id of the asset proxy.
//     //     bytes takerFeeAssetData;        // Encoded data that can be decoded by a specified proxy contract when transferring takerFeeAsset. The leading bytes4 references the id of the asset proxy.
//     // }
//     // // solhint-enable max-line-length

//     // struct OrderInfo {
//     //     uint8 orderStatus;                    // Status that describes order's validity and fillability.
//     //     bytes32 orderHash;                    // EIP712 typed data hash of the order (see LibOrder.getTypedDataHash).
//     //     uint256 orderTakerAssetFilledAmount;  // Amount of order that has already been filled.
//     // }
//     // solhint-disable max-line-length
//     struct Order {
//         address makerAddress; // Address that created the order.
//         address takerAddress; // Address that is allowed to fill the order. If set to 0, any address is allowed to fill the order.
//         address feeRecipientAddress; // Address that will recieve fees when order is filled.
//         address senderAddress; // Address that is allowed to call Exchange contract methods that affect this order. If set to 0, any address is allowed to call these methods.
//         uint256 makerAssetAmount; // Amount of makerAsset being offered by maker. Must be greater than 0.
//         uint256 takerAssetAmount; // Amount of takerAsset being bid on by maker. Must be greater than 0.
//         uint256 makerFee; // Amount of ZRX paid to feeRecipient by maker when order is filled. If set to 0, no transfer of ZRX from maker to feeRecipient will be attempted.
//         uint256 takerFee; // Amount of ZRX paid to feeRecipient by taker when order is filled. If set to 0, no transfer of ZRX from taker to feeRecipient will be attempted.
//         uint256 expirationTimeSeconds; // Timestamp in seconds at which order expires.
//         uint256 salt; // Arbitrary number to facilitate uniqueness of the order's hash.
//         bytes makerAssetData; // Encoded data that can be decoded by a specified proxy contract when transferring makerAsset. The last byte references the id of this proxy.
//         bytes takerAssetData; // Encoded data that can be decoded by a specified proxy contract when transferring takerAsset. The last byte references the id of this proxy.
//     }
//     // solhint-enable max-line-length

//     struct FillResults {
//         uint256 makerAssetFilledAmount; // Total amount of makerAsset(s) filled.
//         uint256 takerAssetFilledAmount; // Total amount of takerAsset(s) filled.
//         uint256 makerFeePaid; // Total amount of ZRX paid by maker(s) to feeRecipient(s).
//         uint256 takerFeePaid; // Total amount of ZRX paid by taker to feeRecipients(s).
//     }

//     struct OrderInfo {
//         uint8 orderStatus; // Status that describes order's validity and fillability.
//         bytes32 orderHash; // EIP712 typed data hash of the order (see LibOrder.getTypedDataHash).
//         uint256 orderTakerAssetFilledAmount; // Amount of order that has already been filled.
//     }

//     /// @dev Fills the input order.
//     /// @param order Order struct containing order specifications.
//     /// @param takerAssetFillAmount Desired amount of takerAsset to sell.
//     /// @param signature Proof that order has been created by maker.
//     /// @return fillResults Amounts filled and fees paid by maker and taker.
//     function fillOrder(
//         Order memory order,
//         uint256 takerAssetFillAmount,
//         bytes memory signature
//     ) external returns (FillResults memory fillResults);

//     function getOrderInfo(Order memory order) external returns (OrderInfo memory orderInfo);
// }

interface IZeroxV4 {
    function fillLimitOrder(
        LimitOrder calldata order,
        Signature calldata signature,
        uint128 takerTokenFillAmount
    ) external payable returns (uint128 takerTokenFilledAmount, uint128 makerTokenFilledAmount);

    function fillRfqOrder(
        RfqOrder calldata order,
        Signature calldata signature,
        uint128 takerTokenFillAmount
    ) external returns (uint128 takerTokenFilledAmount, uint128 makerTokenFilledAmount);

    function fillOrKillRfqOrder(
        RfqOrder calldata order,
        Signature calldata signature,
        uint128 takerTokenFillAmount
    ) external returns (uint128 makerTokenFilledAmount);

    function fillOrKillLimitOrder(
        LimitOrder calldata order,
        Signature calldata signature,
        uint128 takerTokenFillAmount
    ) external payable returns (uint128 makerTokenFilledAmount);

    function getLimitOrderInfo(LimitOrder memory order) external view returns (OrderInfo memory orderInfo);

    function getLimitOrderRelevantState(LimitOrder memory order, Signature calldata signature)
        external
        view
        returns (
            OrderInfo memory orderInfo,
            uint128 actualFillableTakerTokenAmount,
            bool isSignatureValid
        );

    enum OrderStatus {
        INVALID,
        FILLABLE,
        FILLED,
        CANCELLED,
        EXPIRED
    }

    struct LimitOrder {
        address makerToken;
        address takerToken;
        uint128 makerAmount;
        uint128 takerAmount;
        uint128 takerTokenFeeAmount;
        address maker;
        address taker;
        address sender;
        address feeRecipient;
        bytes32 pool;
        uint64 expiry;
        uint256 salt;
    }

    /// @dev An RFQ limit order.
    struct RfqOrder {
        address makerToken;
        address takerToken;
        uint128 makerAmount;
        uint128 takerAmount;
        address maker;
        address taker;
        address txOrigin;
        bytes32 pool;
        uint64 expiry;
        uint256 salt;
    }

    /// @dev Info on a limit or RFQ order.
    struct OrderInfo {
        bytes32 orderHash;
        OrderStatus status;
        uint128 takerTokenFilledAmount;
    }

    /// @dev Allowed signature types.
    enum SignatureType {
        ILLEGAL,
        INVALID,
        EIP712,
        ETHSIGN
    }

    /// @dev Encoded EC signature.
    struct Signature {
        // How to validate the signature.
        SignatureType signatureType;
        // EC Signature data.
        uint8 v;
        // EC Signature data.
        bytes32 r;
        // EC Signature data.
        bytes32 s;
    }
}
