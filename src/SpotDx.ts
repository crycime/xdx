import { ethers, network, config } from 'hardhat';

import {
  Contract,
  Wallet,
  BigNumber,
  providers,
  Signer,
  Overrides,
  ContractFunction,
  ContractTransaction,
  ContractReceipt,
} from 'ethers';
import { sendBotMessage } from '../src/telegram-bot';

import { Logger } from 'log4js';

import { ParsePendingV2Transation } from './PendingV2';
import { SpotEx } from './SpotEx';
import { loopStartTime, tokenPaths, exchangeMarketAddressMap, PrintLineLog } from './Start';
import { ExchangeMarkets } from '../HedgeSettings';
import { BalancercalcOutGivenIn } from '../src/balancer';
import { PoolPairData } from '../src/balancer-labs/src/types';
import { scale, bnum, calcOutGivenIn } from '../src/balancer-labs/src/bmath';
import { calculateSpotPrice } from '../src/balancer-v2-monorepo/pvt/helpers/src/models/pools/stable/math';
import { getSpotPrice, getSlippageLinearizedSpotPriceAfterSwap } from '../src/balancer-labs/src/helpers';

import { TrendingCall } from '../typechain/TrendingCall';

import {
  TickMath,
  SqrtPriceMath,
  Position,
  TickListDataProvider,
  Tick as V3Tick,
  Pool as V3SdkPool,
} from '@uniswap/v3-sdk';
import { BigintIsh, JSBI } from '@uniswap/sdk';

import { Sleep } from './utils';
import { CancelPendingTransactoinAll, CancelPendingTransactoin } from '../src/transactions';
import { getOwnerPrivateKey, CONTRACT_ARBITRAGE_ADDRESS, PLACEORDER_CONTRACT_ADDRESS } from '../.privatekey';
import { PlaceOrder } from '../typechain/PlaceOrder';
import {
  V3SwapLog,
  ExchangeMarket,
  GetIdByTokenAddress,
  ADDRESS_ZERO,
  MAX_UINT18_ZERO,
  PendingTransactionHash,
  TokenBaseInfo,
  CONTRACT_BALANCER_VAULT_ADDRESS,
  USDT_ADDRESS,
} from './constants';
import { UniswapV3PoolABI, ERC20ABI } from './abi';
import { BalancerVaultABI, TrendingABI } from './TrendingABI';
import { defaultAbiCoderPacked } from '../src/abi/src.ts';
import { TokenPath } from '../src/TokenPath';
import { loopSpotCxs } from '../src/Start';
import {
  TrendingV2,
  TrendingV3,
  ParamTypeTrendingV2,
  ParamTypeTrendingV3,
  ParamTypePlaceOrderHeader,
  ParamTypeTrendingNext,
  PlaceOrderHeader,
  PlaceOrderInput,
  TryTrendingRet,
  PlaceOrderPath,
  TrendingZXExchangeV3,
  ParamTypeTrendingAddress,
  ParamTypeTrendingTokenToAddress,
  ParamTypeTrendingPrice,
  ParamTypeTrendingPriceX96,
  ParamTypeTrendingTick,
  ParamTrendingBalanceFrom,
  ParamTrendingTrendingPoolId,
  ParamTypePlaceOrderPath,
  ParamTrendingIndexFromTo,
  TrendingNext,
  InitPlaceOrderPoolList,
} from '../src/PlaceOrder';
import { RoyClient } from './RoyClient';
import moment from 'moment';
import { TransactionReceipt } from '@ethersproject/providers';

let MAX_INT256 = BigNumber.from('0x8000000000000000000000000000000000000000000000000000000000000000');
let TOPIC_UNISWAP_SYNC_V2 = ethers.utils.id('Sync(uint112,uint112)');
let TOPIC_UNISWAP_SWAP_V2 = ethers.utils.id('Swap(address,uint256,uint256,uint256,uint256,address)');
let TOPIC_UNISWAP_BURN_V2 = ethers.utils.id('Burn(address,uint256,uint256,address)');
let TOPIC_UNISWAP_MINT_V2 = ethers.utils.id('Mint(address,uint256,uint256)');

//event Swap(address indexed sender,address indexed recipient,int256 amount0,int256 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick)
let TOPIC_UNISWAP_SWAP_V3 = ethers.utils.id('Swap(address,address,int256,int256,uint160,uint128,int24)');
let TOPIC_UNISWAP_BURN_V3 = ethers.utils.id('Burn(address,int24,int24,uint128,uint256,uint256)');
let TOPIC_UNISWAP_MINT_V3 = ethers.utils.id('Mint(address,address,int24,int24,uint128,uint256,uint256)');
let TOPIC_BALANCER_VALT_SWAP = ethers.utils.id('Swap(bytes32,address,address,uint256,uint256)');
let TOPIC_BALANCER_VALT_SWAP_V1 = ethers.utils.id('LOG_SWAP(address,address,address,uint256,uint256)'); //LOG_SWAP(index_topic_1addresscaller,index_topic_2addresstokenIn,index_topic_3addresstokenOut,uint256tokenAmountIn,uint256tokenAmountOut)
let TOPIC_BALANCER_VALT_BALANCE = ethers.utils.id('PoolBalanceChanged(bytes32,address,address[],int256,uint256[])');
type UniSwapV2EventSync = {
  _reserve0: BigNumber;
  _reserve1: BigNumber;
};
type UniSwapV3EventSwap = {
  sender: string;
  recipient: string;
  amount0: BigNumber;
  amount1: BigNumber;
  sqrtPriceX96: BigNumber;
  liquidity: BigNumber;
  tick: number;
  // transactionHash: string;
  // blockNumber: number;
};
type BalancerV2EventSwap = {
  poolId: string;
  address: string;
  tokenIn?: string;
  tokenOut?: string;
  amountIn?: BigNumber;
  amountOut?: BigNumber;
};

export const MAX_UINT96 = BigNumber.from(2).pow(96); //.sub(1);

let instanceV3Contract: Contract;
let instanceErc20Contract: Contract;
let balancerVault: Contract;
// let roy_ws: RoyClient;
let roy_ws_block: RoyClient;

export let instancePlaceOrder: PlaceOrder;

let myprovider: providers.WebSocketProvider | providers.JsonRpcProvider | providers.BaseProvider = ethers.provider;
let commitprovider_ws: providers.WebSocketProvider;
let commitprovider: providers.WebSocketProvider | providers.JsonRpcProvider | providers.BaseProvider = ethers.provider;
let official_provider: providers.WebSocketProvider | providers.JsonRpcProvider | providers.BaseProvider =
  ethers.provider;
export let pendingprovider: providers.WebSocketProvider;
let config_network = config.networks[network.name] as any;
if (config_network && config_network.ipc) {
  myprovider = new providers.IpcProvider(config_network.ipc);
} else if (config_network && config_network.ws) {
  myprovider = ethers.getDefaultProvider(config_network.ws);
}
if (config_network && config_network.commit_url) {
  commitprovider = ethers.getDefaultProvider(config_network.commit_url);
}
if (config_network && config_network.commit_ws) {
  commitprovider_ws = ethers.getDefaultProvider(config_network.commit_ws) as providers.WebSocketProvider;
}
if (config_network && config_network.ofical_url) {
  official_provider = ethers.getDefaultProvider(config_network.ofical_url);
}
if (config_network && config_network.pending_ws) {
  pendingprovider = ethers.getDefaultProvider(config_network.pending_ws) as providers.WebSocketProvider;
}
let pending_ws: providers.WebSocketProvider;
let slaver_providers: providers.WebSocketProvider[] = [];
if (config_network && config_network.slavers) {
  for (const ws of config_network.slavers) {
    let slaver_ws = ethers.getDefaultProvider(ws) as providers.WebSocketProvider;
    slaver_providers.push(slaver_ws);
  }
}
export let feeData: providers.FeeData;
export let GetFeeData = () => {
  return feeData;
};
let confirmTransactionMap = new Map<string, number>();
let ownerBalance = BigNumber.from(0);

export let feeDatamaxFeePerGasBase = BigNumber.from(1679 * 1e9);
export let feeDatamaxFeePerGasMax = BigNumber.from(6787 * 1e9);

export function SetFeeDatamaxFeePerGasBase(wei: number) {
  feeDatamaxFeePerGasBase = BigNumber.from(wei);
}
export function SetFeeDatamaxFeePerGasMax(wei: number) {
  feeDatamaxFeePerGasMax = BigNumber.from(wei);
}
export function getV2AmountOut(amountIn: number, reserveIn: number, reserveOut: number, fee: number) {
  let amountInWithFee = amountIn * (1 - fee);
  let numerator = amountInWithFee * reserveOut;
  let denominator = reserveIn + amountInWithFee;
  return numerator / denominator;
}

//启动时的pnl值
export let StartRealizedPNL = 0;
export function SetStartRealizedPNL(set: number) {
  StartRealizedPNL = set;
}

//预先设定好要跟进的gas地址
export let pendingAddressGasMap = new Map<string, PendingTransactionHash>();
let pendingTransactionHashMap = new Map<string, PendingTransactionHash>();

process.on('uncaughtException', e => {
  console.log('uncaughtException,异常处理:', e);
  //   errno: -61,
  // code: 'ECONNREFUSED',
  // syscall: 'connect',
  // address: '127.0.0.1',
  // port: 18546
});

