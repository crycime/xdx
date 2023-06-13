// SPDX-License-Identifier: MIT

pragma solidity >=0.8.3;
pragma abicoder v2;

import './libraries/SafeMath.sol';

import './interfaces/ISwapRouter.sol';
import './interfaces/IUniswapV3Pool.sol';
import './interfaces/INonfungiblePositionManager.sol';
import './interfaces/IERC20.sol';

/**
 * @dev Interface of the ERC20 standard as defined in the EIP. Does not include
 * the optional functions; to access them see `ERC20Detailed`.
 */

contract V3LiquidityBot {
    using SafeMath for uint256;

    INonfungiblePositionManager private nft;
    ISwapRouter private router;

    address private _owner;
    address private _currentPool;
    mapping(address => bool) private _whitelist;

    //0xC36442b4a4522E871399CD717aBDD847Ab11FE88
    constructor(address nftaddr, address routeraddr) {
        nft = INonfungiblePositionManager(nftaddr);
        router = ISwapRouter(routeraddr);
        _owner = msg.sender;
        _whitelist[_owner] = true;
    }

    function transferOwnership(address newOwner) public {
        if (msg.sender == _owner) {
            if (newOwner != address(0)) {
                _owner = newOwner;
            }
        }
    }

    //设置或者取消白名单
    function setWhitelist(address addr, bool set) public {
        if (msg.sender == _owner) {
            _whitelist[addr] = set;
        }
    }

    //检查是否为白名单用户
    function checkWhiteList(address addr) private view returns (bool) {
        if (addr == _owner) {
            return true;
        }
        return _whitelist[addr];
    }

    receive() external payable {}

    //提款只能owner
    function collect(address token, uint256 wad) public {
        //允许白名单用户给owner提
        if (checkWhiteList(msg.sender)) {
            if (token == address(0)) {
                payable(_owner).transfer(wad);
            } else {
                fixTransfer(token, _owner, wad);
                // IERC20(token).transfer(msg.sender, wad);
                //下面总是报错,先放弃吧
                // if (token == WETH_ADDRESS) {
                //     //先转成eth
                //     (bool sucess, ) = token.delegatecall(
                //         abi.encodeWithSelector(IWETH9.withdraw.selector, wad)
                //     );
                //     require(sucess);
                // }
            }
        }
    }

    function fixTransfer(
        address token,
        address to,
        uint256 value
    ) private {
        token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, uint256(value)));
    }

    // event ChangeLiqudity(address indexed from, uint256 indexed tokenId, uint256 amount0, uint256 amount1);

    //移除旧的
    function removeLiquidity(uint256 removeTokenId) private {
        (, , , , , , , uint128 liquidity, , , , ) = nft.positions(removeTokenId);
        DecreaseLiquidityParams memory params0 = DecreaseLiquidityParams({
            tokenId: removeTokenId,
            liquidity: liquidity,
            amount0Min: 0,
            amount1Min: 0,
            deadline: block.timestamp
        });
        //提取流动性
        if (params0.liquidity > 0) {
            nft.decreaseLiquidity(params0);
        }
        // functionDelegateCall(address(nft), abi.encodeWithSelector(nft.decreaseLiquidity.selector, params0), 'rem err');
        CollectParams memory params1 = CollectParams({
            tokenId: removeTokenId,
            recipient: address(this),
            amount0Max: type(uint128).max,
            amount1Max: type(uint128).max
        });
        //提取收益
        nft.collect(params1);
        //销毁
        nft.burn(removeTokenId);
        // functionDelegateCall(address(nft), abi.encodeWithSelector(nft.collect.selector, params1), 'col err');
    }

    //移动流动性,移除旧的,添加新的
    //为了减少gas,token0,token1,fee都传入吧
    function moveLiquidity(
        // address pooladdr,
        // uint256 removeTokenId,
        // uint256 addTokenId,
        // address addToken,
        // int24 tickRange,
        // uint256 amount, //添加额度 // address from, //追单用户地址 // uint256 fromBalancePreEthBefore, //如果想在此用户前交易,就填这个
        V3LiqudityParams calldata v3params,
        PreCheckParams calldata preparams // uint256 fromBalancePreEthAfter, //如果想在此用户后交易,就填这个eth余额 // int24 tickBest, // 池子下单时tick // uint256 deadlineBlockNumer // 最晚成交
    ) external payable {
        if (!checkWhiteList(msg.sender)) {
            return;
        }
        {
            if (preparams.deadlineBlockNumer != 0 && block.number > preparams.deadlineBlockNumer) {
                return;
            }
            if (preparams.fromBalancePreEthBefore > 0 && preparams.fromBalancePreEthBefore != preparams.from.balance) {
                return;
            }
            if (preparams.fromBalancePreEthAfter > 0 && preparams.fromBalancePreEthAfter >= preparams.from.balance) {
                return;
            }
        }
        IUniswapV3Pool pool = IUniswapV3Pool(v3params.pooladdr);
        (, int24 tick, , , , , ) = pool.slot0();
        if (preparams.tick > 0 && preparams.tick != tick) {
            return;
        }
        _currentPool = address(pool);
        if (v3params.removeTokenId != 0) {
            removeLiquidity(v3params.removeTokenId);
        }
        {
            address token0 = pool.token0();
            address token1 = pool.token1();
            uint24 fee = pool.fee();
            int24 tickLower;
            int24 tickUpper;
            uint256 amount0Desired;
            uint256 amount1Desired;
            uint256 amount = v3params.amount;
            if (amount == 0) {
                amount = IERC20(v3params.addToken).balanceOf(address(this));
            }
            int24 tickSpacing = pool.tickSpacing();
            if (v3params.addToken == token0) {
                if (tick >= 0) {
                    tickLower = ((tick + tickSpacing) / tickSpacing) * tickSpacing; //取整
                } else {
                    tickLower = -((-tick) / tickSpacing) * tickSpacing; //取整
                }
                tickLower = tickLower + v3params.tickOffset;
                tickUpper = tickLower + v3params.tickRange * tickSpacing;
                amount0Desired = amount;
            } else {
                if (tick >= 0) {
                    tickUpper = ((tick) / tickSpacing) * tickSpacing; //取整
                } else {
                    tickUpper = -((-tick + tickSpacing) / tickSpacing) * tickSpacing; //取整
                }
                tickUpper = tickUpper - v3params.tickOffset;
                tickLower = tickUpper - v3params.tickRange * tickSpacing;
                amount1Desired = amount;
            }
            if (v3params.addToken != address(0)) {
                IERC20(v3params.addToken).approve(address(nft), amount);
                if (v3params.addTokenId == 0) {
                    MintParams memory params = MintParams({
                        token0: token0,
                        token1: token1,
                        fee: fee,
                        tickLower: tickLower,
                        tickUpper: tickUpper,
                        amount0Desired: amount0Desired,
                        amount1Desired: amount1Desired,
                        amount0Min: 0,
                        amount1Min: 0,
                        recipient: address(this),
                        deadline: block.timestamp
                    });
                    nft.mint(params);
                    // functionDelegateCall(address(nft), abi.encodeWithSelector(nft.mint.selector, params), 'mint err');
                } else {
                    IncreaseLiquidityParams memory params = IncreaseLiquidityParams({
                        tokenId: v3params.addTokenId,
                        amount0Desired: amount0Desired,
                        amount1Desired: amount1Desired,
                        amount0Min: 0,
                        amount1Min: 0,
                        deadline: block.timestamp
                    });
                    nft.increaseLiquidity(params);
                    // functionDelegateCall(
                    //     address(nft),
                    //     abi.encodeWithSelector(nft.increaseLiquidity.selector, params),
                    //     'inc err'
                    // );
                }
            }
            // emit ChangeLiqudity(msg.sender, v3params.addTokenId, amount0Desired, amount1Desired);
        }
        // functionDelegateCall(address(nft), abi.encodeWithSelector(nft.mint.selector, params), 'mint err');
    }

    // function uniswapV3MintCallback(
    //     uint256 amount0,
    //     uint256 amount1,
    //     bytes calldata data
    // ) external {
    //     (address pool, address payer, address token0, address token1) = abi.decode(
    //         data,
    //         (address, address, address, address)
    //     );
    //     require(msg.sender == address(pool) && _currentPool == pool, 'V3');

    //     if (payer == address(this)) {
    //         if (amount0 > 0) IERC20(token0).transfer(msg.sender, amount0);
    //         if (amount1 > 0) IERC20(token1).transfer(msg.sender, amount1);
    //     } else {
    //         if (amount0 > 0) IERC20(token0).transferFrom(payer, msg.sender, amount0);
    //         if (amount1 > 0) IERC20(token1).transferFrom(payer, msg.sender, amount1);
    //     }
    // }

    // function balanceOf(address token, address addr) private view returns (uint256) {
    //     (bool success, bytes memory data) = token.staticcall(
    //         abi.encodeWithSelector(IERC20.balanceOf.selector, address(addr))
    //     );
    //     require(success && data.length >= 32);
    //     return abi.decode(data, (uint256));
    // }

    // function functionDelegateCall(
    //     address target,
    //     bytes memory data,
    //     string memory errorMessage
    // ) internal returns (bytes memory) {
    //     // solhint-disable-next-line avoid-low-level-calls
    //     (bool success, bytes memory returndata) = target.delegatecall(data);
    //     return _verifyCallResult(success, returndata, errorMessage);
    // }

    // function _verifyCallResult(
    //     bool success,
    //     bytes memory returndata,
    //     string memory errorMessage
    // ) private pure returns (bytes memory) {
    //     if (success) {
    //         return returndata;
    //     } else {
    //         // Look for revert reason and bubble it up if present
    //         if (returndata.length > 0) {
    //             // The easiest way to bubble the revert reason is using memory via assembly

    //             // solhint-disable-next-line no-inline-assembly
    //             assembly {
    //                 let returndata_size := mload(returndata)
    //                 revert(add(32, returndata), returndata_size)
    //             }
    //         } else {
    //             revert(errorMessage);
    //         }
    //     }
    // }
}
