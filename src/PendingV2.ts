import { BigNumber } from 'ethers';
import {
  V3SwapLog,
  ExchangeMarket,
  GetIdByTokenAddress,
  ADDRESS_ZERO,
  MAX_UINT18_ZERO,
  PendingTransactionHash,
  TokenBaseInfo,
  usdt_address,
  wbnb_address,
  CONTRACT_BALANCER_VAULT_ADDRESS,
  USDT_ADDRESS,
} from './constants';
import { exchangeMarketAddressMap } from './Start';
import { SpotEx } from './SpotEx';
import { SpotDx } from './SpotDx';

//0x0723433efe7897fafd1fa1678441bc018ceae594 //pancake
let pending_from = '0x4d8620c6729c1737991369991f8f2d6fc0f9741f'; //biswap
let pending_to = '0x3a6d8ca21d1cf76f653a67577fa0d27453350dd8';
let METHORD_addLiquidity = '0xe8e33700'; //Function: addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline)
let METHORD_removeLiquidityWithPermit = '0x2195995c'; //Function: removeLiquidityWithPermit(address tokenA, address tokenB, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline, bool approveMax, uint8 v, bytes32 r, bytes32 s)""
let METHORD_swapExactTokensForTokensSupportingFeeOnTransferTokens = '0x5c11d795'; //Function: swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)
let METHORD_swapExactETHForTokensSupportingFeeOnTransferTokens = '0xb6f9de95'; //Function: swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline)
let METHORD_swapExactETHForTokens = '0x7ff36ab5'; //Function: swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline)
let METHORD_swapTokensForExactTokens = '0x8803dbee'; //Function: swapTokensForExactTokens(uint256 amountOut, uint256 amountInMax, address[] path, address to, uint256 deadline)
let METHORD_swapExactTokensForTokens = '0x38ed1739'; //Function: swapExactTokensForTokens(uint256,uint256,address[],address,uint256)
let METHORD_swapETHForExactTokens = '0xfb3bdb41'; //Function: swapETHForExactTokens(uint256,address[],address,uint256)
let METHORD_swapExactTokensForETHSupportingFeeOnTransferTokens = '0x791ac947'; //Function: swapExactTokensForETHSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)
let METHORD_swapExactTokensForETH = '0x18cbafe5'; //Function: swapExactTokensForETH(uint256,uint256,address[],address,uint256)