export enum FeeAmount {
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000,
}
export const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
  [FeeAmount.LOW]: 10,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 200,
};
export class SpotDx extends SpotEx {
  public lastSwapPendingLog: V3SwapLog;
  public id: string; //token.symbol+token1.symbol
  public instance: Contract; //V3Pool
  public lastLoopMsec: number;
  public commiter: Wallet;
  constructor(_market: ExchangeMarket, tokenPaths: TokenPath[], _commiter: Wallet) {
    super(_market, tokenPaths, _commiter);
    this.id = this.market.symbol;
    this.lastBlockConfirmPrice = 0;
    this.lastSwapPendingLog = {
      //       // let ev = erc20.interface.decodeEventLog(log.topics[0], log.data, log.topics);
      sender: '', //log.topics[1],
      recipient: '', //log.topics[2],
      amount0: 0,
      amount1: 0,
      sqrtPriceX96: 0,
      liquidity: 0,
      tick: 0,
      price: 0,
      tickPrice: 0,
    };
    this.lastLoopMsec = Date.now();
  }
  public UpdateBalance = async (msec: number) => {
    // console.log('模拟运行');
    return;
    if (this.market.token0.updateAt != msec) {
      this.market.token0.updateAt = msec;
      let instaneToken = instanceErc20Contract.attach(this.market.token0.address);
      let balance = parseFloat(await instaneToken.balanceOf(this.commiter.address)) / 10 ** this.market.token0.decimals;
      console.log(
        '更新余额:',
        this.market.ex,
        this.commiter.address,
        this.market.token0.address,
        balance,
        this.market.token0.balance,
      );
      this.market.token0.balance = balance;
    }
    if (this.market.token1.updateAt != msec) {
      this.market.token1.updateAt = msec;
      let instaneToken = instanceErc20Contract.attach(this.market.token1.address);
      let balance = parseFloat(await instaneToken.balanceOf(this.commiter.address)) / 10 ** this.market.token1.decimals;
      console.log(
        '更新余额:',
        this.market.ex,
        this.commiter.address,
        this.market.token1.address,
        balance,
        this.market.token1.balance,
      );
      this.market.token1.balance = balance;
    }
  };
  public Loop = async () => {};
  public Init = async () => {
    this.lastSwapPendingLog.address = this.market.address;
    this.instance = instanceV3Contract.attach(this.market.address);
    await this.getBlockConfirmPrice();
    let block = await instanceV3Contract.provider.getBlock('latest');
    if (lastBlockNumber < block.number) {
      lastBlockNumber = block.number;
      lastCommitBlockNumber = lastBlockNumber; //暂时关闭
    }

    SpotDxMap.set(this.id, this);
    lastBlockTime = Date.now();
    lastConfirmMsec = Date.now();
    return true;
  };
  public UpdateMinedPrice = async (event?: UniSwapV3EventSwap | UniSwapV2EventSync | BalancerV2EventSwap) => {
    let price = 0;
    if (event || this.market.poolId) {
      if (this.market.ex == 'univ3') {
        let ev = event as UniSwapV3EventSwap;
        price = parseFloat(ev.sqrtPriceX96.pow(2).div(MAX_UINT96).toString()) / 2 ** 96;
        price = price / 10 ** (this.market.token1.decimals - this.market.token0.decimals);
        console.log(
          'mined price v3:',
          this.market.symbol,
          this.lastBlockConfirmPrice,
          price,
          price / this.lastBlockConfirmPrice,
        );
        await this.getBlockConfirmPrice(ev);
      } else if (this.market.ex == 'univ2') {
        let ev = event as UniSwapV2EventSync;
        price = parseFloat(MAX_UINT96.mul(ev._reserve1).div(ev._reserve0).toString()) / 2 ** 96;
        price = price / 10 ** (this.market.token1.decimals - this.market.token0.decimals);
        console.log(
          'mined price v2:',
          this.market.symbol,
          this.lastBlockConfirmPrice,
          price,
          price / this.lastBlockConfirmPrice,
        );
        await this.getBlockConfirmPrice(ev);
      } else if (this.market.poolId) {
        await this.getBlockConfirmPrice();
      }
    }
  };
  public getBlockConfirmPrice = async (event?: UniSwapV3EventSwap | UniSwapV2EventSync | BalancerV2EventSwap) => {
    if (this.market.ex == 'univ3') {
      let tick = 0;
      let liquidity = '';
      let sqrtPriceX96 = BigNumber.from(0);
      if (event) {
        let ev = event as UniSwapV3EventSwap;
        tick = ev.tick;
        liquidity = ev.liquidity.toString();
        sqrtPriceX96 = ev.sqrtPriceX96;
      } else {
        let slot0 = await this.instance.slot0();
        tick = slot0.tick;
        sqrtPriceX96 = slot0.sqrtPriceX96;
        liquidity = (await this.instance.liquidity()).toString();
      }
      this.lastBlockConfirmPriceX96 = sqrtPriceX96.pow(2).div(MAX_UINT96);
      let price = parseFloat(this.lastBlockConfirmPriceX96.toString()) / 2 ** 96;
      this.lastBlockConfirmPrice = price / 10 ** (this.market.token1.decimals - this.market.token0.decimals);
      //计算滑点,直接模拟下单方式计算,避免断崖问题
      let slippageok = false;
      if (this.startTokenPath) {
        try {
          let pathPrice = 1;
          if (this.market.token0.address == this.startTokenPath.startToken.address) {
            pathPrice = 1;
          } else if (this.market.token1.address == this.startTokenPath.startToken.address) {
            pathPrice = 1 / this.lastBlockConfirmPrice;
          } else {
            // let pathPriceInfo = tokenPath.poolPriceInfoMap.get(
            //   tokenPath.startToken.address + this.market.token0.address,
            // );
            // if (pathPriceInfo) {
            //   pathPrice = pathPriceInfo.GetPriceAfterAllCost();
            // } else {
            pathPrice = this.startTokenPath.GetPathToTokenPriceBid(this.market.poolId, this.market.token0);
            // }
          }
          let amountIn0 = 0;
          let amountIn1 = 0;
          let amountOut0 = 0;
          let amountOut1 = 0;
          if (this.startTokenPath.spotCx) {
            amountIn0 = this.startTokenPath.spotCx.gridConfig.UnitNotional * pathPrice;
            let amountInBig0 = BigNumber.from(
              '0x' + Math.floor(amountIn0 * 10 ** this.market.token0.decimals).toString(16),
            );
            let amountOutBig0 = await this.startTokenPath.uniSwapQuoterV3.callStatic.quoteExactInputSingle(
              this.market.token0.address,
              this.market.token1.address,
              this.market.fee,
              amountInBig0,
              0,
            );
            amountOut0 = parseFloat(amountOutBig0.toString()) / 10 ** this.market.token1.decimals;
            this.market.slippage0 =
              (1e6 * (amountIn0 * this.lastBlockConfirmPrice * (1 - this.market.fee / 1e6) - amountOut0)) / amountOut0;
          }
          if (this.startTokenPath.spotCx) {
            amountIn1 = this.startTokenPath.spotCx.gridConfig.UnitNotional * pathPrice * this.lastBlockConfirmPrice;
            let amountInBig1 = BigNumber.from(
              '0x' + Math.floor(amountIn1 * 10 ** this.market.token1.decimals).toString(16),
            );
            let amountOutBig1 = await this.startTokenPath.uniSwapQuoterV3.callStatic.quoteExactInputSingle(
              this.market.token1.address,
              this.market.token0.address,
              this.market.fee,
              amountInBig1,
              0,
            );
            amountOut1 = parseFloat(amountOutBig1.toString()) / 10 ** this.market.token0.decimals;
            this.market.slippage1 =
              (1e6 * (amountIn1 * (1 / this.lastBlockConfirmPrice) * (1 - this.market.fee / 1e6) - amountOut1)) /
              amountOut1;
          }
          slippageok = true;
        } catch (e) {
          console.log('计算滑点点失败:', e);
          return;
        }
      }
      //计算滑点
      // if (!slippageok) {
      if (true) {
        let tickSpacing = TICK_SPACINGS[this.market.fee];
        let tickUpper = Math.ceil(tick / tickSpacing) * tickSpacing;
        // let tickLower = tickUpper - (slot.tick != tickUpper ? swap.tickSpacing : 0);//先不考虑重叠问题
        let tickLower = tickUpper - tickSpacing;

        let balance0 =
          parseFloat(
            SqrtPriceMath.getAmount0Delta(
              TickMath.getSqrtRatioAtTick(tickLower),
              TickMath.getSqrtRatioAtTick(tickUpper),
              JSBI.BigInt(liquidity),
              true,
            ).toString(),
          ) / this.market.token0.one;
        let balance1 =
          parseFloat(
            SqrtPriceMath.getAmount1Delta(
              TickMath.getSqrtRatioAtTick(tickLower),
              TickMath.getSqrtRatioAtTick(tickUpper),
              JSBI.BigInt(liquidity),
              true,
            ).toString(),
          ) / this.market.token1.one;
        for (let tokenPath of this.tokenPaths) {
          if (tokenPath.startToken.key == tokenPath.spotCx.market.token0.key) {
            let N = balance0 + balance1 / this.lastBlockConfirmPrice;
            let slippage = (1 / (2 * N)) * tickSpacing * 100;
            this.market.slippageOne0 = slippage;
            this.market.slippageOne1 = slippage;
          }
        }
      }
      console.log(
        'xxxxxxxx:slippage:univ3:',
        this.market.symbol,
        this.market.slippage0,
        this.market.slippage1,
        this.market.slippageOne0,
        this.market.slippageOne1,
      );
    } else if (this.market.ex == 'univ2') {
      let reserve: UniSwapV2EventSync;
      if (event) {
        reserve = event as UniSwapV2EventSync;
      } else {
        reserve = await this.instance.getReserves();
      }
      let priceBig = MAX_UINT96.mul(reserve._reserve1).div(reserve._reserve0);
      this.lastBlockConfirmPriceX96 = priceBig;
      let price = parseFloat(priceBig.toString()) / 2 ** 96;
      this.lastBlockConfirmPrice = price / 10 ** (this.market.token1.decimals - this.market.token0.decimals);
      //计算滑点
      {
        let balance0 = parseFloat(reserve._reserve0.toString()) / this.market.token0.one;
        let balance1 = parseFloat(reserve._reserve1.toString()) / this.market.token1.one;

        for (let tokenPath of this.tokenPaths) {
          if (tokenPath.startToken.key == tokenPath.spotCx.market.token0.key) {
            //跟那个启动这里是空,就先用默认的滑点率
            // if (tokenPath.poolPathBest) {
            let N = balance0 + balance1 / this.lastBlockConfirmPrice;
            // let pathPriceInfo = tokenPath.poolPriceInfoMap.get(tokenPath.startToken.address + this.market.token0.address);
            // if (!pathPriceInfo) {
            //   console.log('缺少:', tokenTo.address);
            //   continue;
            // }
            // let pathPrice = pathPriceInfo.GetPriceAfterAllCost();
            // let pathPrice = tokenPath.poolPathBest.tokenInfo.GetPathToTokenPriceBid(this.market.token0);
            let pathPrice = 1;
            if (this.market.token0.address == tokenPath.startToken.address) {
              pathPrice = 1;
            } else if (this.market.token1.address == tokenPath.startToken.address) {
              pathPrice = 1 / this.lastBlockConfirmPrice;
            } else {
              // let pathPriceInfo = tokenPath.poolPriceInfoMap.get(
              //   tokenPath.startToken.address + this.market.token0.address,
              // );
              // if (pathPriceInfo) {
              //   pathPrice = pathPriceInfo.GetPriceAfterAllCost();
              // } else {
              pathPrice = tokenPath.GetPathToTokenPriceBid(this.market.poolId, this.market.token0);
              // }
            }
            // let M = tokenPath.spotCx.gridConfig.UnitNotional * pathPrice;
            // let M = pathPrice;
            // this.market.slippage0 = (M / balance0) * 1e6;
            // let M1 = M * this.lastBlockConfirmPrice;
            // this.market.slippage1 = (M1 / balance1) * 1e6;
            this.market.slippageOne0 = (1 / balance0) * 1e6;
            this.market.slippageOne1 = (1 / balance1) * 1e6;
            let tmpslippage0 = (1 / balance0) * 1e6;
            let tmpslippage1 = (1 / balance1) * 1e6;
            let amountIn0 = 0;
            let amountIn1 = 0;
            let amountOut0 = 0;
            let amountOut1 = 0;
            if (this.startTokenPath.spotCx) {
              amountIn0 = this.startTokenPath.spotCx.gridConfig.UnitNotional * pathPrice;
              amountOut0 = getV2AmountOut(amountIn0, balance0, balance1, 0); //this.market.fee / 1e6
              this.market.slippage0 = (1e6 * (amountIn0 * this.lastBlockConfirmPrice - amountOut0)) / amountOut0;
            }
            if (this.startTokenPath.spotCx) {
              amountIn1 = this.startTokenPath.spotCx.gridConfig.UnitNotional * pathPrice * this.lastBlockConfirmPrice;
              amountOut1 = getV2AmountOut(amountIn1, balance1, balance0, 0); //this.market.fee / 1e6
              this.market.slippage1 = (1e6 * (amountIn1 / this.lastBlockConfirmPrice - amountOut1)) / amountOut1;
            }
            console.log(
              'univ2设置滑点量slippage:',
              this.market.symbol,
              this.market.address,
              balance0,
              balance1,
              N,
              // M,
              this.lastBlockConfirmPrice,
              pathPrice,
              this.lastBlockConfirmPriceX96.toString(),
              this.market.fee,
              tmpslippage0,
              tmpslippage1,
              this.market.slippage0,
              this.market.slippage1,
            );
          }
        }
      }
    } else if (this.market.ex == 'balancerv2') {
      let vault = balancerVault;
      let pool = this.instance;
      let poolId = this.market.poolId;
      let tokenInfo0 = await vault.getPoolTokenInfo(poolId, this.market.token0.address);
      let tokenInfo1 = await vault.getPoolTokenInfo(poolId, this.market.token1.address);
      let price = 0;
      if (this.market.dxType == 61) {
        let amplificationParameter = await pool.getAmplificationParameter();
        console.log(
          'xxxxx:amplificationParameter:',
          this.market.address,
          await pool.getSwapFeePercentage(),
          amplificationParameter,
        );
        let priceBig = calculateSpotPrice(amplificationParameter.value, [
          tokenInfo0.cash / 10 ** this.market.token0.decimals,
          tokenInfo1.cash / 10 ** this.market.token1.decimals,
        ]);
        price = parseFloat(priceBig.toString()) / 1e18;
        priceBig = priceBig
          .mul(BigNumber.from('0x' + Math.floor(10 ** this.market.token1.decimals).toString(16)))
          .div(BigNumber.from('0x' + Math.floor(10 ** this.market.token0.decimals).toString(16)));
        this.lastBlockConfirmPriceX18 = priceBig;
        this.lastBlockConfirmPriceX96 = MAX_UINT96.mul(priceBig).div(MAX_UINT18_ZERO);
      } else {
        let poolPairData: PoolPairData = {
          id: pool.address,
          tokenIn: this.market.token1.address,
          tokenOut: this.market.token0.address,
          balanceIn: bnum(tokenInfo1.cash.toString()),
          balanceOut: bnum(tokenInfo0.cash.toString()),
          weightIn: scale(bnum(this.market.weight1.toString()).div(bnum(this.market.weight.toString())), 18),
          weightOut: scale(bnum(this.market.weight0.toString()).div(bnum(this.market.weight.toString())), 18),
          swapFee: bnum((0).toString()), //这里不给fee,相当于手续费之前的报价,统一起来
        };
        // console.log('xxxxx:poolPairData:', this.market.address, await pool.getSwapFeePercentage(), poolPairData);
        // path.price = BigNumber.from('0x' + getSpotPrice(poolPairData).toString(16));
        // try {
        //   path.price = await pool.getSpotPriceSansFee(path.tokenTo, path.tokenFrom); //得用去除手续费价格
        // } catch {
        let priceBig = BigNumber.from('0x' + getSpotPrice(poolPairData).toString(16));
        price = parseFloat(priceBig.toString()) / 1e18;
        // priceBig = priceBig
        //   .mul(BigNumber.from('0x' + Math.floor(10 ** this.market.token1.decimals).toString(16)))
        //   .div(BigNumber.from('0x' + Math.floor(10 ** this.market.token0.decimals).toString(16)));
        this.lastBlockConfirmPriceX18 = priceBig;
        this.lastBlockConfirmPriceX96 = MAX_UINT96.mul(priceBig).div(MAX_UINT18_ZERO);
      }
      this.lastBlockConfirmPrice = price / 10 ** (this.market.token1.decimals - this.market.token0.decimals);
      let balance0 = parseFloat(tokenInfo0.cash.toString()) / this.market.token0.one;
      let balance1 = parseFloat(tokenInfo1.cash.toString()) / this.market.token1.one;
      let slippageok = false;
      if (this.startTokenPath && this.market.dxType == 60) {
        let pathPrice = 1;
        if (this.market.token0.address == this.startTokenPath.startToken.address) {
          pathPrice = 1;
        } else if (this.market.token1.address == this.startTokenPath.startToken.address) {
          pathPrice = 1 / this.lastBlockConfirmPrice;
        } else {
          pathPrice = this.startTokenPath.GetPathToTokenPriceBid(this.market.poolId, this.market.token0);
        }
        let amountIn0 = 0;
        let amountIn1 = 0;
        let amountOut0 = 0;
        let amountOut1 = 0;
        if (this.startTokenPath.spotCx) {
          amountIn0 = this.startTokenPath.spotCx.gridConfig.UnitNotional * pathPrice;
          let amountInBig0 = BigNumber.from(
            '0x' + Math.floor(amountIn0 * 10 ** this.market.token0.decimals).toString(16),
          );
          let amountOutBig0 = BalancercalcOutGivenIn(
            tokenInfo0.cash,
            this.market.weight0,
            tokenInfo1.cash,
            this.market.weight1,
            amountInBig0,
            BigNumber.from(0),
          ); //得用去除手续费价格
          amountOut0 = parseFloat(amountOutBig0.toString()) / 10 ** this.market.token1.decimals;
          this.market.slippage0 = (1e6 * (amountIn0 * this.lastBlockConfirmPrice - amountOut0)) / amountOut0;
          // (1e6 * (amountIn0 * this.lastBlockConfirmPrice * (1 - this.market.fee / 1e6) - amountOut0)) / amountOut0;
        }
        if (this.startTokenPath.spotCx) {
          amountIn1 = this.startTokenPath.spotCx.gridConfig.UnitNotional * pathPrice * this.lastBlockConfirmPrice;
          let amountInBig1 = BigNumber.from(
            '0x' + Math.floor(amountIn1 * 10 ** this.market.token1.decimals).toString(16),
          );
          let amountOutBig1 = BalancercalcOutGivenIn(
            tokenInfo1.cash,
            this.market.weight1,
            tokenInfo0.cash,
            this.market.weight0,
            amountInBig1,
            BigNumber.from(0),
          ); //得用去除手续费价格
          amountOut1 = parseFloat(amountOutBig1.toString()) / 10 ** this.market.token0.decimals;
          this.market.slippage1 = (1e6 * (amountIn1 * (1 / this.lastBlockConfirmPrice) - amountOut1)) / amountOut1;
          // (1e6 * (amountIn1 * (1 / this.lastBlockConfirmPrice) * (1 - this.market.fee / 1e6) - amountOut1)) /
          // amountOut1;
        }
        console.log(
          'balancerv2设置滑点量slippage:0:',
          this.market.symbol,
          this.market.address,
          balance0,
          balance1,
          this.lastBlockConfirmPrice,
          pathPrice,
          this.market.fee,
          this.market.slippage0,
          this.market.slippage1,
        );
        slippageok = true;
      } else if (!slippageok) {
        //计算滑点
        for (let tokenPath of this.tokenPaths) {
          if (tokenPath.startToken.key == tokenPath.spotCx.market.token0.key) {
            let N = balance0 + balance1 / this.lastBlockConfirmPrice;
            let pathPrice = 1;
            if (this.market.token0.address == tokenPath.startToken.address) {
              pathPrice = 1;
            } else if (this.market.token1.address == tokenPath.startToken.address) {
              pathPrice = 1 / this.lastBlockConfirmPrice;
            } else {
              pathPrice = tokenPath.GetPathToTokenPriceBid(this.market.poolId, this.market.token0);
            }
            // let M = tokenPath.spotCx.gridConfig.UnitNotional * pathPrice;
            // let M = pathPrice;
            // let slippage = (M / (2 * N)) * tickSpacing * 100;
            // //把滑点量转换为滑点率,上面要用滑点量是因为要扩大下单量
            // tokenPath.spotEx.market.slippage = slippage / M;
            // this.market.slippage0 = (M / balance0) * 1e6;
            // let M1 = M * this.lastBlockConfirmPrice;
            // this.market.slippage1 = (M1 / balance1) * 1e6;
            this.market.slippage0 = (1 / balance0) * 1e6;
            this.market.slippage1 = (1 / balance1) * 1e6;
            console.log(
              'balancerv2设置滑点量slippage:1:',
              this.market.symbol,
              this.market.address,
              balance0,
              balance1,
              N,
              // M,
              // M1,
              this.lastBlockConfirmPrice,
              pathPrice,
              this.market.fee,
              this.market.slippage0,
              this.market.slippage1,
            );
          }
        }
      }
    }
    //confirm时把pengding的价格也重置下
    this.lastSwapPendingLog.price = this.lastBlockConfirmPrice;
    console.log('confirm price:', lastBlockNumber, this.id, this.lastBlockConfirmPrice);
    this.UpdateMarket(this.lastBlockConfirmPrice, this.lastBlockConfirmPrice);
    this.UpdateMarketConfirm(this.lastBlockConfirmPrice, this.lastBlockConfirmPrice);
    return this.lastBlockConfirmPrice;
  };
}
let logger: Logger;

