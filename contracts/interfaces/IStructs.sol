// SPDX-License-Identifier: MIT

pragma solidity >=0.8.3;
pragma abicoder v2;

import "./I0XExchangeCore.sol";

struct MintParams {
    address token0;
    address token1;
    uint24 fee;
    int24 tickLower;
    int24 tickUpper;
    uint256 amount0Desired;
    uint256 amount1Desired;
    uint256 amount0Min;
    uint256 amount1Min;
    address recipient;
    uint256 deadline;
}

struct IncreaseLiquidityParams {
    uint256 tokenId;
    uint256 amount0Desired;
    uint256 amount1Desired;
    uint256 amount0Min;
    uint256 amount1Min;
    uint256 deadline;
}

struct DecreaseLiquidityParams {
    uint256 tokenId;
    uint128 liquidity;
    uint256 amount0Min;
    uint256 amount1Min;
    uint256 deadline;
}
struct CollectParams {
    uint256 tokenId;
    address recipient;
    uint128 amount0Max;
    uint128 amount1Max;
}
struct ExactInputSingleParams {
    address tokenIn;
    address tokenOut;
    uint24 fee;
    address recipient;
    uint256 deadline;
    uint256 amountIn;
    uint256 amountOutMinimum;
    uint160 sqrtPriceLimitX96;
}

struct ExactInputParams {
    bytes path;
    address recipient;
    uint256 deadline;
    uint256 amountIn;
    uint256 amountOutMinimum;
}

struct ExactOutputSingleParams {
    address tokenIn;
    address tokenOut;
    uint24 fee;
    address recipient;
    uint256 deadline;
    uint256 amountOut;
    uint256 amountInMaximum;
    uint160 sqrtPriceLimitX96;
}

struct ExactOutputParams {
    bytes path;
    address recipient;
    uint256 deadline;
    uint256 amountOut;
    uint256 amountInMaximum;
}

struct V3LiqudityParams {
    address pooladdr;
    uint256 removeTokenId;
    uint256 addTokenId;
    address addToken;
    int24 tickOffset; //偏移几个takeSpacing
    int24 tickRange; //做市范围
    uint256 amount;
}
struct PreCheckParams {
    address from; //追单用户地址
    uint256 fromBalancePreEthBefore; //如果想在此用户前交易,就填这个
    uint256 fromBalancePreEthAfter; //如果想在此用户后交易,就填这个eth余额
    uint256 poolLiqudityPre; // 池子下单时tick的liquidity
    int24 tick; // 池子下单时tick
    uint256 deadlineBlockNumer; // 最晚成交
}

struct SwapCheckParams {
    PreCheckParams pre;
    uint256 botBalanceAfterToken0Delta; //最小成交,绝对值小于这个就放弃
}

struct TrendingAddress {
    address addr;
}
struct TrendingNext {
    uint8 dxType;
}
struct PlaceOrderHeader {
    uint8 orderLen;
    address tokenStart;
    address tokenEnd;
    uint256 volume;
    uint256 volumeMinTo;
    uint256 startTokenWei; //1e18,起始币精度
    //相当于路径价格,链下传入
    uint256 ReferencePriceX96; //The best pool's spot price as of order placement from offline; measured as "One token0 exchange to how many token1"
    //下单量，相当于volume
    uint256 ReferenceNotional; //The Initial order notional instructed by off-chain
    uint256 MinOrderSize; //链上计算
    uint256 GreenLightSlippageThreshold; //Allowed slippage that an order can be placed right away, for example, 0.1%
    //滑点大于这个值的部分就不下了,相当于计算最大下单量的参数
    //Worst slippage tolerance, above which additional notionals make no sense. For example, 0.5%, or can be changed depending on size of opportunity
    uint256 CutoffSlippageThreshold;
    // int256 minShift0;
    // int256 minShift1;
    // int256 minShift2;
}
struct PlaceOrderPath {
    uint8 dxType;
    uint8 side;
    uint16 fee;
    int24 tick;
    address addr;
    address tokenFrom;
    address tokenTo;
    uint112 reserve0; //
    uint112 reserve1; //
    uint256 priceX96;
    //int256 MaxNotional; //最大下单量
}
struct PlaceOrderData {
    //链上路径价格,已经把fee计算进去了
    uint256 SpotPriceX96;
    // int160 MarketAdverseShift; //价格糟糕方向的移动量
    //滑点链下计算就可以
    uint256 SlippageRate; //Pre-calculate the slippage rate of each path that is provided from off-chain,传入
    uint256 ReverseSlippageRate; //计算滑点率的倒数,链下计算
    // uint256 MinOrderSize; //The minimum order size that can be placed for a certain path
    int256 MarketAdverseShift; //糟糕方向的移动
    uint256 OrderNotional; //本路径下单量
    PlaceOrderPath[] path;
}

struct PlaceOrderInput {
    uint256 OrderNotionalAll;
    PlaceOrderHeader header;
    PlaceOrderData[] orders;
    // uint256[] RankingMap; //排序后的订单,计算用
}

//池子基础信息
struct PoolBaseData {
    uint8 poolId; //暂时先只支持255个池子
    uint8 dxType;
    uint16 fee;
    address addr;
    address token0;
    address token1;
    // bytes32 extData;
    // uint256 wei0; //精度
    // uint256 wei1; //精度
    // string symbol; //名称 这个太费gas了,不能加
}

//交易对信息,支持多账号和多币种下单,全部字段不要超过32字节,节省gas
struct PairBaseData {
    uint8 pairId; //暂时先只支持255个池子
    uint32 nonce; //订单自增号,<=订单号的交易都会被直接扔掉
    int112 position0; //token0的头寸
    int112 position1; //token1的头寸
}
