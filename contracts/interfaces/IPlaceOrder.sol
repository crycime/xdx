// SPDX-License-Identifier: MIT

pragma solidity >=0.8.3;
pragma abicoder v2;

import "../interfaces/IStructs.sol";

interface IPlaceOrder {
    //不拆单下单
    function placeOrderCall(bytes calldata data) external returns (int256 amount0, int256 amount1);

    //模拟执行接口
    function placeOrderCallReturn(bytes calldata data) external returns (int256 amount0, int256 amount1);

    function getInputData(bytes calldata data) external view returns (PlaceOrderInput memory orderInput);
}