// export let V3PoolAddressMap = new Map<string, string>(); //id=>address
export let SpotDxMap = new Map<string, SpotDx>(); //id=>address
let awaitPoolMap = new Map<string, any>();
let lastOfficalBlockNumber: number;
let lastRoyBlockNumber: number;
let lastRoyBlockTime: number;
let lastCommitBlockNumber: number;
let latestBaseFeePerGas: BigNumber;
export let lastBlockNumber: number;
export let lastCommitOkTime: number = 0;
export let lastConfirmBlockNumber: number;
export let lastBlockTime: number = 0;
export let lastConfirmMsec = 0; //最后一次区块确认时间
export let lastCommitOkTimeBid: number = 0; //分别记录下做趋势判断
export let lastCommitOkTimeAsk: number = 0; //分别记录下做趋势判断
export let lastTime: number = 0;
export let lastConfirmOkPrice: number = 0;
export let lastConfirmOkPriceBid: number = 0;
export let lastConfirmOkPriceAsk: number = 0;
// export let InitSpotDx = async (_logger: Logger, markets: typeof ExchangeMarkets) => {
export function SetLastConfirmOkPriceBid(set: number) {
  lastConfirmOkPriceBid = set;
}
export function SetLastConfirmOkPriceAsk(set: number) {
  lastConfirmOkPriceAsk = set;
}
export function SetLastCommitOkTimeBid(now: number) {
  lastCommitOkTimeBid = now;
}
export function SetLastCommitOkTimeAsk(now: number) {
  lastCommitOkTimeAsk = now;
}
// export let InitSpotDx = async (_logger: Logger, markets: typeof ExchangeMarkets) => {
export let InitSpotDx = async (_logger: Logger, tokenPaths: TokenPath[]) => {
  // for (let market of markets) {
  //   V3PoolAddressMap.set(market.symbol, market.address);
  // }
  logger = _logger;
  console.log('network:', network.name, (await myprovider.getNetwork()).chainId);
  for (const slaver_ws of slaver_providers) {
    //多网络观察下是否会加快索引速度
    pending_ws = slaver_ws;
    console.log('pending_ws:', pending_ws.connection.url);
    break;
  }
  let commiter = new ethers.Wallet(await getOwnerPrivateKey(network.name), pending_ws);

  ownerBalance = await commiter.getBalance();
  console.log('deploy account:', commiter.address, ethers.utils.formatEther(ownerBalance.toString()));
  // instanceV3Factory = (await ethers.getContractFactory('UniswapV3Pool')).connect(signer);
  // instanceErc20Factory = (await ethers.getContractFactory('ERC20')).connect(signer);
  instanceV3Contract = new ethers.Contract(commiter.address, TrendingABI).connect(pending_ws);
  instanceErc20Contract = new ethers.Contract(commiter.address, ERC20ABI).connect(pending_ws);
  let balancerVaultAbi = new ethers.Contract(CONTRACT_BALANCER_VAULT_ADDRESS, BalancerVaultABI);
  balancerVault = balancerVaultAbi.connect(myprovider);
  lastBlockNumber = await myprovider.getBlockNumber();
  try {
    let ret = await CancelPendingTransactoinAll(commiter);
    if (ret) {
      console.log('cancel all pending transaction ok:', commiter.address);
    } else {
      console.log('cancel all pending transaction err, exit:', commiter.address);
      return;
    }
  } catch (e) {
    console.log('CancelPendingTransactoinAll err:', e);
  }
  let PlaceOrderContractFactory = await ethers.getContractFactory('PlaceOrder');
  instancePlaceOrder = PlaceOrderContractFactory.connect(commiter).attach(PLACEORDER_CONTRACT_ADDRESS) as PlaceOrder;
  await InitPlaceOrderPoolList(instancePlaceOrder);
  //先初始化一次
  feeData = await pending_ws.getFeeData();
  //roy
  {
    // roy_ws = new RoyClient('ws://172.31.5.253:51314', 'test');
    // roy_ws.reconnect();

    type RoySyncEvent = {
      address: string;
      data: string;
      topics: string[];
    };
    roy_ws_block = new RoyClient('ws://172.31.81.143:51314', 'test1');
    // let ws = new RoyClient('ws://3.115.190.43:51314', 'test');
    roy_ws_block.reconnect();
    let pingInterval: any;
    if (pingInterval) {
      clearInterval(pingInterval);
    }
    pingInterval = setInterval(() => {
      roy_ws_block._wss.ping(JSON.stringify({ m: 'ping' }));
    }, 5000);
    roy_ws_block.onConnected = () => {
      console.log('roy_ws_block,连接成功:');
      roy_ws_block._wss.send(
        JSON.stringify({
          m: 'subscribe',
          filter: {
            address: [],
            topics: [
              [
                TOPIC_UNISWAP_SYNC_V2, //'0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1',
                TOPIC_UNISWAP_SWAP_V3, //'0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
              ],
            ],
          },
        }),
      );
      roy_ws_block._wss.on('message', async (raw: string) => {
        roy_ws_block._wss.ActivePong();
        let parseTime = Date.now();
        const msg = JSON.parse(raw);
        if (msg.events) {
          let events = msg.events as RoySyncEvent[];
          lastRoyBlockTime = Date.now();
          lastRoyBlockNumber = msg.blockNumber;
          let diff = 0;
          if (lastConfirmBlockNumber == lastRoyBlockNumber) {
            diff = lastConfirmMsec - lastRoyBlockTime;
          }
          console.log(
            'new block:roy:',
            lastConfirmBlockNumber,
            lastRoyBlockNumber,
            diff,
            moment(lastConfirmMsec).format('YYYY-MM-DD HH:mm:ss.SSS'),
            moment(lastRoyBlockTime).format('YYYY-MM-DD HH:mm:ss.SSS'),
            lastRoyBlockTime - parseTime,
            msg.events.length,
          );
          {
            if (!lastConfirmBlockNumber || lastConfirmBlockNumber >= lastRoyBlockNumber) {
              //必须要收到一个区块后才能用,如果已经收到了confirm就不能再处理了
              return;
            }
            //  {
            //    Reserve0: 2364851603452,
            //    Reserve1: 1.8368864919177153e+24,
            //    Address: '0x7C303894A165830751F524eBdb6B198afFbb7211',
            //    TxIndex: 28
            //  }

            //这个时间不能放在blocs事件里,会有误导,得放confirm里
            // lastConfirmMsec = Date.now();
            // let awaitPoolMap = new Map<string, any>();
            // } else if (topic0 == TOPIC_UNISWAP_SWAP_V3) {
            let pendingEventPoolMap = new Map<string, UniSwapV3EventSwap | UniSwapV2EventSync | BalancerV2EventSwap>();
            for (let result of events) {
              if (commitWaitingMap.size > 0) {
                return;
              }
              let topic0 = result.topics[0];
              if (topic0 == TOPIC_UNISWAP_SYNC_V2) {
                let market = exchangeMarketAddressMap.get(result.address);
                if (market) {
                  let index = 2;
                  let _reserve0 = BigNumber.from('0x' + result.data.substr(index, 64));
                  index = index + 64;
                  let _reserve1 = BigNumber.from('0x' + result.data.substr(index, 64));
                  let ev: UniSwapV2EventSync = {
                    _reserve0: _reserve0,
                    _reserve1: _reserve1,
                  };
                  pendingEventPoolMap.set(result.address, ev);
                }
              } else if (topic0 == TOPIC_UNISWAP_SWAP_V3) {
                let market = exchangeMarketAddressMap.get(result.address);
                if (market) {
                  let log = instanceV3Pool.interface.decodeEventLog(
                    result.topics[0],
                    result.data,
                    result.topics,
                  ) as any as UniSwapV3EventSwap;
                  let ev: UniSwapV3EventSwap = {
                    sender: log.sender,
                    recipient: log.recipient,
                    amount0: log.amount0,
                    amount1: log.amount1,
                    sqrtPriceX96: log.sqrtPriceX96,
                    liquidity: log.liquidity,
                    tick: log.tick,
                    // blockNumber: result.blockNumber,
                    // transactionHash: result.transactionHash,
                  };
                  pendingEventPoolMap.set(result.address, ev);
                  // let price = parseFloat(ev.sqrtPriceX96.pow(2).div(MAX_UINT96).toString()) / 2 ** 96;
                  // let lastBlockConfirmPrice = price / 10 ** (market.token1.decimals - market.token0.decimals);
                  // console.log('pending price:0:', market.symbol, lastBlockConfirmPrice, ev);
                }
                //event Swap(address indexed sender,address indexed recipient,int256 amount0,int256 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick)
              } else if (topic0 == TOPIC_BALANCER_VALT_SWAP) {
                let market = exchangeMarketAddressMap.get(result.topics[1]);
                if (market) {
                  let ev: BalancerV2EventSwap = {
                    poolId: result.topics[1],
                    address: result.topics[2].substring(0, 42),
                    // tokenIn: result.topics[3].substring(0, 42),
                    // tokenOut: result.topics[4].substring(0, 42),
                    // amountIn: BigNumber.from(result.topics[5]),
                    // amountOut: BigNumber.from(result.topics[5]),
                  };
                  pendingEventPoolMap.set(ev.poolId, ev);
                  pendingEventPoolMap.set(ev.poolId.substring(0, 42), ev);
                  console.log(
                    'confirm.balancer.TOPIC_BALANCER_VALT_SWAP',
                    result.address,
                    result.topics[1].substring(0, 42),
                    result,
                  );
                }
              }
              confirmPoolMap.set(result.address, result);
            }
            let pools = [];
            confirmPoolMap.forEach((pool, addr) => {
              pools.push(addr);
            });
            console.log('roy pools:', parseInt(lastConfirmBlockNumber.toString()), pools.length, events.length);
            for (let spotDx of SpotDxMap.values()) {
              let key = spotDx.market.address.toLowerCase();
              let event = pendingEventPoolMap.get(key);
              if (!event && spotDx.market.poolId) {
                key = spotDx.market.poolId.toString().toLowerCase();
                event = pendingEventPoolMap.get(key);
              }
              if (event) {
                await spotDx.UpdateMinedPrice(event);
              }
            }
            for (let tokenPath of tokenPaths) {
              tokenPath.chanceType = 4;
              let ret = await tokenPath.UpdatePoolMap(pools, awaitPoolMap);
            }
          }
        } else if (msg.type == 'txReceipt') {
          console.log('roy txReceipt:', raw);
          if (msg.msg) {
            let waitingData = commitWaitingMap.get(commiter.address);
            if (waitingData) {
              waitingData.replaceHashs.push(msg.msg);
            }
          }
        } else {
          console.log('roy msg:', raw);
        }
      });
    };
  }
  for (let tokenPath of tokenPaths) {
    await tokenPath.UpdateStartEndTokenBalance();
    if (tokenPath.spotCx.isStartToken(tokenPath.startToken.key) && tokenPath.spotCx.gridConfig.checkReset) {
      await tokenPath.spotCx.ResetActualPositionConfirm(tokenPath);
    }
  }
  pending_ws.on('block', async (blocknumber: any) => {
    if (Date.now() - loopStartTime > 60000) {
      sendBotMessage(`主循环超过1分钟未返还,请检查`);
    }
    feeData = await pending_ws.getFeeData();
    console.log('block feeData:', feeData.gasPrice.toString());
    // if (lastBlockNumber != blocknumber) {
    //区块不同步的时候会出现小的情况
    if (lastBlockNumber >= blocknumber) {
      return;
    }
    if (Math.abs(blocknumber - lastConfirmBlockNumber) >= 100) {
      sendBotMessage(`请检查节点,长时间未收到区块报价:${lastConfirmBlockNumber}/${blocknumber}`);
    }
    lastBlockNumber = blocknumber;
    lastCommitBlockNumber = lastBlockNumber; //暂时关闭
    official_provider.getBlock('latest').then((block: providers.Block) => {
      lastOfficalBlockNumber = block.number;
      if (lastBlockNumber < block.number) {
        lastBlockNumber = block.number;
        lastCommitBlockNumber = lastBlockNumber; //暂时关闭
      }
    });
    // lastCommitBlockNumber = (await commitprovider.getBlock('latest')).number;
    lastBlockTime = Date.now();
    let diff = 0;
    if (lastBlockNumber == lastRoyBlockNumber) {
      diff = lastBlockTime - lastRoyBlockTime;
    }
    console.log(
      'new block:0:',
      lastBlockNumber,
      lastRoyBlockNumber,
      diff,
      lastBlockTime,
      lastRoyBlockTime,
      commitWaitingMap.size,
      parseFloat(latestBaseFeePerGas?.toString()) / 1e9,
      parseFloat(feeData.gasPrice.toString()) / 1e9,
    );
    for (let tokenPath of tokenPaths) {
      await tokenPath.UpdateStartEndTokenBalance();
    }
    for (let [k, waitingData] of commitWaitingMap) {
      //要确保大于20秒再回退,防止叔块问题
      if (
        !waitingData.canceling &&
        blocknumber - waitingData.blockNumber > 10 &&
        Date.now() - waitingData.createAt > 20000
      ) {
        waitingData.canceling = true;
        try {
          let tx = await commiter.provider.getTransaction(waitingData.hash);
          let gasPrice = BigNumber.from(0);
          if (tx) {
            gasPrice = tx.gasPrice;
          }
          // let ret = await CancelPendingTransactoin(commiter, tx.nonce, waitingData.hash);
          console.log('准备取消超时订单:', blocknumber, waitingData.blockNumber, waitingData.hash);
          let ret = await CancelPendingTransactoin(commiter, tx?.nonce, tx?.hash, feeDatamaxFeePerGasMax);
          sendBotMessage(
            `超时撤销订单:\n当前gasPrice:${parseFloat(feeData.gasPrice.toString()) / 1e9}\n下单gasPrice:${
              parseFloat(gasPrice.toString()) / 1e9
            },${tx?.gasPrice.toString()},${tx?.hash}`,
          );
          console.log(
            'ret4,超时了,发送撤销订单消息:',
            waitingData.blockNumber,
            blocknumber,
            waitingData.hash,
            ret.hash,
          );
          waitingData.hash = ret.hash;
          waitingData.blockNumber = blocknumber;
        } catch (e) {
          console.log('取消超时订单失败:', blocknumber, waitingData.blockNumber, waitingData.hash, e);
          sendBotMessage(`取消超时订单失败:${blocknumber}, ${waitingData.blockNumber}, ${waitingData.hash}`);
        }
      }
    }
    if (waitForTransaction) {
      waitForTransaction();
    }
    // awaitPoolMap.clear();
    // for (let spotDx of SpotDxMap.values()) {
    //   await spotDx.getBlockConfirmPrice();
    // }
    // for (let tokenPath of tokenPaths) {
    //   let ret = await tokenPath.UpdatePoolMap([], awaitPoolMap);
    //   tokenPath.onlineChance = true;
    // }
    // for (let tokenPath of tokenPaths) {
    //   tokenPath.checkNFT = true;
    // }
    // logger.debug('block:', blocknumber, SpotDxMap.size);
  });
  let filterConfirmLogs = {
    fromBlock: 0,
    toBlock: 0,
    address: null,
    topics: [
      [
        TOPIC_UNISWAP_SYNC_V2,
        TOPIC_UNISWAP_MINT_V2,
        TOPIC_UNISWAP_SWAP_V3,
        TOPIC_UNISWAP_BURN_V3,
        TOPIC_UNISWAP_MINT_V3,
        TOPIC_BALANCER_VALT_SWAP,
        TOPIC_BALANCER_VALT_SWAP_V1,
        TOPIC_BALANCER_VALT_BALANCE,
      ],
    ],
  };
  let filterMinedLogs = {
    address: '0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16', //PANCAKE-WBNB-BUSD-2500
    topics: [
      [
        TOPIC_UNISWAP_SYNC_V2,
        TOPIC_UNISWAP_MINT_V2,
        TOPIC_UNISWAP_SWAP_V3,
        TOPIC_UNISWAP_BURN_V3,
        TOPIC_UNISWAP_MINT_V3,
        TOPIC_BALANCER_VALT_SWAP,
        TOPIC_BALANCER_VALT_SWAP_V1,
        TOPIC_BALANCER_VALT_BALANCE,
      ],
    ],
  };

  console.log('xxxxx:commitprovider_ws:', commitprovider_ws.connection.url);
  // commitprovider_ws._subscribe('block', ['newHeads'], (result: any) => {
  //   console.log('xxxxx:result:', result);
  // });
  let confirmPoolMap = new Map<string, any>();
  commitprovider_ws._subscribe(
    'filterConfirmLogs',
    ['logs', commitprovider_ws._getFilter(filterConfirmLogs)],
    async (results: providers.Log[]) => {
      //这个时间不能放在blocs事件里,会有误导,得放confirm里
      lastConfirmMsec = Date.now();
      let awaitPoolMap = new Map<string, any>();
      let pendingEventPoolMap = new Map<string, UniSwapV3EventSwap | UniSwapV2EventSync | BalancerV2EventSwap>();
      for (let result of results) {
        //不同步不行,会导致状态不一致
        // if (lastBlockNumber - result.blockNumber > 10) {
        //   console.log('confirm区块同步误差太大,暂停:', lastOfficalBlockNumber, lastBlockNumber, result.blockNumber);
        //   return;
        // }
        lastConfirmBlockNumber = parseInt(result.blockNumber.toString());
        //还没有理解removed状态应该如何处理
        if (!result.removed) {
          result.removed = false;
        }
        if (result.removed) {
          // console.log('confirm removed:', result);
        } else {
          let topic0 = result.topics[0];
          if (topic0 == TOPIC_UNISWAP_SYNC_V2) {
            let market = exchangeMarketAddressMap.get(result.address);
            if (market) {
              let index = 2;
              let _reserve0 = BigNumber.from('0x' + result.data.substr(index, 64));
              index = index + 64;
              let _reserve1 = BigNumber.from('0x' + result.data.substr(index, 64));
              // //这个数据是确定数据,可以缓存
              // let key = ethers.utils.getAddress(result.address) + 'tmpreserve';
              // let tmpreserve = awaitPoolMap.get(key);
              // if (!tmpreserve) {
              //   tmpreserve = { _reserve0, _reserve1 };
              //   awaitPoolMap.set(key, tmpreserve);
              // }
              let ev: UniSwapV2EventSync = {
                _reserve0: _reserve0,
                _reserve1: _reserve1,
              };
              pendingEventPoolMap.set(result.address, ev);
            }
          } else if (topic0 == TOPIC_UNISWAP_SWAP_V3) {
            let market = exchangeMarketAddressMap.get(result.address);
            if (market) {
              let log = instanceV3Pool.interface.decodeEventLog(
                result.topics[0],
                result.data,
                result.topics,
              ) as any as UniSwapV3EventSwap;
              let ev: UniSwapV3EventSwap = {
                sender: log.sender,
                recipient: log.recipient,
                amount0: log.amount0,
                amount1: log.amount1,
                sqrtPriceX96: log.sqrtPriceX96,
                liquidity: log.liquidity,
                tick: log.tick,
                // blockNumber: result.blockNumber,
                // transactionHash: result.transactionHash,
              };
              pendingEventPoolMap.set(result.address, ev);
              // let price = parseFloat(ev.sqrtPriceX96.pow(2).div(MAX_UINT96).toString()) / 2 ** 96;
              // let lastBlockConfirmPrice = price / 10 ** (market.token1.decimals - market.token0.decimals);
              // console.log('pending price:0:', market.symbol, lastBlockConfirmPrice, ev);
            }
            //event Swap(address indexed sender,address indexed recipient,int256 amount0,int256 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick)
          } else if (topic0 == TOPIC_BALANCER_VALT_SWAP) {
            let market = exchangeMarketAddressMap.get(result.topics[1]);
            if (market) {
              let ev: BalancerV2EventSwap = {
                poolId: result.topics[1],
                address: result.topics[2].substring(0, 42),
                // tokenIn: result.topics[3].substring(0, 42),
                // tokenOut: result.topics[4].substring(0, 42),
                // amountIn: BigNumber.from(result.topics[5]),
                // amountOut: BigNumber.from(result.topics[5]),
              };
              pendingEventPoolMap.set(ev.poolId, ev);
              pendingEventPoolMap.set(ev.poolId.substring(0, 42), ev);
              console.log(
                'confirm.balancer.TOPIC_BALANCER_VALT_SWAP',
                result.address,
                result.topics[1].substring(0, 42),
                result,
              );
            }
          }
        }

        confirmPoolMap.set(result.address, result);
      }
      let pools = [];
      confirmPoolMap.forEach((pool, addr) => {
        pools.push(addr);
      });
      let diff = 0;
      if (lastConfirmBlockNumber == lastRoyBlockNumber) {
        diff = lastConfirmMsec - lastRoyBlockTime;
      }
      console.log(
        'new block:log:',
        lastConfirmBlockNumber,
        lastRoyBlockNumber,
        diff,
        moment(lastConfirmMsec).format('YYYY-MM-DD HH:mm:ss.SSS'),
        moment(lastRoyBlockTime).format('YYYY-MM-DD HH:mm:ss.SSS'),
        commitWaitingMap.size,
        parseFloat(latestBaseFeePerGas?.toString()) / 1e9,
        parseFloat(feeData.gasPrice.toString()) / 1e9,
      );
      console.log('confirm pools:', parseInt(lastConfirmBlockNumber.toString()), pools.length, results.length);
      for (let spotDx of SpotDxMap.values()) {
        //这里需要变小写
        let key = spotDx.market.address.toLowerCase();
        let event = pendingEventPoolMap.get(key);
        if (!event && spotDx.market.poolId) {
          key = spotDx.market.poolId.toString().toLowerCase();
          event = pendingEventPoolMap.get(key);
        }
        let price = 0;
        if (event) {
          if (spotDx.market.ex == 'univ3') {
            let ev = event as UniSwapV3EventSwap;
            price = parseFloat(ev.sqrtPriceX96.pow(2).div(MAX_UINT96).toString()) / 2 ** 96;
            price = price / 10 ** (spotDx.market.token1.decimals - spotDx.market.token0.decimals);
            await spotDx.getBlockConfirmPrice(ev);
          } else if (spotDx.market.ex == 'univ2') {
            let ev = event as UniSwapV2EventSync;
            await spotDx.getBlockConfirmPrice(ev);
          } else if (spotDx.market.poolId) {
            await spotDx.getBlockConfirmPrice();
          } else if (confirmPoolMap.get(spotDx.market.address.toLowerCase())) {
            await spotDx.getBlockConfirmPrice();
          }
        }
      }
      confirmPoolMap.clear();
      for (let tokenPath of tokenPaths) {
        tokenPath.chanceType = 1;
        let ret = await tokenPath.UpdatePoolMap(pools, awaitPoolMap);
      }
    },
  );
  //只处理confirm状态的事件
  let instanceV3Pool = new ethers.Contract(commiter.address, UniswapV3PoolABI);
  if (false) {
    commitprovider_ws._subscribe(
      'filterMinedLogs',
      ['logs', commitprovider_ws._getFilter(filterMinedLogs)],
      async (results: providers.Log[]) => {
        if (!lastConfirmBlockNumber) {
          //必须要收到一个区块后才能用
          return;
        }
        //这个时间不能放在blocs事件里,会有误导,得放confirm里
        // lastConfirmMsec = Date.now();
        // let awaitPoolMap = new Map<string, any>();
        let pendingEventPoolMap = new Map<string, UniSwapV3EventSwap | UniSwapV2EventSync | BalancerV2EventSwap>();
        for (let result of results) {
          //不同步不行,会导致状态不一致
          // if (lastBlockNumber - result.blockNumber > 10) {
          //   console.log('confirm区块同步误差太大,暂停:', lastOfficalBlockNumber, lastBlockNumber, result.blockNumber);
          //   return;
          // }
          // lastConfirmBlockNumber = result.blockNumber;
          //如果正在交易,没有必要再更新,更新会影响撤单决策
          if (commitWaitingMap.size > 0) {
            return;
          }
          if (!result.removed) {
            //还没有理解removed状态应该如何处理
            result.removed = false;
          }
          if (result.removed) {
            // console.log('confirm removed:', result);
          } else {
            let topic0 = result.topics[0];
            if (topic0 == TOPIC_UNISWAP_SYNC_V2) {
              let market = exchangeMarketAddressMap.get(result.address);
              if (market) {
                let index = 2;
                let _reserve0 = BigNumber.from('0x' + result.data.substr(index, 64));
                index = index + 64;
                let _reserve1 = BigNumber.from('0x' + result.data.substr(index, 64));
                //这个数据是临时数据不能缓存
                // let key = ethers.utils.getAddress(result.address) + 'tmpreserve';
                // let tmpreserve = awaitPoolMap.get(key);
                // if (!tmpreserve) {
                //   tmpreserve = { _reserve0, _reserve1 };
                //   awaitPoolMap.set(key, tmpreserve);
                // }
                let ev: UniSwapV2EventSync = {
                  _reserve0: _reserve0,
                  _reserve1: _reserve1,
                };
                pendingEventPoolMap.set(result.address, ev);
              }
            } else if (topic0 == TOPIC_UNISWAP_SWAP_V3) {
              let market = exchangeMarketAddressMap.get(result.address);
              if (market) {
                let log = instanceV3Pool.interface.decodeEventLog(
                  result.topics[0],
                  result.data,
                  result.topics,
                ) as any as UniSwapV3EventSwap;
                let ev: UniSwapV3EventSwap = {
                  sender: log.sender,
                  recipient: log.recipient,
                  amount0: log.amount0,
                  amount1: log.amount1,
                  sqrtPriceX96: log.sqrtPriceX96,
                  liquidity: log.liquidity,
                  tick: log.tick,
                  // blockNumber: result.blockNumber,
                  // transactionHash: result.transactionHash,
                };
                pendingEventPoolMap.set(result.address, ev);
                // let price = parseFloat(ev.sqrtPriceX96.pow(2).div(MAX_UINT96).toString()) / 2 ** 96;
                // let lastBlockConfirmPrice = price / 10 ** (market.token1.decimals - market.token0.decimals);
                // console.log('pending price:0:', market.symbol, lastBlockConfirmPrice, ev);
              }
              //event Swap(address indexed sender,address indexed recipient,int256 amount0,int256 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick)
            } else if (topic0 == TOPIC_BALANCER_VALT_SWAP) {
              let market = exchangeMarketAddressMap.get(result.topics[1]);
              if (market) {
                let ev: BalancerV2EventSwap = {
                  poolId: result.topics[1],
                  address: result.topics[2].substring(0, 42),
                  // tokenIn: result.topics[3].substring(0, 42),
                  // tokenOut: result.topics[4].substring(0, 42),
                  // amountIn: BigNumber.from(result.topics[5]),
                  // amountOut: BigNumber.from(result.topics[5]),
                };
                pendingEventPoolMap.set(ev.poolId, ev);
                pendingEventPoolMap.set(ev.poolId.substring(0, 42), ev);
                // pendingEventPoolMap.set(ev.poolId.substring(0, 42), ev);
                // poolMap.set(ev.poolId.substring(0, 42), result);
                console.log(
                  'mined.balancer.TOPIC_BALANCER_VALT_SWAP',
                  result.topics[1].substring(0, 42),
                  result.address,
                  result,
                );
              }
            }
          }

          confirmPoolMap.set(result.address, result);
        }
        let pools = [];
        confirmPoolMap.forEach((pool, addr) => {
          pools.push(addr);
        });
        console.log('mined pools:', parseInt(lastConfirmBlockNumber.toString()), pools.length, results.length);
        for (let spotDx of SpotDxMap.values()) {
          let key = spotDx.market.address.toLowerCase();
          let event = pendingEventPoolMap.get(key);
          if (!event && spotDx.market.poolId) {
            key = spotDx.market.poolId.toString().toLowerCase();
            event = pendingEventPoolMap.get(key);
          }
          if (event) {
            await spotDx.UpdateMinedPrice(event);
          }
        }
        for (let tokenPath of tokenPaths) {
          tokenPath.chanceType = 2;
          let ret = await tokenPath.UpdatePoolMap(pools, awaitPoolMap);
        }
      },
    );
  }
  if (pendingprovider) {
    // let addrs: PendingTransactionHash[] = [
    let addrs = [
      {
        from: ethers.utils.getAddress('0x1Cfa17887dA489B1FE76eB9c26bEf5B0D9Ced938'),
        to: ethers.utils.getAddress('0x6C88dE413f7C1b2489E79B12F47c8A2167b94dE7'),
        toAll: true,
      },
      {
        from: ethers.utils.getAddress('0x00000000b4A224ac748E8149e3B6B9eB3c6a1DDC'),
        to: ethers.utils.getAddress('0x0000000000fF729BF92823077a07Ba6193F33059'),
        toAll: true,
      },
      // /pending from=0x1Cfa17887dA489B1FE76eB9c26bEf5B0D9Ced938 to=0x26a3b6A17f37949AD1b6561c8959e4053b6D7e6f
      // /pending from=0x501A1714199ef77162a878E75937211008FB30e3 to=0x26a3b6A17f37949AD1b6561c8959e4053b6D7e6f
      // /pending from=0x33879472972D00FCFdC26F695EBC143Ce7839696 to=0x26a3b6A17f37949AD1b6561c8959e4053b6D7e6f
    ];
    for (let addr of addrs) {
      //这里得小写
      pendingAddressGasMap.set(addr.from.toLowerCase(), {
        hash: addr.from,
        from: addr.from,
        to: addr.to,
        input: '',
        gasPrice: '0',
        gasTipCap: '0',
        gasFeeCap: '0',
        gasPriceBig: BigNumber.from(0),
        gasTipCapBig: BigNumber.from(0),
        gasFeeCapBig: BigNumber.from(0),
        createAt: 0,
        blockNumber: lastBlockNumber,
      });
      if (addr.toAll) {
        pendingAddressGasMap.set(addr.to.toLowerCase(), {
          hash: addr.from,
          from: addr.from,
          to: addr.to,
          input: '',
          gasPrice: '0',
          gasTipCap: '0',
          gasFeeCap: '0',
          gasPriceBig: BigNumber.from(0),
          gasTipCapBig: BigNumber.from(0),
          gasFeeCapBig: BigNumber.from(0),
          createAt: 0,
          blockNumber: lastBlockNumber,
        });
      }
      let op = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; //山寨操作
      let sep = 'cccccccccccccccccccccccccccccccccccccc'; //山寨分隔符
      let fakeTo = '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa'; //山寨假合约

      let transaction = {
        to: fakeTo,
        data: `${op}`,
      };
      //from还不支持过滤,目前只能过滤合约
      // transaction.data = `${transaction.data}${sep}${ethers.utils.getAddress(addr.from).substring(2)}`;
      transaction.data = `${transaction.data}${sep}${ethers.utils.getAddress(addr.to).substring(2)}`;
      try {
        await pendingprovider.call(transaction);
      } catch (e) {
        if (e.response) {
          let data = JSON.parse(e.response);
          if (data.error.message != 'control params,山寨参数控制,无视报错') {
            console.log('pending err:', e);
          }
        } else {
          console.log('pending err1:', e);
        }
      }
    }
    console.log('pending数据监听:', pendingprovider.connection.url);

    let tokenPath = tokenPaths[0];
    //user->pool->token
    let lastPendingMsgBlockNumber = 0;
    pendingprovider.on('pending', async (txs: PendingTransactionHash[]) => {
      let pendingMsg = '';
      for (let tx of txs) {
        tx.gasPriceBig = BigNumber.from(tx.gasPrice);
        tx.gasFeeCapBig = BigNumber.from(tx.gasFeeCap);
        tx.gasTipCapBig = BigNumber.from(tx.gasTipCap);
        tx.blockNumber = lastBlockNumber;
        console.log('pending:', tx.from, tx.to, tx.hash, tx.input?.length, tx);
        if (tx.input?.length < 128) {
          console.log('pending,过滤假交易:', tx.from, tx.to, tx.hash, tx.input?.length, tx);
          continue;
        }
        //0x协议处理
        //下面一定要防止自己监听司机,死循环就悲剧了
        // if (tx.from != owner.address.toLowerCase() && tx.to == '0xdef1c0ded9bec7f1a1670819833240f027b25eff') {
        //   await Do0XPendingTransaction(tx);
        //   // }
        // }
        tx.createAt = Date.now();
        pendingTransactionHashMap.set(tx.hash, tx);
        let oldTx = pendingAddressGasMap.get(tx.from);
        let replace = false;
        if (
          oldTx && //oldTx.blockNumber < tx.blockNumber ||
          (tx.createAt - oldTx.createAt > 1501 ||
            (oldTx.gasPriceBig && tx.gasPriceBig && oldTx.gasPriceBig.lt(tx.gasPriceBig)) ||
            (oldTx.gasFeeCapBig && tx.gasFeeCapBig && oldTx.gasFeeCapBig.lt(tx.gasFeeCapBig)) ||
            (oldTx.gasTipCapBig && tx.gasTipCapBig && oldTx.gasTipCapBig.lt(tx.gasTipCapBig)))
        ) {
          pendingAddressGasMap.set(tx.from, tx);
          replace = true;
        }
        oldTx = pendingAddressGasMap.get(tx.to);
        if (
          oldTx && //oldTx.blockNumber < tx.blockNumber ||
          (tx.createAt - oldTx.createAt > 1501 ||
            (oldTx.gasPriceBig && tx.gasPriceBig && oldTx.gasPriceBig.lt(tx.gasPriceBig)) ||
            (oldTx.gasFeeCapBig && tx.gasFeeCapBig && oldTx.gasFeeCapBig.lt(tx.gasFeeCapBig)) ||
            (oldTx.gasTipCapBig && tx.gasTipCapBig && oldTx.gasTipCapBig.lt(tx.gasTipCapBig)))
        ) {
          pendingAddressGasMap.set(tx.to, tx);
          replace = true;
        }
        if (replace) {
          let waitingData = commitWaitingMap.get(commiter.address);
          if (waitingData) {
            oldTx = waitingData.gasTx;
            if (
              oldTx && //oldTx.blockNumber < tx.blockNumber ||
              ((oldTx.gasPriceBig && tx.gasPriceBig && oldTx.gasPriceBig.lt(tx.gasPriceBig)) ||
                (oldTx.gasFeeCapBig && tx.gasFeeCapBig && oldTx.gasFeeCapBig.lt(tx.gasFeeCapBig)) ||
                (oldTx.gasTipCapBig && tx.gasTipCapBig && oldTx.gasTipCapBig.lt(tx.gasTipCapBig)))
            ) {
              waitingData.placeOrderCallPamas.overrides.maxFeePerGas =
                waitingData.placeOrderCallPamas.overrides.maxFeePerGas.mul(110).div(100).add(1);
              waitingData.placeOrderCallPamas.overrides.maxPriorityFeePerGas =
                waitingData.placeOrderCallPamas.overrides.maxPriorityFeePerGas.mul(110).div(100).add(1);
              // if (tx.gasFeeCapBig.gt(oldTx.gasFeeCapBig.mul(110).div(100))) {
              //   waitingData.placeOrderCallPamas.overrides.maxFeePerGas = tx.gasFeeCapBig.mul(110).div(100).add(1);
              //   waitingData.placeOrderCallPamas.overrides.maxPriorityFeePerGas = tx.gasTipCapBig.mul(110).div(100).add(1);
              // } else {
              if (tx.gasFeeCapBig.gt(waitingData.placeOrderCallPamas.overrides.maxFeePerGas)) {
                // feeDatamaxFeePerGas = tx.gasFeeCapBig.mul(100 + ((now % 10) + 50)).div(100);
                waitingData.placeOrderCallPamas.overrides.maxFeePerGas = tx.gasFeeCapBig.add(1);
                waitingData.placeOrderCallPamas.overrides.maxPriorityFeePerGas =
                  waitingData.placeOrderCallPamas.overrides.maxFeePerGas;
                waitingData.gasTx = tx;
                tx.createAt = 0;
              } else if (tx.gasPriceBig.gt(waitingData.placeOrderCallPamas.overrides.maxFeePerGas)) {
                // feeDatamaxFeePerGas = tx.gasPriceBig.mul(100 + ((now % 10) + 50)).div(100);
                waitingData.placeOrderCallPamas.overrides.maxFeePerGas = tx.gasFeeCapBig.add(1);
                waitingData.placeOrderCallPamas.overrides.maxPriorityFeePerGas =
                  waitingData.placeOrderCallPamas.overrides.maxFeePerGas;
                waitingData.gasTx = tx;
                tx.createAt = 0;
              }
              // }
              console.log('gas追', tx.hash, tx.to, tx);
              let feeDatamaxFeePerGasFinal = waitingData.placeOrderCallPamas.overrides.maxFeePerGas;
              let feeDatamaxPriorityFeePerGasFinal = waitingData.placeOrderCallPamas.overrides.maxPriorityFeePerGas;
              let gasLimitFinal = waitingData.placeOrderCallPamas.overrides.gasLimit.mul(200).div(100);
              if (gasLimitFinal.lt(500000)) {
                gasLimitFinal = BigNumber.from(500000);
              }
              let gasCost = feeDatamaxPriorityFeePerGasFinal.add(feeDatamaxFeePerGasFinal).mul(gasLimitFinal);
              if (gasCost.gt(MAX_UINT18_ZERO.mul(8))) {
                gasCost = MAX_UINT18_ZERO.mul(8);
                if (waitingData.placeOrderCallPamas.overrides.maxFeePerGas.lt(gasCost.div(gasLimitFinal).div(2))) {
                  console.log(
                    'gas追单价格最大值20000的限制:',
                    waitingData.placeOrderCallPamas.overrides.maxFeePerGas.toString(),
                  );
                  sendBotMessage(`gas追单价格最大值,放弃:${lastBlockNumber},${tx.from},${tx.to},${tx.hash}`);
                  break;
                }
                waitingData.placeOrderCallPamas.overrides.maxFeePerGas = gasCost.div(gasLimitFinal).div(2);
                waitingData.placeOrderCallPamas.overrides.maxPriorityFeePerGas =
                  waitingData.placeOrderCallPamas.overrides.maxFeePerGas;
              }
              try {
                let ret1 = waitingData.ret.indata.tokenPath.instanceTrendingCall.placeOrderCallDeadlineBlock(
                  waitingData.placeOrderCallPamas.encodeData,
                  waitingData.pairId,
                  waitingData.inputNonce,
                  waitingData.placeOrderCallPamas.lastBlockNumber,
                  waitingData.placeOrderCallPamas.overrides,
                );
                waitingData.replaceHashs.push((await ret1).hash);
                pendingMsg = `发现pending对手gas更高,跟进3:${lastBlockNumber},${tx.from},${tx.to},${tx.hash}`;
                console.log('pending:', pendingMsg);
                if (true) {
                  let rowtx = {
                    data: waitingData.placeOrderCallPamas.data,
                    ...waitingData.placeOrderCallPamas.overrides,
                    to: waitingData.ret.indata.tokenPath.instanceTrendingCall.address,
                  };
                  rowtx.gasLimit = rowtx.gasLimit.add(1);
                  let tx = await commiter.populateTransaction(rowtx);
                  let signedTx = await commiter.signTransaction(tx);
                  console.log('signedTx:', signedTx);
                  let sendMsg = JSON.stringify({ m: 'sendtx', p: signedTx.substring(2) });
                  roy_ws_block._wss.send(sendMsg);
                  console.log('pending Roy sendMsg:', sendMsg);
                }
              } catch (e) {
                console.log('gas追单报错:', e);
              }
            }
          }
        }
      }
      if (pendingMsg && lastPendingMsgBlockNumber != lastBlockNumber) {
        lastPendingMsgBlockNumber = lastBlockNumber;
        sendBotMessage(pendingMsg);
      }
    });
  }
  // await getBlockConfirmPrice();
};