let amountAddressPoolMap = new Map<string, Map<string, { amount0: number; amount1: number }>>();
export let ParsePendingV2Transation = async (tx: PendingTransactionHash) => {
  try {
    let index = 0; //method
    let method = tx.input.substr(index, 10);
    index = index + 10;
    let amountOut = BigNumber.from(0);
    let amountIn = BigNumber.from(0);
    let receive_to_tmp = '';
    let receive_to = '';
    let deadline = BigNumber.from(0);
    let pathLen = 0;
    let tokenFrom_tmp = '';
    let tokenFromAddress = '';
    let tokenTo_tmp = '';
    let tokenToAddress = '';
    // console.log('pending:0:', tx.to, tokenStartAddress, tokenEndAddress, tx.hash);
    if (method == METHORD_addLiquidity) {
      console.log('pending:有人添加流动性:');
      return;
    } else if (method == METHORD_removeLiquidityWithPermit) {
      console.log('pending:有人移除流动性:');
      return;
    } else if (method == METHORD_swapExactTokensForTokensSupportingFeeOnTransferTokens) {
      console.log('pending:swap swapExactTokensForTokensSupportingFeeOnTransferTokens');
    } else if (method == METHORD_swapExactETHForTokensSupportingFeeOnTransferTokens) {
      console.log('pending:swap wapExactETHForTokens');
    } else if (method == METHORD_swapExactETHForTokens) {
      console.log('pending:swap wapExactETHForTokens');
    } else if (method == METHORD_swapTokensForExactTokens) {
      console.log('pending:swap swapTokensForExactTokens');
      amountOut = BigNumber.from('0x' + tx.input.substr(index, 64));
      index = index + 64;
      amountIn = BigNumber.from('0x' + tx.input.substr(index, 64));
      index = index + 64;
      index = index + 64; //数组标志
      receive_to_tmp = '0x' + tx.input.substr(index, 64);
      receive_to = '0x' + receive_to_tmp.substring(26);
      index = index + 64;
      deadline = BigNumber.from('0x' + tx.input.substr(index, 64));
      index = index + 64;
      pathLen = parseInt('0x' + tx.input.substr(index, 64));
      index = index + 64; //数组标志
      tokenFrom_tmp = '0x' + tx.input.substr(index, 64);
      tokenFromAddress = '0x' + tokenFrom_tmp.substring(26);
      index = index + 64;
      tokenTo_tmp = '0x' + tx.input.substr(index, 64);
      tokenToAddress = '0x' + tokenTo_tmp.substring(26);
    } else if (method == METHORD_swapExactTokensForTokens) {
      console.log('pending:swap swapExactTokensForTokens');
      amountIn = BigNumber.from('0x' + tx.input.substr(index, 64));
      index = index + 64;
      amountOut = BigNumber.from('0x' + tx.input.substr(index, 64));
      index = index + 64;
      index = index + 64; //数组标志
      receive_to_tmp = '0x' + tx.input.substr(index, 64);
      receive_to = '0x' + receive_to_tmp.substring(26);
      index = index + 64;
      deadline = BigNumber.from('0x' + tx.input.substr(index, 64));
      index = index + 64;
      pathLen = parseInt('0x' + tx.input.substr(index, 64));
      index = index + 64; //数组标志
      tokenFrom_tmp = '0x' + tx.input.substr(index, 64);
      tokenFromAddress = '0x' + tokenFrom_tmp.substring(26);
      index = index + 64;
      tokenTo_tmp = '0x' + tx.input.substr(index, 64);
      tokenToAddress = '0x' + tokenTo_tmp.substring(26);
    } else if (method == METHORD_swapETHForExactTokens) {
      console.log('pending:swap swapETHForExactTokens');
    } else if (method == METHORD_swapExactTokensForETHSupportingFeeOnTransferTokens) {
      console.log('pending:swap swapExactTokensForETHSupportingFeeOnTransferTokens');
    } else if (method == METHORD_swapExactTokensForETH) {
      console.log('pending:swap swapExactTokensForETH');
    } else {
      console.log('pending:未识别方法:', tx.to, method);
      return;
    }
    if (pathLen > 2) {
      console.log('pending:路径长度大于2,先忽略:', pathLen, tx.to, tx.hash);
      return;
    }
    // console.log('pending:1:', tx.to, tokenStartAddress, tokenEndAddress, tx.hash);
    let market = exchangeMarketAddressMap.get(tx.to + tokenFromAddress + tokenToAddress);
    if (!market) {
      // console.log('pending不关注的池子:', tokenStartAddress, tokenEndAddress);
      return;
    }
    //跟单:0x0723433efe7897fafd1fa1678441bc018ceae594
    // BUSD;
    if (market.symbol != 'PANCAKE-WBNB-BUSD-2500') {
      //USDT
      // if (market.symbol != 'PANCAKE-USDT-WBNB-2500') {
      console.log(
        'pending不关注的池子:',
        market.symbol,
        market.token0.symbol,
        market.token1.symbol,
        tx.from,
        tokenFromAddress,
        tokenToAddress,
      );
      return;
    }
    let poolMap = amountAddressPoolMap.get(tx.from);
    if (!poolMap) {
      poolMap = new Map<string, { amount0: number; amount1: number }>();
      amountAddressPoolMap.set(tx.from, poolMap);
    }
    let amount = poolMap.get(tx.to);
    if (!amount) {
      amount = { amount0: 0, amount1: 0 };
      amountAddressPoolMap.set(tx.from, poolMap);
    }
    let token0Address = market.token0.address.toLocaleLowerCase();
    let token1Address = market.token1.address.toLocaleLowerCase();
    // if ((pending_from == '' || tx.from == pending_from) && (pending_to == '' || tx.to == pending_to)) {
    console.log(
      'pending池子:',
      market.symbol,
      market.token0.symbol,
      market.token1.symbol,
      tokenFromAddress,
      token0Address,
      tokenToAddress,
      token1Address,
    );
    if (tokenFromAddress == token0Address && tokenToAddress == token1Address) {
      tx.createAt = Date.now();
      console.log(
        'pending:卖:',
        market.symbol,
        market.token0.symbol,
        market.token1.symbol,
        // (parseFloat(amountIn.toString()) / 1e18) * market.token0.priceUsd,
        parseFloat(amountOut.toString()) / 1e18,
        parseFloat(amountIn.toString()) / 1e18,
        parseFloat(amountOut.toString()) / 1e18 / (parseFloat(amountIn.toString()) / 1e18),
        market.bidAfterAllCost,
        market.owner?.market.bidAfterAllCost,
        tx.from,
        tx.to,
        tx.hash,
        tx.nonce,
        parseInt(tx.gasPrice) / 1e9,
      );
      if (tx.from == '0x0723433efe7897fafd1fa1678441bc018ceae594') {
        tx.gasPriceBig = BigNumber.from(tx.gasPrice);
        for (let tokenPath of market.owner.tokenPaths) {
          if (tokenPath.startToken.address == market.token0.address) {
            tokenPath.sellAmount(null, amountIn, tx.gasPriceBig.add(1e6));
            break;
          }
        }
      }
    } else if (tokenFromAddress == token1Address && tokenToAddress == token0Address) {
      tx.createAt = Date.now();
      console.log(
        'pending:买:',
        market.symbol,
        market.token0.symbol,
        market.token1.symbol,
        // (parseFloat(amountIn.toString()) / 1e18) * market.token1.priceUsd,
        parseFloat(amountIn.toString()) / 1e18,
        parseFloat(amountOut.toString()) / 1e18,
        parseFloat(amountOut.toString()) / 1e18 / (parseFloat(amountIn.toString()) / 1e18),
        market.askAfterAllCost,
        market.owner?.market.askAfterAllCost,
        tx.from,
        tx.to,
        tx.hash,
        tx.nonce,
        parseInt(tx.gasPrice) / 1e9,
      );
      if (tx.from == '0x0723433efe7897fafd1fa1678441bc018ceae594') {
        tx.gasPriceBig = BigNumber.from(tx.gasPrice);
        for (let tokenPath of market.owner.tokenPaths) {
          console.log(
            'xxxxxx:ParsePendingV2Transation:',
            tokenPath.startToken.address,
            market.token0.address,
            market.token1.address,
          );
          if (tokenPath.startToken.address == market.token1.address) {
            tokenPath.sellAmount(null, amountIn, tx.gasPriceBig.add(1e6));
            break;
          }
        }
      }
    }
  } catch (e) {
    console.log('pending:ParsePendingV2Transation:err:', e);
  }
};
