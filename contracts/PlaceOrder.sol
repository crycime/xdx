// SPDX-License-Identifier: MIT

pragma solidity >=0.8.3;
pragma abicoder v2;

import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IStructs.sol";
import "./interfaces/IPlaceOrder.sol";
import "./interfaces/ITrendingCall.sol";
import "./libraries/AssetsManager.sol";
import "./interfaces/IBalancer.sol";
import "./interfaces/IUniswapV3Pool.sol";

contract PlaceOrder is AssetsManager, IPlaceOrder {
    uint256 private constant MAX_UINT96 = 2**96;
    uint256 private constant MAX_UINT96X96 = MAX_UINT96 * MAX_UINT96;
    uint256 private constant SQUARE_UINT96 = MAX_UINT96 * MAX_UINT96;
    uint160 private constant MIN_SQRT_RATIO = 4295128739 + 1;
    uint160 private constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342 - 1;
    address private constant CONTRACT_BALANCER_VAULT_ADDRESS = 0xBA12222222228d8Ba445958a75a0704d566BF2C8; //mati

    //当前调用的池子,安全检查用
    // address private _currentPool;//这里不再需要,因为目前不是用回调的方式打币了
    //池子列表
    PoolBaseData[] private _poolList;

    constructor(address assetsManager) AssetsManager(assetsManager) {}

    receive() external payable {}

    function getPoolList() public view returns (PoolBaseData[] memory pools) {
        return _poolList;
    }

    function addPoolList(PoolBaseData[] calldata pools) public onlyWhitelist {
        for (uint256 i = 0; i < _poolList.length; i++) {
            for (uint256 j = 0; j < pools.length; j++) {
                require(_poolList[i].addr != pools[j].addr, "D"); //重复检查
            }
        }
        for (uint256 index = 0; index < pools.length; index++) {
            _poolList.push(pools[index]);
        }
    }

    function updatePoolData(PoolBaseData calldata pool) public onlyWhitelist {
        _poolList[pool.poolId] = pool;
    }

    function decodePlaceOrderInput(bytes calldata data) public view returns (PlaceOrderInput memory orderInput) {
        uint256 index = 0;
        orderInput.header.orderLen = uint8(data[index++]);
        // orderInput.header.Notional = uint8(data[index++]);
        orderInput.header.startTokenWei = 10**uint8(data[index++]);
        uint8 MinOrderSizeRate = uint8(data[index++]);
        uint256 indexTo = index + 10;
        orderInput.header.volume = uint256(uint80(bytes10(data[index:indexTo])));
        orderInput.header.ReferenceNotional = uint256(orderInput.header.volume);
        orderInput.header.MinOrderSize = orderInput.header.ReferenceNotional / MinOrderSizeRate;
        index = indexTo;
        indexTo = index + 32;
        orderInput.header.ReferencePriceX96 = uint256(bytes32(data[index:indexTo]));
        index = indexTo;
        indexTo = index + 3;
        orderInput.header.GreenLightSlippageThreshold =
            ((uint256(uint24(bytes3(data[index:indexTo]))) << 96) * orderInput.header.startTokenWei) /
            1e6;
        index = indexTo;
        indexTo = index + 3;
        orderInput.header.CutoffSlippageThreshold =
            ((uint256(uint24(bytes3(data[index:indexTo]))) << 96) * orderInput.header.startTokenWei) /
            1e6;
        index = indexTo;
        orderInput.orders = new PlaceOrderData[](orderInput.header.orderLen);
        // orderInput.RankingMap = new uint256[](orderInput.header.orderLen);
        for (uint256 i = 0; i < orderInput.header.orderLen; i++) {
            PlaceOrderData memory orderData = orderInput.orders[i];
            uint8 pathLen = uint8(data[index++]);
            orderData.path = new PlaceOrderPath[](pathLen);
            indexTo = index + 3;
            //这里不能 * orderInput.header.startTokenWei
            orderData.SlippageRate = ((uint256(uint24(bytes3(data[index:indexTo]))) << 96)) / 1e7;
            index = indexTo;
            indexTo = index + 3;
            // orderData.ReverseSlippageRate =
            //     (uint256(uint24(bytes3(data[index:indexTo]))) << 96) *
            //     orderInput.header.startTokenWei;
            orderData.ReverseSlippageRate = (uint256(uint24(bytes3(data[index:indexTo]))) << 96);
            // orderData.MinOrderSize = MinOrderSize;
            index = indexTo;
            //做个检查,避免手抖风险
            address checkTokenTo;
            for (uint256 j = 0; j < pathLen; j++) {
                uint8 poolId = uint8(data[index++]);
                // PoolBaseData memory poolBaseData = getPoolData(poolId); //太费gas了
                PoolBaseData storage poolBaseData = _poolList[poolId];
                PlaceOrderPath memory pathData = orderData.path[j];
                pathData.side = uint8(data[index++]);
                pathData.addr = poolBaseData.addr;
                pathData.dxType = poolBaseData.dxType;
                pathData.fee = poolBaseData.fee;
                if (pathData.side == 0) {
                    pathData.tokenFrom = poolBaseData.token0;
                    pathData.tokenTo = poolBaseData.token1;
                } else {
                    pathData.tokenFrom = poolBaseData.token1;
                    pathData.tokenTo = poolBaseData.token0;
                }
                uint256 dxType = pathData.dxType % 10;
                if (dxType == 6) {
                    pathData.priceX96 = uint256(bytes32(data[index:index + 32]));
                    index += 32;
                    uint256 balanceFromOff = uint256(uint112(bytes14(data[index:index + 14])));
                    index += 14;
                    bytes32 balancerBoolId = IBalancerBasePool(pathData.addr).getPoolId();
                    (uint256 balanceFromOn, , , ) = IBalancerV2Vault(CONTRACT_BALANCER_VAULT_ADDRESS).getPoolTokenInfo(
                        balancerBoolId,
                        IERC20(pathData.tokenFrom)
                    );

                    //买的币增多说明已经有人下手了,放弃本条路径
                    if (balanceFromOff < balanceFromOn) {
                        pathData.priceX96 = 0;
                    }
                }
                require(checkTokenTo == address(0) || checkTokenTo == pathData.tokenFrom, "T");
                checkTokenTo = pathData.tokenTo;
                if (i == 0) {
                    if (orderInput.header.tokenStart == address(0)) {
                        orderInput.header.tokenStart = pathData.tokenFrom;
                    }
                    orderInput.header.tokenEnd = checkTokenTo;
                }
            }
        }
        calculateSpotPrice(orderInput);
    }

    //读取链上价格
    function calculateSpotPrice(PlaceOrderInput memory orderInput) private view {
        for (uint256 i = 0; i < orderInput.orders.length; i++) {
            PlaceOrderData memory orderData = orderInput.orders[i];
            orderData.SpotPriceX96 = MAX_UINT96;
            for (uint256 index = 0; index < orderData.path.length; index++) {
                PlaceOrderPath memory dataheader = orderData.path[index];
                uint256 dxType = dataheader.dxType / 10;
                if (dxType == 1) {
                    // (dataheader.reserve0, dataheader.reserve1) = (112998286156816, 29258406258411244659134);
                    // (dataheader.reserve0, dataheader.reserve1) = (29258406258411244659134, 29258406258411244659134); ///1:1价格
                    (dataheader.reserve0, dataheader.reserve1, ) = IUniswapV2Pair(dataheader.addr).getReserves();
                    if (dataheader.side == 0) {
                        dataheader.priceX96 = uint256((uint256(dataheader.reserve1) << 96) / dataheader.reserve0);
                    } else {
                        dataheader.priceX96 = uint256((uint256(dataheader.reserve0) << 96) / dataheader.reserve1);
                    }
                    orderData.SpotPriceX96 = (uint256(orderData.SpotPriceX96) * dataheader.priceX96) >> 96;
                    orderData.SpotPriceX96 = (orderData.SpotPriceX96 * (1e6 - dataheader.fee)) / 1e6;
                } else if (dxType == 7) {
                    (uint160 sqrtPriceX96, , , , , , ) = IUniswapV3Pool(dataheader.addr).slot0();
                    dataheader.priceX96 = (uint256(sqrtPriceX96)**2) >> 96;
                    if (dataheader.side == 1) {
                        dataheader.priceX96 = MAX_UINT96X96 / dataheader.priceX96;
                    }
                    orderData.SpotPriceX96 = (orderData.SpotPriceX96 * dataheader.priceX96) >> 96;
                    orderData.SpotPriceX96 = ((orderData.SpotPriceX96) * (1e6 - dataheader.fee)) / 1e6;
                } else if (dxType == 6) {
                    if (dataheader.priceX96 == 0) {
                        orderData.SpotPriceX96 = 0;
                        break;
                    } else {
                        orderData.SpotPriceX96 = (orderData.SpotPriceX96 * dataheader.priceX96) >> 96;
                        orderData.SpotPriceX96 = (orderData.SpotPriceX96 * (1e6 - dataheader.fee)) / 1e6;
                    }
                }
            }
        }
    }

    function getInputData(bytes calldata data) public view override returns (PlaceOrderInput memory orderInput) {
        orderInput = decodePlaceOrderInput(data);
        uint256 okIndex = type(uint256).max;
        for (uint256 i = 0; i < orderInput.orders.length; i++) {
            PlaceOrderData memory orderData = orderInput.orders[i];
            if (orderData.SpotPriceX96 == 0) {
                continue;
            }
            orderData.MarketAdverseShift =
                (int256((orderInput.header.ReferencePriceX96 << 96) / orderData.SpotPriceX96) - int256(MAX_UINT96)) *
                int256(orderInput.header.startTokenWei);
            //如果有一个能一次下完就不再计算其他
            if (
                i == 0 && //0以外概率太小,不尝试了
                orderData.MarketAdverseShift + int256(orderData.SlippageRate * orderInput.header.ReferenceNotional) <
                int256(orderInput.header.GreenLightSlippageThreshold)
            ) {
                orderData.OrderNotional = orderInput.header.ReferenceNotional;
                orderInput.OrderNotionalAll = orderData.OrderNotional;
                okIndex = i;
                break;
            }
        }
        if (okIndex == type(uint256).max) {
            uint256 NumberOfPaths = orderInput.orders.length;
            if (NumberOfPaths == 1) //Only ONE path needs to be considered
            {
                PlaceOrderData memory orderData = orderInput.orders[0];
                //计算最优下单量
                int256 MaxNotional = min(
                    int256(orderInput.header.CutoffSlippageThreshold),
                    orderData.MarketAdverseShift,
                    int256(orderData.ReverseSlippageRate),
                    int256(orderInput.header.ReferenceNotional)
                );
                if (MaxNotional >= int256(orderInput.header.MinOrderSize)) {
                    orderData.OrderNotional = uint256(MaxNotional);
                }
            } else {
                sortOrders(orderInput);
            }
            for (uint256 i = 0; i < orderInput.orders.length; i++) {
                PlaceOrderData memory orderData = orderInput.orders[i];
                orderInput.OrderNotionalAll += orderData.OrderNotional;
            }
        }
    }

    //订单排序
    function sortOrders(PlaceOrderInput memory orderInput) private pure {
        //Multiple paths should be considered - that means there are paths with close prices and decent liquidities
        //计算滑点率的倒数,顺便排序
        uint256 minIndex0 = 100;
        uint256 minIndex1 = 100;
        uint256 minIndex2 = 100;
        int256 minShift0;
        int256 minShift1;
        int256 minShift2;
        int256 MaxNotional = 0;
        // int256 CutoffSlippageThreshold = int256(orderInput.header.CutoffSlippageThreshold);
        int256 TotalReverseSlippageRate = 0;
        //简单排序,只支持3个长度的排序
        {
            for (uint256 i = 0; i < orderInput.orders.length; i++) {
                PlaceOrderData memory orderData = orderInput.orders[i];
                // if (orderData.OrderNotional == 0) {
                //     continue;
                // }
                //链下计算就可以
                // orderData.ReverseSlippageRate = uint160(uint256(SQUARE_UINT96) / orderData.SlippageRate);
                if (minIndex0 == 100 || minShift0 >= orderData.MarketAdverseShift) {
                    minShift2 = minShift1;
                    minIndex2 = minIndex1;
                    minShift1 = minShift0;
                    minIndex1 = minIndex0;
                    minShift0 = orderData.MarketAdverseShift;
                    minIndex0 = i;
                } else if (minIndex1 == 100 || minShift1 >= orderData.MarketAdverseShift) {
                    minShift2 = minShift1;
                    minIndex2 = minIndex1;
                    minShift1 = orderData.MarketAdverseShift;
                    minIndex1 = i;
                } else if (minIndex2 == 100 || minShift2 >= orderData.MarketAdverseShift) {
                    minShift2 = orderData.MarketAdverseShift;
                    minIndex2 = i;
                }
            }
        }
        PlaceOrderData memory rankOrder0 = orderInput.orders[minIndex0];
        PlaceOrderData memory rankOrder1;
        PlaceOrderData memory rankOrder2;
        if (minIndex1 != 100) {
            rankOrder1 = orderInput.orders[minIndex1];
            if (minIndex2 != 100) {
                rankOrder2 = orderInput.orders[minIndex2];
            }
        }

        //If even the best pool is quite far away. Just brake.
        if (!(rankOrder0.MarketAdverseShift > int256(orderInput.header.CutoffSlippageThreshold))) {
            uint256 RemainingNotional = orderInput.header.ReferenceNotional;
            uint256 Epsilon = orderInput.header.ReferenceNotional / 10;

            //First,consider the range from MarketAdverseShift[RankingMap[0]] to MarketAdverseShift[RankingMap[1]]
            //如果第二条路径不可用了,那就只用第一条就可以停止了
            if (rankOrder1.MarketAdverseShift > int256(orderInput.header.CutoffSlippageThreshold)) {
                //Only need to consider placing order to the best pool
                //计算最优下单量
                MaxNotional = min(
                    int256(orderInput.header.CutoffSlippageThreshold),
                    rankOrder0.MarketAdverseShift,
                    int256(rankOrder0.ReverseSlippageRate),
                    int256(RemainingNotional)
                );
                if (MaxNotional >= int256(orderInput.header.MinOrderSize)) {
                    rankOrder0.OrderNotional = uint256(MaxNotional);
                    // CheckFinished = true;
                }
            } else {
                bool CheckFinished = false;
                MaxNotional = min(
                    int256(rankOrder1.MarketAdverseShift),
                    rankOrder0.MarketAdverseShift,
                    int256(rankOrder0.ReverseSlippageRate),
                    int256(RemainingNotional)
                );
                if (
                    abs(int256(MaxNotional - int256(RemainingNotional))) < Epsilon
                ) //Can finish order placement with one go
                {
                    // if (MaxNotional >= int256(orderInput.header.MinOrderSize)) {
                    rankOrder0.OrderNotional = uint256(MaxNotional);
                    CheckFinished = true;
                    // }
                } else {
                    // if (MaxNotional >= int256(orderInput.header.MinOrderSize)) {
                    rankOrder0.OrderNotional = uint256(MaxNotional);
                    // }
                    RemainingNotional -= uint256(MaxNotional);
                }

                if ((!(CheckFinished)) && RemainingNotional > Epsilon) {
                    //Then consider the range from MarketAdverseShift[RankingMap[1]] to MarketAdverseShift[RankingMap[2]]
                    TotalReverseSlippageRate = int256(rankOrder0.ReverseSlippageRate + rankOrder1.ReverseSlippageRate);
                    if (rankOrder2.MarketAdverseShift > int256(orderInput.header.CutoffSlippageThreshold)) {
                        MaxNotional = min(
                            int256(orderInput.header.CutoffSlippageThreshold),
                            rankOrder1.MarketAdverseShift,
                            TotalReverseSlippageRate,
                            int256(RemainingNotional)
                        );
                        rankOrder0.OrderNotional += uint256(
                            (MaxNotional * int256(rankOrder0.ReverseSlippageRate)) / TotalReverseSlippageRate
                        );
                        rankOrder1.OrderNotional += uint256(
                            (MaxNotional * int256(rankOrder1.ReverseSlippageRate)) / TotalReverseSlippageRate
                        );
                        // CheckFinished = true;
                    } else {
                        MaxNotional = min(
                            rankOrder2.MarketAdverseShift,
                            rankOrder1.MarketAdverseShift,
                            TotalReverseSlippageRate,
                            int256(RemainingNotional)
                        );
                        rankOrder0.OrderNotional += uint256(
                            (MaxNotional * int256(rankOrder0.ReverseSlippageRate)) / TotalReverseSlippageRate
                        );
                        rankOrder1.OrderNotional += uint256(
                            (MaxNotional * int256(rankOrder1.ReverseSlippageRate)) / TotalReverseSlippageRate
                        );
                        RemainingNotional -= uint256(MaxNotional);
                        if ((!(CheckFinished)) && RemainingNotional > Epsilon) {
                            //Then consider the range outside of MarketAdverseShift[RankingMap[2]]
                            TotalReverseSlippageRate = int256(
                                rankOrder0.ReverseSlippageRate +
                                    rankOrder1.ReverseSlippageRate +
                                    rankOrder2.ReverseSlippageRate
                            );
                            MaxNotional = min(
                                int256(orderInput.header.CutoffSlippageThreshold),
                                rankOrder2.MarketAdverseShift,
                                TotalReverseSlippageRate,
                                int256(RemainingNotional)
                            );
                            rankOrder0.OrderNotional += uint256(
                                (MaxNotional * int256(rankOrder0.ReverseSlippageRate)) / TotalReverseSlippageRate
                            );
                            rankOrder1.OrderNotional += uint256(
                                ((MaxNotional * int256(rankOrder1.ReverseSlippageRate)) / TotalReverseSlippageRate)
                            );
                            rankOrder2.OrderNotional += uint256(
                                (MaxNotional * int256(rankOrder2.ReverseSlippageRate)) / TotalReverseSlippageRate
                            );
                            // CheckFinished = true;
                        }
                    }
                }
                //如果只剩最后一点,加给划掉最小的路径
                if (RemainingNotional < orderInput.header.MinOrderSize) {
                    if (rankOrder1.SlippageRate > 0 && rankOrder1.SlippageRate < rankOrder0.SlippageRate) {
                        rankOrder1.OrderNotional += RemainingNotional;
                    } else {
                        rankOrder0.OrderNotional += RemainingNotional;
                    }
                }
            }
        }
    }

    function abs(int256 x) private pure returns (uint256) {
        return uint256(x >= 0 ? x : -x);
    }

    function min(
        int256 CutoffSlippageThreshold,
        int256 MarketAdverseShift,
        int256 TotalReverseSlippageRate,
        int256 RemainingNotional
    ) private pure returns (int256 MaxNotional) {
        MaxNotional = ((((CutoffSlippageThreshold - MarketAdverseShift) >> 96) * TotalReverseSlippageRate) / 2) >> 96;
        if (MaxNotional > RemainingNotional) {
            MaxNotional = RemainingNotional;
        } else if (MaxNotional < 0) {
            MaxNotional = 0; //补漏
        }
    }

    //返还两个币的差额变化
    function trade(PlaceOrderInput memory orderInput, bool check) private returns (int256 amount0, int256 amount1) {
        //如果非白名单模式需要检查前后余额
        //因为是代理调过来的,得检查代理合约的费用而不是本合约费用
        uint256 balanceBefore = balanceOfMsgSender(orderInput.header.tokenEnd);
        uint256 volumeToAll;
        uint256 OrderNotionalAll = 0;
        for (uint256 i = 0; i < orderInput.orders.length; i++) {
            PlaceOrderData memory orderData = orderInput.orders[i];
            if (orderData.OrderNotional >= orderInput.header.MinOrderSize && orderData.OrderNotional > 0) {
                OrderNotionalAll += orderData.OrderNotional;
                uint256 volume = orderData.OrderNotional;
                uint8 dxType = 0;
                bool zeroForOne = true;

                for (uint256 index = 0; index < orderData.path.length; index++) {
                    PlaceOrderPath memory dataheader = orderData.path[index];
                    // require(dataheader.tokenFrom != dataheader.tokenTo, "T");
                    dxType = dataheader.dxType / 10;
                    zeroForOne = dataheader.side == 0;
                    if (dxType == 1) {
                        // _currentPool = dataheader.addr; //这里不再需要,因为目前不是用回调的方式打币了
                        volume = tradev2(volume, zeroForOne, dataheader);
                        // _currentPool = address(0x0);
                    } else if (dxType == 7) {
                        // _currentPool = dataheader.addr; //这里不需要了,因为资产合约里有控制
                        volume = tradev3(volume, zeroForOne, dataheader);
                        // _currentPool = address(0x0);
                    } else if (dxType == 6) {
                        volume = tradevBalancerV2(volume, dataheader);
                    }
                }
                volumeToAll += volume;
            }
        }
        //必须盈利,否则放弃
        //因为是代理调过来的,得检查代理合约的费用而不是本合约费用
        uint256 balanceAfter = balanceOfMsgSender(orderInput.header.tokenEnd);
        if (check) {
            //用Cutoff计算,如果orderInput.header.startTokenWei太小会有精度问题
            orderInput.header.volumeMinTo =
                (((OrderNotionalAll * orderInput.header.ReferencePriceX96) >> 96) *
                    ((orderInput.header.startTokenWei - (orderInput.header.CutoffSlippageThreshold >> 96)))) /
                orderInput.header.startTokenWei;
            require(balanceAfter >= (balanceBefore + orderInput.header.volumeMinTo), "N");
        }
        return
            orderInput.header.tokenStart < orderInput.header.tokenEnd
                ? (-int256(OrderNotionalAll), int256(volumeToAll))
                : (int256(volumeToAll), -int256(OrderNotionalAll));
    }

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut,
        uint16 fee
    ) internal pure returns (uint256 amountOut) {
        uint256 amountInWithFee = amountIn * (1e6 - fee);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1e6) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    function tradev2(
        uint256 amountIn,
        bool zeroForOne,
        PlaceOrderPath memory dataheader
    ) private returns (uint256) {
        uint256 amount0Out = 0;
        uint256 amount1Out = 0;
        uint256 balancerBefore = IERC20(dataheader.tokenFrom).balanceOf(dataheader.addr);
        ITrendingCall(msg.sender).placeOrderFixTransfer(dataheader.tokenFrom, dataheader.addr, uint256(amountIn));
        uint256 balancerAfter = IERC20(dataheader.tokenFrom).balanceOf(dataheader.addr);
        amountIn = balancerAfter - balancerBefore;
        if (zeroForOne) {
            amount1Out = getAmountOut(amountIn, dataheader.reserve0, dataheader.reserve1, dataheader.fee);
        } else {
            amount0Out = getAmountOut(amountIn, dataheader.reserve1, dataheader.reserve0, dataheader.fee);
        }
        //IERC20(dataheader.tokenFrom).transfer(dataheader.addr, uint256(amountIn));
        IUniswapV2Pair(dataheader.addr).swap(amount0Out, amount1Out, address(msg.sender), "");
        uint256 amount = amount1Out > 0 ? amount1Out : amount0Out;
        uint256 balance = IERC20(dataheader.tokenTo).balanceOf(address(msg.sender));
        require(amount > 0, "ZA");
        require(balance > 0, "ZB");
        if (amount > balance) {
            amount = balance;
        }
        return amount;
    }

    function tradev3(
        uint256 amountIn,
        bool zeroForOne,
        PlaceOrderPath memory dataheader
    ) private returns (uint256) {
        (int256 amount0, int256 amount1) = IUniswapV3Pool(dataheader.addr).swap(
            address(msg.sender),
            zeroForOne,
            int256(amountIn),
            zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO,
            abi.encode(dataheader.addr, address(msg.sender), dataheader.tokenFrom)
        );
        if (zeroForOne) {
            return uint256(amount1 < 0 ? -amount1 : amount1);
        } else {
            return uint256(amount0 < 0 ? -amount0 : amount0);
        }
    }

    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external {
        require(amount0Delta > 0 || amount1Delta > 0, "V30");
        (address pool, address payer, address token) = abi.decode(data, (address, address, address));
        require(msg.sender == address(pool), "V3");

        int256 amountDelta = amount0Delta > 0 ? amount0Delta : amount1Delta;
        ITrendingCall(payer).placeOrderFixTransfer(token, msg.sender, uint256(amountDelta));
    }

    function tradevBalancerV2(uint256 amountIn, PlaceOrderPath memory dataheader) private returns (uint256 amountOut) {
        ITrendingCall(msg.sender).placeOrderApprove(dataheader.tokenFrom, dataheader.addr, amountIn); //精确授权,避免诈骗合约
        bytes32 balancerBoolId = IBalancerBasePool(dataheader.addr).getPoolId();
        IBalancerV2Vault.SingleSwap memory request = IBalancerV2Vault.SingleSwap({
            poolId: balancerBoolId,
            kind: IBalancerV2Vault.SwapKind.GIVEN_IN,
            assetIn: IERC20(dataheader.tokenFrom),
            assetOut: IERC20(dataheader.tokenTo),
            amount: amountIn, // amount in
            userData: ""
        });

        IBalancerV2Vault.FundManagement memory funds = IBalancerV2Vault.FundManagement({
            sender: address(msg.sender),
            fromInternalBalance: false,
            recipient: payable(address(msg.sender)),
            toInternalBalance: false
        });
        amountOut = IBalancerV2Vault(CONTRACT_BALANCER_VAULT_ADDRESS).swap(request, funds, 1, block.timestamp);
    }

    //不做是否亏本检查,用来模拟运行
    function placeOrderCallReturn(bytes calldata data) public override returns (int256 amount0, int256 amount1) {
        PlaceOrderInput memory orderInput = getInputData(data);
        if (orderInput.OrderNotionalAll == 0) {
            return (0, 0);
        }
        return trade(orderInput, false);
    }

    function placeOrderCall(bytes calldata data) public override returns (int256 amount0, int256 amount1) {
        PlaceOrderInput memory orderInput = getInputData(data);
        if (orderInput.OrderNotionalAll == 0) {
            return (0, 0);
        }
        return trade(orderInput, true);
    }
}