type SwapCallPamas = {
  data?: string; //txdata
  encodeData: string;
  lastBlockNumber: number;
  pairId: number;
  inputNonce: number;
  overrides: {
    gasLimit?: BigNumber;
    gasPrice?: BigNumber;
    maxFeePerGas?: BigNumber;
    maxPriorityFeePerGas?: BigNumber;
    nonce?: any;
    type?: number;
    accessList?: any;
    customData?: Record<string, any>;
  };
};
type CommitWait = {
  createAt: number;
  blockNumber: number;
  canceling?: boolean;
  inputNonce?: number;
  pairId?: number;
  checkCancelCommiting?: boolean; //正在尝试后悔撤单状态
  hash: string;
  num: number;
  gasTx: PendingTransactionHash; //追单交易,用来补差价
  placeOrderCallPamas: SwapCallPamas;
  ret: TryTrendingRet;
  replaceHashs: string[];
};
export let commitPendingWaitingMap = new Map<string, CommitWait>();
let getChanceTypeDesc = (chanceType: number) => {
  if (chanceType == 0) {
    return '链下';
  } else if (chanceType == 1) {
    return '链上';
  } else if (chanceType == 2) {
    return 'PENDING';
  } else if (chanceType == 3) {
    return 'MINED';
  } else if (chanceType == 4) {
    return 'ROYLOG';
  }
};

