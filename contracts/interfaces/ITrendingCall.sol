// SPDX-License-Identifier: MIT

pragma solidity >=0.8.3;
pragma abicoder v2;

interface ITrendingCall {
    function placeOrderFixTransfer(
        address token,
        address to,
        uint256 value
    ) external;

    function placeOrderApprove(
        address token,
        address spender,
        uint256 value
    ) external;
}