export let commitWaitingMap = new Map<string, CommitWait>();
let commitPathstrMap = new Map<string, number>();
let waitForTransaction: any;
export let commitTrending = async (
  ret: TryTrendingRet,
  instanceTrendingCall: TrendingCall,
  pathMap: Map<string, number>,
  desc: string,
  instanceTrendingCall_quickNode: TrendingCall,
) => {
  let commiter = ret.indata.tokenPath.spotCx.commiter;
  let gasLimit = ret.indata.gasLimit;
  if (pathMap) {
    pathMap.set(ret.pathAddr.toString(), (pathMap.get(ret.pathAddr.toString()) || 0) + 1);
  }
  // logger.debug('路径:', ret.indata.header, ret.pathAddr.toString());
  ret.indata.header.pathLen = ret.pathAddr.length;
  //这里会增加延迟,空了想办法
  let gasPrice = feeData.gasPrice;
  // if (gasPriceLast) {
  //   gasPrice = gasPrice.mul(13).div(10);
  // }
  // let gas = gasPrice.mul(gasLimit); // 0.02 * 10 ** 18; 假定0.02eth
  let gas = gasPrice.mul(0).mul(ret.indata.tokenPath.endToken.oneBig).div(ret.indata.tokenPath.startToken.oneBig); // 0.02 * 10 ** 18; 假定0.02eth
  //1e18 = 10 ** (await erc200.decimals(),如果换usd需要换精度
  let precision = BigNumber.from(
    '0x' + (ret.indata.tokenPath.minVolume * ret.indata.tokenPath.startToken.one).toString(16),
  );
  let R = ret.indata.header.R;
  let K = ret.indata.header.volume;
  console.log('xxxxxxxx:', R.toString(), K.toString(), gas.toString());
  let RKKgas = R.mul(K)
    .mul(K)
    .div(precision)
    .div(1e9)
    .mul(ret.indata.tokenPath.endToken.oneBig)
    .div(ret.indata.tokenPath.startToken.oneBig)
    .add(gas);
  let RKKgas1 = RKKgas;
  ret.indata.header.RKKgas = RKKgas;
  // if (ret.indata.header.RKKgas.gt(16777215)) {
  //   logger.debug('滑点不正常,放弃:', ret.indata.header.RKKgas.toString());
  //   return false;
  // }
  // ret.indata.header.RKKgas = BigNumber.from(0);
  // ret.indata.header.gasPrice = ret.indata.header.gasPrice.div(1e9); //节省字节
  // ret.indata.header.R = ret.indata.header.R.shr(16); //节省字节
  let encodeData = ret.indata.tokenPath.getEncodeData(ret.indata);
  if (!encodeData) {
    console.log('路径可下单量太小,放弃:2:');
    return false;
  }
  logger.debug(desc + ':参数:', lastBlockNumber, instanceTrendingCall.address, encodeData, ret.pathAddr);
  let getK = await instanceTrendingCall.getInputData(encodeData);
  console.log(
    'getK:',
    gasLimit.toString(),
    parseFloat(getK.OrderNotionalAll.toString()) / ret.indata.tokenPath.endToken.one,
    parseFloat(K.toString()) / ret.indata.tokenPath.startToken.one,
    R.toString(),
    parseFloat(RKKgas.toString()) / ret.indata.tokenPath.endToken.one,
    parseFloat(RKKgas1.toString()) / ret.indata.tokenPath.endToken.one,
    getK.header,
  );
  // assert(getK.V.gt(getK.arbdata.header.RKKgas), getK.V.toString(), getK.arbdata.header.RKKgas.toString());
  let balance = ret.indata.tokenPath.startTokenBalance;
  if (ret.indata.tokenPath.startTokenAddress != ret.indata.tokenPath.endTokenAddress) {
    if (balance.lt(ret.indata.tokenPath.startToken.balanceMinBigNumber)) {
      balance = BigNumber.from(0);
      // } else {
      //   balance = balance.sub(ret.indata.tokenPath.startToken.balanceMinBigNumber);
    }
  }
  //先处理小额机会测试
  if (balance.lt(K)) {
    logger.debug(
      desc + '余额不足:',
      ret.indata.tokenPath.startToken.symbol,
      parseFloat(balance.toString()) / ret.indata.tokenPath.startToken.one,
      parseFloat(K.toString()) / ret.indata.tokenPath.startToken.one,
    );
    sendBotMessage(
      `余额不足:, ${ret.indata.tokenPath.startToken.symbol}, ${
        parseFloat(balance.toString()) / ret.indata.tokenPath.startToken.one
      }, ${parseFloat(K.toString()) / ret.indata.tokenPath.startToken.one}`,
    );
    return false;
  }
  //这里做个止损,不能超过UnitNotional的10%
  if (StartRealizedPNL == 0) {
    StartRealizedPNL = ret.indata.tokenPath.spotCx.gridConfig.RealizedPNL;
  }
  let diffRealizedPNL = ret.indata.tokenPath.spotCx.gridConfig.RealizedPNL - StartRealizedPNL;
  if (
    ret.indata.tokenPath.spotCx.gridConfig.TargetNotional == 0 &&
    diffRealizedPNL < 0 &&
    Math.abs(diffRealizedPNL) >
      (ret.indata.tokenPath.spotCx.gridConfig.UnitNotional * ret.indata.tokenPath.spotCx.gridConfig.NewLevel) / 5
  ) {
    sendBotMessage(`亏损严重,暂停下单,请检查`);
    return false;
  }
  // try {
  //   gasLimit = await instanceTrendingCall.estimateGas.placeOrderCall(encodeData);
  // } catch (e) {
  //   logger.debug('测试模拟执行失败,放弃:', gasLimit.toString(), e);
  //   gasLimit = BigNumber.from(0);
  // }
  // if (gasLimit.toNumber() < 150000) {
  //   logger.debug('gas预测不正常,说明模拟执行失败,放弃:', gasLimit.toString());
  //   return false;
  // }
  gas = gasPrice
    .mul(gasLimit)
    .mul(ret.indata.tokenPath.gasBase)
    .div(1e6)
    .mul(ret.indata.tokenPath.endToken.oneBig)
    .div(ret.indata.tokenPath.startToken.oneBig)
    .div(MAX_UINT18_ZERO); // 0.02 * 10 ** 18; 假定0.02eth
  RKKgas = R.mul(K)
    .mul(K)
    .div(precision)
    .div(1e9)
    .mul(ret.indata.tokenPath.endToken.oneBig)
    .div(ret.indata.tokenPath.startToken.oneBig)
    .add(gas);

  encodeData = ret.indata.tokenPath.getEncodeData(ret.indata);
  if (!encodeData) {
    console.log('路径可下单量太小,放弃:1:');
    return false;
  }
  let waitingData = commitWaitingMap.get(commiter.address);
  if (waitingData && waitingData.num >= 2) {
    if (Date.now() - waitingData.createAt > 1800 * 1000) {
      logger.debug('挂单超时,可能是报错了,清除:', commitWaitingMap);
      commitWaitingMap.delete(commiter.address);
    }
    if (waitingData.hash != 'pending' && (await myprovider.getTransaction(waitingData.hash))) {
      logger.debug('有交易还未完成,放弃:', commitWaitingMap);
      return false;
    }
  }
  // let ret2: ContractReceipt;
  let ret2: TransactionReceipt;
  try {
    commitPathstrMap.set(ret.indata.pathstr, Date.now());
    waitingData = commitWaitingMap.get(commiter.address);
    if (!waitingData) {
      waitingData = {
        createAt: Date.now(),
        blockNumber: !lastRoyBlockNumber || lastBlockNumber > lastRoyBlockNumber ? lastBlockNumber : lastRoyBlockNumber,
        hash: 'pending',
        num: 0,
        gasTx: null,
        placeOrderCallPamas: null,
        ret: ret,
        replaceHashs: [],
      };
    }
    waitingData.num++;
    commitWaitingMap.set(commiter.address, waitingData);
    //调试日志
    ret.indata.tokenPath.getVLog(ret);
    let feeDatamaxFeePerGas = feeData.maxFeePerGas.mul(2);
    let feeDatamaxPriorityFeePerGas = feeDatamaxFeePerGas;
    //core/types/transaction.go:611:		msg.gasPrice = math.BigMin(msg.gasPrice.Add(msg.gasTipCap, baseFee), msg.gasFeeCap)
    //这个数字我怀疑有bug,从0.X到几万都有,只能控制最大值了
    if (latestBaseFeePerGas?.gt(feeDatamaxFeePerGasMax)) {
      latestBaseFeePerGas = feeDatamaxFeePerGasMax;
    }
    if (latestBaseFeePerGas?.add(feeDatamaxPriorityFeePerGas).lt(feeData.gasPrice.mul(1))) {
      feeDatamaxFeePerGas = feeData.gasPrice.add(1);
      feeDatamaxPriorityFeePerGas = feeData.gasPrice.add(1);
    }
    // if (feeDatamaxFeePerGas.lt(latestBaseFeePerGas.mul(2))) {
    //   feeDatamaxFeePerGas = latestBaseFeePerGas.mul(2).add(1);
    //   if (feeDatamaxPriorityFeePerGas.lt(latestBaseFeePerGas)) {
    //     feeDatamaxPriorityFeePerGas = latestBaseFeePerGas.add(1);
    //   }
    // }
    if (feeDatamaxPriorityFeePerGas.lt(50 * 1e9)) {
      feeDatamaxFeePerGas = feeDatamaxFeePerGas.mul(200).div(100);
      feeDatamaxPriorityFeePerGas = feeDatamaxFeePerGas;
    } else if (feeDatamaxPriorityFeePerGas.lt(100 * 1e9)) {
      feeDatamaxFeePerGas = feeDatamaxFeePerGas.mul(150).div(100);
      feeDatamaxPriorityFeePerGas = feeDatamaxFeePerGas;
    }
    if (ret.indata.chanceType) {
      if (feeDatamaxFeePerGas.lt(feeDatamaxFeePerGasBase)) {
        feeDatamaxFeePerGas = feeDatamaxFeePerGasBase;
        feeDatamaxPriorityFeePerGas = feeDatamaxFeePerGas;
      }
      // if (Math.abs(ret.indata.DiffNotional) >= 2) {
      //   feeDatamaxFeePerGas = feeDatamaxFeePerGasMax;
      //   feeDatamaxPriorityFeePerGas = feeDatamaxFeePerGas;
      // } else if (Math.abs(ret.indata.DiffNotional) == 2) {
      //   feeDatamaxFeePerGas = feeDatamaxFeePerGas.mul(2);
      //   feeDatamaxPriorityFeePerGas = feeDatamaxFeePerGas;
      // }
    } else {
      if (feeDatamaxFeePerGas.lt(feeDatamaxFeePerGasBase)) {
        feeDatamaxFeePerGas = feeDatamaxFeePerGasBase;
        feeDatamaxPriorityFeePerGas = feeDatamaxFeePerGas;
      }
      if (Math.abs(ret.indata.DiffNotional) >= 2) {
        feeDatamaxFeePerGas = feeDatamaxFeePerGasMax;
        feeDatamaxPriorityFeePerGas = feeDatamaxFeePerGas;
      } else if (Math.abs(ret.indata.DiffNotional) == 2) {
        feeDatamaxFeePerGas = feeDatamaxFeePerGas.mul(2);
        feeDatamaxPriorityFeePerGas = feeDatamaxFeePerGas;
      }
    }
    //core/types/transaction.go:611:		msg.gasPrice = math.BigMin(msg.gasPrice.Add(msg.gasTipCap, baseFee), msg.gasFeeCap)
    //这个数字我怀疑有bug,从0.X到几万都有,只能控制最大值了
    let now = Date.now();
    let pendingMsg = '';
    for (let [_, tx] of pendingAddressGasMap) {
      if (now - tx.createAt < 1501) {
        //有必要再初始化
        // if (ret.pathAddrNo0x.length == 0) {
        //   for (let addr of ret.pathAddr) {
        //     ret.pathAddrNo0x.push(addr.substring(2).toLowerCase());
        //   }
        // }
        // let hasPool = false;
        // for (let addr of ret.pathAddrNo0x) {
        //   if (tx.input.includes(addr)) {
        //     hasPool = true;
        //     break;
        //   }
        // }
        // if (!hasPool) {
        //   continue;
        // }
        if (tx.gasFeeCapBig.gt(feeDatamaxFeePerGas)) {
          // feeDatamaxFeePerGas = tx.gasFeeCapBig.mul(100 + ((now % 10) + 50)).div(100);
          feeDatamaxFeePerGas = tx.gasFeeCapBig.add(1);
          feeDatamaxPriorityFeePerGas = feeDatamaxFeePerGas;
          waitingData.gasTx = tx;
          console.log(
            '发现pending对手gas更高,跟进0:',
            lastBlockNumber,
            tx.from,
            tx.to,
            tx.hash,
            tx.gasFeeCap.toString(),
          );
          // sendBotMessage(`发现pending对手gas更高,跟进0:${tx.to}`);
          pendingMsg = `发现pending对手gas更高,跟进0:${lastBlockNumber},${tx.from},${tx.to},${
            tx.hash
          },${tx.gasFeeCap.toString()}`;
          tx.createAt = 0;
        } else if (tx.gasPriceBig.gt(feeDatamaxFeePerGas.mul(2))) {
          // feeDatamaxFeePerGas = tx.gasPriceBig.mul(100 + ((now % 10) + 50)).div(100);
          feeDatamaxFeePerGas = tx.gasFeeCapBig.add(1);
          feeDatamaxPriorityFeePerGas = feeDatamaxFeePerGas;
          waitingData.gasTx = tx;
          console.log(
            '发现pending对手gas更高,跟进1:',
            lastBlockNumber,
            tx.from,
            tx.to,
            tx.hash,
            tx.gasFeeCap.toString(),
          );
          pendingMsg = `发现pending对手gas更高,跟进1:${lastBlockNumber},${tx.from},${tx.to},${
            tx.hash
          },${tx.gasFeeCap.toString()}`;
          tx.createAt = 0;
        }
        //下面这个情况应该不会出现,观察
        if (tx.gasFeeCapBig.gt(feeDatamaxPriorityFeePerGas)) {
          feeDatamaxPriorityFeePerGas = tx.gasFeeCapBig.add(1);
          waitingData.gasTx = tx;
          console.log('发现pending对手gas更高,跟进2:', lastBlockNumber, tx.from, tx.to, tx.gasFeeCap.toString());
          pendingMsg = `发现pending对手gas更高,跟进2:${lastBlockNumber},${tx.from},${tx.to}`;
          tx.createAt = 0;
        }
        if (feeDatamaxFeePerGas.gt(feeDatamaxFeePerGasMax)) {
          feeDatamaxFeePerGas = feeDatamaxFeePerGasMax;
          feeDatamaxPriorityFeePerGas = feeDatamaxFeePerGas;
          sendBotMessage(`达到gas上限,不再跟进:${lastBlockNumber},${tx.from},${tx.to},${tx.gasFeeCap.toString()}`);
          break;
        }
      }
    }
    if (pendingMsg) {
      sendBotMessage(pendingMsg);
    }
    let volumeUsd = parseFloat(ret.indata.header.volume.toString()) / ret.indata.tokenPath.startToken.one;
    volumeUsd = volumeUsd * ret.indata.tokenPath.startToken.priceUsd;
    console.log(
      'xxxxxx:下单价值:',
      ret.indata.tokenPath.startToken.symbol,
      ret.indata.tokenPath.startToken.priceUsd,
      volumeUsd,
    );
    let feeDatamaxFeePerGasFinal = feeDatamaxFeePerGas;
    let feeDatamaxPriorityFeePerGasFinal = feeDatamaxPriorityFeePerGas;
    let gasLimitFinal = gasLimit.mul(200).div(100);
    if (gasLimitFinal.lt(500000)) {
      gasLimitFinal = BigNumber.from(500000);
    }
    let gasCost = feeDatamaxPriorityFeePerGasFinal.add(feeDatamaxFeePerGasFinal).mul(gasLimitFinal);
    if (gasCost.gt(MAX_UINT18_ZERO.mul(8))) {
      gasCost = MAX_UINT18_ZERO.mul(8);
      feeDatamaxFeePerGasFinal = gasCost.div(gasLimitFinal).div(2);
      feeDatamaxPriorityFeePerGasFinal = feeDatamaxFeePerGasFinal;
    }
    //如果想换节点加速提交,至换这一个地方就可以
    let pendingNonce = 0;
    if (waitingData.replaceHashs.length > 0) {
      pendingNonce = waitingData.placeOrderCallPamas.overrides.nonce;
      feeDatamaxFeePerGasFinal = feeDatamaxFeePerGasFinal.mul(110).div(100).add(1);
      feeDatamaxPriorityFeePerGasFinal = feeDatamaxPriorityFeePerGasFinal.mul(110).div(100).add(1);
      console.log('改单:', waitingData.placeOrderCallPamas.overrides.nonce, waitingData.replaceHashs);
    } else {
      pendingNonce = await commiter.provider.getTransactionCount(commiter.address, 'pending');
    }
    let placeOrderCallPamas: SwapCallPamas = {
      encodeData: encodeData,
      lastBlockNumber: lastBlockNumber + 30,
      pairId: ret.indata.tokenPath.spotCx.gridConfig.pairId || 0,
      inputNonce: 0,
      overrides: {
        nonce: pendingNonce,
        // value: 1,
        // gasPrice: gasPrice,
        // gasPrice: feeDatamaxFeePerGas,
        maxFeePerGas: feeDatamaxFeePerGasFinal, //这个给多一点没关系,不会浪费,但是可以避免被卡住不打包
        maxPriorityFeePerGas: feeDatamaxPriorityFeePerGasFinal,
        gasLimit: gasLimitFinal.div(2).mul(2), //取整区分roy下单
      },
    };
    waitingData.placeOrderCallPamas = placeOrderCallPamas;
    console.log('时间分析,准备下单:', Date.now(), lastBlockTime, lastBlockNumber);
    let gridConfig = ret.indata.tokenPath.spotCx.gridConfig;
    let inputNonce = (await instanceTrendingCall_quickNode.getPairList())[0].nonce + 1;
    waitingData.pairId = gridConfig.pairId || 0;
    waitingData.inputNonce = inputNonce;
    placeOrderCallPamas.inputNonce = 0;
    //买入卖出
    if (!ret.indata.tokenPath.spotCx.botDNotional) {
      let nonceData = (await instanceTrendingCall_quickNode.getPairList())[placeOrderCallPamas.pairId];
      console.log('nonceData:', nonceData);
      placeOrderCallPamas.inputNonce = nonceData.nonce + 1;
      ret.indata.tokenPath.spotCx.botDNotional = 0;
    } else {
      ret.indata.tokenPath.spotCx.botDNotional = 0;
      console.log('非策略下单:', ret.indata.tokenPath.spotCx.botDNotional);
    }
    // console.log('时间分析,准备下单:', Date.now(), lastBlockTime, lastBlockNumber, lastBlockNumber);
    let data = instanceTrendingCall_quickNode.interface.encodeFunctionData('placeOrderCallDeadlineBlock', [
      placeOrderCallPamas.encodeData,
      placeOrderCallPamas.pairId,
      placeOrderCallPamas.inputNonce,
      placeOrderCallPamas.lastBlockNumber,
    ]);
    let rowtx = {
      data: data,
      ...placeOrderCallPamas.overrides,
      to: instanceTrendingCall_quickNode.address,
    };
    rowtx.gasLimit = rowtx.gasLimit.add(1);
    let tx = await commiter.populateTransaction(rowtx);
    let signedTx = await commiter.signTransaction(tx);
    console.log('signedTx:', signedTx);
    let sendMsg = JSON.stringify({ m: 'sendtx', p: signedTx.substring(2) });
    roy_ws_block._wss.send(sendMsg);
    console.log('Roy sendMsg:', sendMsg, inputNonce);
    let ret1 = await instanceTrendingCall_quickNode.placeOrderCallDeadlineBlock(
      placeOrderCallPamas.encodeData,
      placeOrderCallPamas.pairId,
      placeOrderCallPamas.inputNonce,
      placeOrderCallPamas.lastBlockNumber,
      placeOrderCallPamas.overrides,
    );
    waitingData.replaceHashs.push(ret1.hash);
    gridConfig.OnOverOffPositivePositionPending = gridConfig.OnOverOffPositivePosition;
    gridConfig.OnOverOffNegativePositionPending = gridConfig.OnOverOffNegativePosition;
    ret.indata.tokenPath.spotCx.gridConfig.DiffNotional = ret.indata.DiffNotional;
    let DiffNotional = ret.indata.DiffNotional;
    let DiffPosition = ret.indata.DiffPosition;
    let priceDx = ret.indata.tokenPath.spotCx.gridConfig.OnchainBid;
    let priceDxStop = ret.indata.priceDxStop;
    if (ret.indata.tokenPath.startToken.key == ret.indata.tokenPath.spotCx.market.token1.key) {
      priceDx = 1 / ret.indata.tokenPath.spotCx.gridConfig.OnchainAsk;
      //统一下显示
      priceDx = 1 / priceDx;
      if (priceDxStop) {
        priceDxStop = 1 / priceDxStop;
      }
    }
    console.log('时间分析,下单完成:', Date.now(), lastBlockTime, lastBlockNumber, ret1.blockNumber, ret1.hash);
    //统一下显示
    // if (ret.indata.tokenPath.startToken.key == ret.indata.tokenPath.spotEx.market.token1.key) {
    //   priceDx = ret.indata.tokenPath.spotEx.gridConfig.OnchainBid;
    // }
    let symbols = '';
    for (let addr of ret.pathAddr) {
      let market = exchangeMarketAddressMap.get(addr);
      symbols = symbols + (symbols.length > 0 ? ':' : '') + market.symbol;
    }
    sendBotMessage(
      `提交订单${ret.indata.tokenPath.startToken.symbol}-${ret.indata.tokenPath.endToken.symbol}:\n操作:${
        ret.indata.op
      }\n路径:${symbols}\n机会:${getChanceTypeDesc(ret.indata.chanceType)}\n下单量:${
        parseFloat(DiffPosition.toString()) / ret.indata.tokenPath.startToken.one
      }\n下单价:${priceDx}\n刹车价:${priceDxStop}\n链上价格:${gridConfig.OnchainBid.toFixed(
        8,
      )}/${gridConfig.OnchainAsk.toFixed(8)}(${(gridConfig.OnchainBid / gridConfig.OnchainAsk).toFixed(
        8,
      )})\n链下价格:${gridConfig.OffchainBid.toFixed(8)}/${gridConfig.OffchainAsk.toFixed(8)}(${(
        gridConfig.OffchainBid / gridConfig.OffchainAsk
      ).toFixed(8)})\ngasPrice:${parseFloat(feeData.gasPrice.toString()) / 1e9}GWEI`,
    );
    waitingData.hash = ret1.hash;
    console.log(
      desc + ':ret1:',
      ret.indata.tokenPath.startToken.symbol,
      ret.indata.tokenPath.endToken.symbol,
      ret.pathAddr.length,
      lastBlockNumber,
      ret1,
    );
    commitPathstrMap.delete(ret.indata.pathstr);
    let getK = await instanceTrendingCall.getInputData(encodeData);
    console.log(
      'instanceTrendingCall.placeOrderCallDeadlineChi.getK:',
      getK.OrderNotionalAll.toString(),
      getK.header,
      ...getK.orders,
    );
    let position0Before = 0;
    let position1Before = 0;
    let position0After = 0;
    let position1After = 0;
    let nonceData = (await ret.indata.tokenPath.instanceTrendingCall.getPairList())[gridConfig.pairId];
    if (ret.indata.tokenPath.startToken.key == ret.indata.tokenPath.spotCx.market.token0.key) {
      position0Before = parseFloat(nonceData.position0.toString()) / ret.indata.tokenPath.startToken.one;
      position1Before = parseFloat(nonceData.position1.toString()) / ret.indata.tokenPath.endToken.one;
    } else {
      position0Before = parseFloat(nonceData.position0.toString()) / ret.indata.tokenPath.endToken.one;
      position1Before = parseFloat(nonceData.position1.toString()) / ret.indata.tokenPath.startToken.one;
    }
    // let tmpBalance = await ret.indata.tokenPath.GetStartEndTokenBalance();
    // let startTokenBalanceBefore = tmpBalance.startTokenBalance;
    // let endTokenBalanceBefore = tmpBalance.endTokenBalance;
    let gasBalanceBefore = await commiter.getBalance();
    let ret1WaitFunc = async (hash: string, first: boolean, confirmations: number) => {
      let newPrice = gridConfig.NewLevel;
      try {
        // ret2 = await commiter.provider.waitForTransaction(hash, confirmations, 60000);
        // ret2 = await commiter.provider.waitForTransaction(hash, confirmations, 60000);
        ret2 = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            waitForTransaction = null;
            reject('timeout exceeded');
          }, 60 * 1000);
          // waitForTransaction(waitingData, resolve, timer);
          waitForTransaction = async () => {
            for (let hash of waitingData.replaceHashs) {
              const receipt = await commiter.provider.getTransactionReceipt(hash);
              if (receipt?.confirmations > 0) {
                waitForTransaction = null;
                resolve(receipt);
                clearTimeout(timer);
              } else {
                // console.log('waitForTransaction waiting:', receipt);
              }
            }
          };
        });
        if (!ret2) {
          console.log('过期hash:', hash);
          return false;
        }
        // ret1.hash;
        // ret2 = await ret1.wait();
        console.log('时间分析,打包完成:', Date.now(), lastBlockTime, lastBlockNumber, ret2.blockNumber, hash);
        // let tmpBalance = await ret.indata.tokenPath.GetStartEndTokenBalance();
        // let startTokenBalanceAfter = tmpBalance.startTokenBalance;
        // let endTokenBalanceAfter = tmpBalance.endTokenBalance;
        let gasBalanceAfter = await commiter.getBalance();
        console.log(
          desc + ':ret2:',
          ret.indata.tokenPath.startToken.symbol,
          ret.indata.tokenPath.endToken.symbol,
          ret.pathAddr.length,
          ret2.blockNumber,
          ret2,
        );
        let diffPNL = 0;
        let amountStart = 0;
        let amountEnd = 0;
        let nonceData = (await ret.indata.tokenPath.instanceTrendingCall.getPairList())[gridConfig.pairId];
        if (ret.indata.tokenPath.startToken.key == ret.indata.tokenPath.spotCx.market.token0.key) {
          position0After = parseFloat(nonceData.position0.toString()) / ret.indata.tokenPath.startToken.one;
          position1After = parseFloat(nonceData.position1.toString()) / ret.indata.tokenPath.endToken.one;
          amountStart = position0After - position0Before;
          amountEnd = position1After - position1Before;
        } else {
          position0After = parseFloat(nonceData.position0.toString()) / ret.indata.tokenPath.endToken.one;
          position1After = parseFloat(nonceData.position1.toString()) / ret.indata.tokenPath.startToken.one;
          amountEnd = position0After - position0Before;
          amountStart = position1After - position1Before;
        }
        // //有余额变动说明执行成功,先不考虑手动提取的情况
        // let amountStart =
        //   parseFloat(startTokenBalanceAfter.sub(startTokenBalanceBefore).toString()) /
        //   ret.indata.tokenPath.startToken.one;
        // let amountEnd =
        //   parseFloat(endTokenBalanceAfter.sub(endTokenBalanceBefore).toString()) / ret.indata.tokenPath.endToken.one;
        // if (amountStart < 0) {
        //如果有两个以上的事件就说明执行成功,否则可能是被刹车了,不用余额判断主要是考虑以后的本金共用
        if (ret2.logs?.length >= 2) {
          // let amount0 = 0;
          // if (ret.indata.tokenPath.startToken.key == ret.indata.tokenPath.spotCx.market.token0.key) {
          //   amount0 = amountStart;
          // } else {
          //   amount0 = amountEnd;
          // }
          //如果余额没有变化说明被分叉了
          // if (amountStart == 0 || amountEnd == 0 || Math.abs(amount0) < gridConfig.UnitNotional / 10) {
          if (position0After == position0Before) {
            console.log('链上数据不一致了');
            let tmpop = '被叔块的';
            // if (Math.abs(amount0) < gridConfig.UnitNotional / 2) {
            //   tmpop = '被分叉的';
            // }
            let desc1 = `${ret.indata.tokenPath.startToken.symbol}-${ret.indata.tokenPath.endToken.symbol}\t${tmpop}${
              ret.indata.op
            }\t${gridConfig.OnOverOffPositivePosition}\t${gridConfig.OnOverOffNegativePosition}\t${
              gridConfig.OnOverOffPositivePositionConfirm
            }\t${gridConfig.OnOverOffNegativePositionConfirm}\t${ret.indata.DiffNotional}\t${DiffNotional}\t${
              gridConfig.TargetNotional
            }\t${parseFloat(ret.indata.header.volume.toString()) / ret.indata.tokenPath.startToken.one}\t${
              gridConfig.OnchainOverOffchainSpread
            }\t${gridConfig.OffchainOverOnchainSpread}\t${gridConfig.OnchainBid}\t${gridConfig.OnchainAsk}\t${
              gridConfig.OffchainBid
            }\t${gridConfig.OffchainAsk}\t${ret.indata.lastBlockNumber}\t${ret2.blockNumber}\t${
              ret.indata.tokenPath.poolPathBest.path.length
            }\t${ret.indata.pathDesc}\t${gridConfig.commitTimes}\t${gridConfig.RealizedPNL}\t${
              gridConfig.UnrealizedPNL
            }\t${gridConfig.gasCost}\t${gridConfig.TargetNotional * gridConfig.UnitNotional}\t${
              gridConfig.ActualPosition
            }\t${gridConfig.NewLevel}\t${gridConfig.PositionEntryLevel}\t${gridConfig.updateTime}\t${
              gridConfig.token0Balance
            }\t${gridConfig.token1Balance}\t${getChanceTypeDesc(ret.indata.chanceType)}
        `;
            PrintLineLog(desc1);
            for (let tokenPath of tokenPaths) {
              if (tokenPath.spotCx.isStartToken(tokenPath.startToken.key) && tokenPath.spotCx.gridConfig.checkReset) {
                console.log('刹车矫正查bug:', gridConfig.ActualPosition, gridConfig.TargetPosition);
                await tokenPath.spotCx.CheckResetTargetNotional(tokenPath);
              }
            }
            commitWaitingMap.delete(commiter.address);
          } else {
            let NewAmount = 0;
            let OrderDirection = 1;
            //重新计算下实际成交量
            // DiffPosition = parseFloat(startTokenBalanceBefore.sub(startTokenBalanceAfter).toString()); // /ret.indata.tokenPath.startToken.one;
            DiffPosition = position0After - position0Before;

            gridConfig.OnOverOffPositivePositionPending = gridConfig.OnOverOffPositivePosition;
            gridConfig.OnOverOffNegativePositionPending = gridConfig.OnOverOffNegativePosition;
            gridConfig.OnOverOffPositivePositionConfirm = gridConfig.OnOverOffPositivePosition;
            gridConfig.OnOverOffNegativePositionConfirm = gridConfig.OnOverOffNegativePosition;
            gridConfig.TargetNotional = ret.indata.TargetNotional;
            gridConfig.DiffNotional = 0;
            //下面在余额不足的情况下有问题
            gridConfig.TargetPosition = gridConfig.TargetNotional * gridConfig.UnitNotional;
            if (ret.indata.OffsetPosition && gridConfig.TargetPosition) {
              if (gridConfig.TargetPosition > 0) {
                gridConfig.TargetPosition -= ret.indata.OffsetPosition * gridConfig.UnitNotional;
              } else {
                gridConfig.TargetPosition += ret.indata.OffsetPosition * gridConfig.UnitNotional;
              }
            }
            await ret.indata.tokenPath.UpdateStartEndTokenBalance();
            if (ret.indata.tokenPath.startToken.key == ret.indata.tokenPath.spotCx.market.token0.key) {
              OrderDirection = -1;
              NewAmount = -amountStart / gridConfig.UnitNotional;
              gridConfig.NewLevel = Math.abs(amountEnd / amountStart);
              gridConfig.token0Balance =
                parseFloat(ret.indata.tokenPath.startTokenBalance.toString()) /
                ret.indata.tokenPath.spotCx.market.token0.one;
              gridConfig.token1Balance =
                parseFloat(ret.indata.tokenPath.endTokenBalance.toString()) /
                ret.indata.tokenPath.spotCx.market.token1.one;
            } else {
              OrderDirection = 1;
              NewAmount = amountEnd / gridConfig.UnitNotional;
              gridConfig.NewLevel = Math.abs(amountStart / amountEnd);
              gridConfig.token0Balance =
                parseFloat(ret.indata.tokenPath.endTokenBalance.toString()) /
                ret.indata.tokenPath.spotCx.market.token0.one;
              gridConfig.token1Balance =
                parseFloat(ret.indata.tokenPath.startTokenBalance.toString()) /
                ret.indata.tokenPath.spotCx.market.token1.one;
            }
            newPrice = gridConfig.NewLevel;
            //PNL计算
            {
              let oldRealizedPNL = gridConfig.RealizedPNL;
              let OrderDirectionWithMultiplier = OrderDirection * NewAmount * gridConfig.UnitNotional;
              const EPSILON = gridConfig.UnitNotional / 100;
              if (Math.abs(gridConfig.ActualPosition) < EPSILON) {
                gridConfig.ActualPosition = OrderDirectionWithMultiplier;
                gridConfig.PositionEntryLevel = gridConfig.NewLevel;
              } else if (gridConfig.ActualPosition * OrderDirection > 0) {
                gridConfig.PositionEntryLevel =
                  (gridConfig.ActualPosition * gridConfig.PositionEntryLevel +
                    OrderDirectionWithMultiplier * gridConfig.NewLevel) /
                  (gridConfig.ActualPosition + OrderDirectionWithMultiplier);
                gridConfig.ActualPosition = gridConfig.ActualPosition + OrderDirectionWithMultiplier;
              } else if (NewAmount > Math.abs(gridConfig.ActualPosition)) {
                gridConfig.RealizedPNL +=
                  gridConfig.ActualPosition * (gridConfig.NewLevel - gridConfig.PositionEntryLevel);
                gridConfig.ActualPosition = OrderDirectionWithMultiplier + gridConfig.ActualPosition;
                gridConfig.PositionEntryLevel = gridConfig.NewLevel;
              } else {
                gridConfig.RealizedPNL +=
                  -OrderDirectionWithMultiplier * (gridConfig.NewLevel - gridConfig.PositionEntryLevel);
                gridConfig.ActualPosition = OrderDirectionWithMultiplier + gridConfig.ActualPosition;
              }
              if (gridConfig.ActualPosition > 0) {
                gridConfig.UnrealizedPNL =
                  gridConfig.ActualPosition * (gridConfig.OnchainBid - gridConfig.PositionEntryLevel);
              } else {
                gridConfig.UnrealizedPNL =
                  gridConfig.ActualPosition * (gridConfig.OnchainAsk - gridConfig.PositionEntryLevel);
              }
              //检查下是否需要矫正
              {
                if (
                  Math.abs(Math.abs(gridConfig.ActualPosition) - Math.abs(gridConfig.TargetPosition)) >=
                  gridConfig.UnitNotional
                ) {
                  for (let tokenPath of tokenPaths) {
                    if (
                      tokenPath.spotCx.isStartToken(tokenPath.startToken.key) &&
                      tokenPath.spotCx.gridConfig.checkReset
                    ) {
                      console.log(
                        '成交后发现ActualPosition对不上,矫正:',
                        gridConfig.ActualPosition,
                        gridConfig.TargetNotional,
                      );
                      await tokenPath.spotCx.CheckResetTargetNotional(tokenPath);
                    }
                  }
                }
              }
              if (gridConfig.TargetNotional == 0) {
                diffPNL = gridConfig.RealizedPNL - oldRealizedPNL;
              }
            }
            let desc1 = `${ret.indata.tokenPath.startToken.symbol}-${ret.indata.tokenPath.endToken.symbol}\t确认${
              ret.indata.op
            }\t${gridConfig.OnOverOffPositivePosition}\t${gridConfig.OnOverOffNegativePosition}\t${
              gridConfig.OnOverOffPositivePositionConfirm
            }\t${gridConfig.OnOverOffNegativePositionConfirm}\t${ret.indata.DiffNotional}\t${DiffPosition}\t${
              gridConfig.TargetNotional
            }\t${parseFloat(ret.indata.header.volume.toString()) / ret.indata.tokenPath.startToken.one}\t${
              gridConfig.OnchainOverOffchainSpread
            }\t${gridConfig.OffchainOverOnchainSpread}\t${gridConfig.OnchainBid}\t${gridConfig.OnchainAsk}\t${
              gridConfig.OffchainBid
            }\t${gridConfig.OffchainAsk}\t${ret.indata.lastBlockNumber}\t${ret2.blockNumber}\t${
              ret.indata.tokenPath.poolPathBest.path.length
            }\t${ret.indata.pathDesc}\t${gridConfig.commitTimes}\t${gridConfig.RealizedPNL}\t${
              gridConfig.UnrealizedPNL
            }\t${gridConfig.gasCost}\t${gridConfig.TargetNotional * gridConfig.UnitNotional}\t${
              gridConfig.ActualPosition
            }\t${gridConfig.NewLevel}\t${gridConfig.PositionEntryLevel}\t${gridConfig.updateTime}\t${
              gridConfig.token0Balance
            }\t${gridConfig.token1Balance}\t${getChanceTypeDesc(ret.indata.chanceType)}`;
            PrintLineLog(desc1);
          }
        } else {
          DiffNotional = 0;
          //失败就回退状态
          gridConfig.DiffNotional = 0;
          gridConfig.OnOverOffPositivePosition = gridConfig.OnOverOffPositivePositionConfirm;
          gridConfig.OnOverOffNegativePosition = gridConfig.OnOverOffNegativePositionConfirm;
          console.log(
            'ret3:被刹车了:',
            ret.indata.tokenPath.startToken.symbol,
            ret.indata.tokenPath.endToken.symbol,
            ret.pathAddr.length,
            ret2.blockNumber,
            parseFloat(ret.indata.header.RKKgas.toString()) / 1e18,
          );
          sendBotMessage(
            `\`刹车订单${ret.indata.tokenPath.startToken.symbol}-${ret.indata.tokenPath.endToken.symbol}:\n操作:${
              ret.indata.op
            }\n下单量:${parseFloat(DiffPosition.toString()) / ret.indata.tokenPath.startToken.one}\ngasPrice:${
              parseFloat(feeData.gasPrice.toString()) / 1e9
            }GWEI\``,
          );
          for (let tokenPath of tokenPaths) {
            if (tokenPath.spotCx.isStartToken(tokenPath.startToken.key) && tokenPath.spotCx.gridConfig.checkReset) {
              console.log('刹车矫正查bug:', gridConfig.ActualPosition, gridConfig.TargetPosition);
              await tokenPath.spotCx.CheckResetTargetNotional(tokenPath);
            }
          }
          commitWaitingMap.delete(commiter.address);
        }
        //PNL计算在这里
        let gasCost = parseFloat(gasBalanceBefore.sub(gasBalanceAfter).toString()) / 1e18;
        gridConfig.gasCost += gasCost;
        //  ret.indata.tokenPath.spotEx
        gridConfig.commitTimes++;
        gridConfig.DiffNotional = 0;
        ret.indata.tokenPath.spotCx.SaveStatusConfig();
        let diffPrice = '';
        if (ret.indata.op.includes('建仓')) {
          if (gridConfig.NewLevel > priceDx) {
            diffPrice = '`';
          }
        } else {
          if (gridConfig.NewLevel < priceDx) {
            diffPrice = '`';
          }
        }
        let okdesc = '成交订单';
        if (DiffNotional == 0) {
          okdesc = '刹车订单';
          ret.indata.tokenPath.spotCx.lastCommitOffchainBid = gridConfig.OffchainBid;
          ret.indata.tokenPath.spotCx.lastCommitOffchainAsk = gridConfig.OffchainAsk;
          ret.indata.tokenPath.spotCx.gridConfig.lastOp = null;
          newPrice = ret.indata.poolPathInfo.GetPathPriceBid();
          if (ret.indata.tokenPath.startToken.key == ret.indata.tokenPath.spotCx.market.token1.key) {
            newPrice = 1 / ret.indata.poolPathInfo.GetPathPriceAsk();
          }
        } else {
          ret.indata.tokenPath.spotCx.gridConfig.lastConfirmOkPrice = newPrice;
          lastConfirmOkPriceBid = newPrice;
          lastConfirmOkPriceAsk = newPrice;
          // ret.indata.tokenPath.spotCx.lastCommitOffchainBid = gridConfig.OffchainBid;
          // ret.indata.tokenPath.spotCx.lastCommitOffchainAsk = gridConfig.OffchainAsk;
          // ret.indata.tokenPath.spotCx.lastOp = ret.indata.op;
          ret.indata.tokenPath.spotCx.gridConfig.lastOp1 = ret.indata.op;
        }
        let diffPNLFlag = '';
        if (diffPNL < 0) {
          diffPNLFlag = '`';
        }
        let RealizedPNLFlag = '';
        if (gridConfig.RealizedPNL < 0) {
          RealizedPNLFlag = '`';
        }
        sendBotMessage(
          `${okdesc}${ret.indata.tokenPath.startToken.symbol}-${ret.indata.tokenPath.endToken.symbol}:\n操作:${
            ret.indata.op
          }\n机会:${getChanceTypeDesc(ret.indata.chanceType)}\n区块:${lastBlockNumber - waitingData.blockNumber}(${
            waitingData.blockNumber
          }/${lastBlockNumber}:${ret2.transactionIndex})\n成交量:${
            parseFloat(DiffPosition.toString()) // / ret.indata.tokenPath.startToken.one
          }/${gridConfig.TargetNotional}\n成交价:${newPrice}\n差价比:${diffPrice}${(
            Math.abs(newPrice - priceDx) / newPrice
          ).toFixed(8)}${diffPrice}\n盈亏:${diffPNLFlag}${diffPNL.toFixed(
            8,
          )}${diffPNLFlag}/${RealizedPNLFlag}${gridConfig.RealizedPNL.toFixed(
            8,
          )}${RealizedPNLFlag}\ngasCost:${gasCost}`,
        );
        return true;
      } catch (e) {
        gridConfig.DiffNotional = 0;
        gridConfig.OnOverOffPositivePosition = gridConfig.OnOverOffPositivePositionConfirm;
        gridConfig.OnOverOffNegativePosition = gridConfig.OnOverOffNegativePositionConfirm;
        if (e.reason == 'cancelled') {
          console.log(
            '订单撤销了:ret4:0:',
            ret.indata.tokenPath.startToken.symbol,
            ret.indata.tokenPath.endToken.symbol,
            e.reason,
            waitingData.blockNumber,
            lastBlockNumber,
          );
          sendBotMessage(`订单撤销了,并且刹车失败:0:${commiter.address}`);
        } else if (e.reason == 'replaced' || e.reason == 'repriced') {
          console.log(
            '订单被覆盖了:ret4:',
            ret.indata.tokenPath.startToken.symbol,
            ret.indata.tokenPath.endToken.symbol,
            e.reason,
            waitingData.blockNumber,
            lastBlockNumber,
          );
          sendBotMessage(`订单被覆盖了0:${e.reason},${commiter.address}`);
          // while (first && waitingData.replaceHashs.length > 0) {
          //   let ret1list = waitingData.replaceHashs;
          //   waitingData.replaceHashs = [];
          //   for (let hash of ret1list) {
          //     if ((await ret1WaitFunc(hash, false, 0)) == true) {
          //       return true;
          //     }
          //   }
          // }
        } else if (e.reason == 'insufficient funds for intrinsic transaction cost') {
          sendBotMessage(`gas费不够了,下单失败,请补充:${commiter.address}`);
        } else if (e.reason == 'transaction failed') {
          sendBotMessage(
            `订单报错了:0:\n${commiter.address}\n机会:${getChanceTypeDesc(ret.indata.chanceType)}\n区块:${
              lastBlockNumber - waitingData.blockNumber
            }`,
          );
        } else {
          console.log('订单报错了:2:ret2:', e.reason, e);
          let datastr = e.response;
          let data = JSON.parse(datastr);
          if (data.error.message == 'transaction underpriced') {
            commitWaitingMap.delete(commiter.address);
            console.log('订单报错了:3，出价太低:', feeData.gasPrice.toString());
            feeData = await commitprovider.getFeeData();
          } else if (data.error.message == 'transaction failed') {
            console.log('订单报错了:3:ret2:', data, data.error, data.error.message);
            sendBotMessage(
              `订单报错了:3:\n${commiter.address}\n机会:${getChanceTypeDesc(ret.indata.chanceType)}\n区块:${
                lastBlockNumber - waitingData.blockNumber
              }`,
            );
          }
        }
      }
    };
    await ret1WaitFunc(ret1.hash, true, 1);
  } catch (e) {
    ret.indata.tokenPath.spotCx.gridConfig.DiffNotional = 0;
    ret.indata.tokenPath.spotCx.gridConfig.commitTimes++;

    if (e.reason == 'cancelled') {
      console.log(
        '订单撤销了:ret4:',
        ret.indata.tokenPath.startToken.symbol,
        ret.indata.tokenPath.endToken.symbol,
        e.reason,
        waitingData.blockNumber,
        lastBlockNumber,
      );
      sendBotMessage(`订单撤销了,并且刹车失败:1:${commiter.address}`);
    } else if (e.reason == 'replaced' || e.reason == 'repriced') {
      console.log(
        '订单被覆盖了:ret4:1:',
        ret.indata.tokenPath.startToken.symbol,
        ret.indata.tokenPath.endToken.symbol,
        e.reason,
        waitingData.blockNumber,
        lastBlockNumber,
      );
      sendBotMessage(`订单被覆盖了1:${e.reason},${commiter.address}`);
    } else if (e.reason == 'insufficient funds for intrinsic transaction cost') {
      sendBotMessage(`gas费不够了,下单失败,请补充:${commiter.address}`);
    } else if (e.reason == 'transaction failed') {
      sendBotMessage(
        `订单报错了:1:\n${commiter.address}\n机会:${getChanceTypeDesc(ret.indata.chanceType)}\n区块:${
          lastBlockNumber - waitingData.blockNumber
        }`,
      );
    } else {
      console.log('订单报错了:3:ret2:', e.reason, e);
      sendBotMessage(`订单报错了:3:${e.reason},${e.Error}`);
    }
    ret.indata.tokenPath.spotCx.gridConfig.DiffNotional = 0;
    commitWaitingMap.delete(commiter.address);
  }
  // console.log(desc + ':暂时屏蔽:');
  //测试先只跑一个就停止
  ret.indata.tokenPath.spotCx.gridConfig.DiffNotional = 0;
  commitWaitingMap.delete(commiter.address);
  //如果区块信息还没到,尝试等一个时钟的时间
  for (let [_, spotDx] of SpotDxMap) {
    await spotDx.getBlockConfirmPrice();
  }
  for (let tokenPath of tokenPaths) {
    //这里有可能confirm信息还没有到,所以需要去服务器重新拿数据
    tokenPath.awaitPoolMap.clear();
    await tokenPath.UpdatePoolMap(ret.pathAddr, awaitPoolMap);
    tokenPath.chanceType = 1;
  }
  if (
    ret.indata.tokenPath.spotCx.gridConfig.lastConfirmOkPrice &&
    lastConfirmOkPriceBid == ret.indata.tokenPath.spotCx.gridConfig.lastConfirmOkPrice &&
    lastConfirmOkPriceAsk == ret.indata.tokenPath.spotCx.gridConfig.lastConfirmOkPrice
  ) {
    lastCommitOkTime = Date.now();
    lastCommitOkTimeBid = lastCommitOkTime;
    lastCommitOkTimeAsk = lastCommitOkTime;
  }

  return true;
};
