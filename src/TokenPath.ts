import { WETH9 } from '../typechain/WETH9';
import {
  PoolPathList,
  ExchangeMarket,
  TokenBaseInfo,
  TokenInfoEnum,
  METH_ADDRESS,
  WMATIC_ADDRESS,
  USDC_ADDRESS,
  ARBITRAGE_ADDR,
  TICK_SPACINGS,
  MAX_UINT96,
  MAX_UINT18_ZERO,
  ADDRESS_ZERO,
  GetIdByTokenAddress,
  GetNotioinalByProfitPrice,
  CONTRACT_BALANCER_VAULT_ADDRESS,
} from './constants';
import {
  EncodeParamType,
  PlaceOrderPath,
  PlaceOrderInput,
  PlaceOrderData,
  TryTrendingRet,
  TrendingV3,
  TrendingV2,
  ParamTypePlaceOrderHeader,
  ParamTypePlaceOrderPath,
  ParamTypeTrendingAddress,
  ParamTypeTrendingTokenToAddress,
  ParamTypeTrendingTick,
  ParamTypeTrendingPrice,
  ParamTrendingBalanceFrom,
  ParamTrendingTrendingPoolId,
  encodePlaceOrderInput,
  PlaceOrderPoolSymbolMap,
} from '../src/PlaceOrder';
import { defaultAbiCoderPacked } from '../src/abi/src.ts';

import { CancelPendingTransactoin } from '../src/transactions';
import { sendBotMessage } from '../src/telegram-bot';
import { TrendingCall } from '../typechain/TrendingCall';
import {
  PlaceOrder,
  PoolBaseDataStruct,
  PlaceOrderInputStruct,
  PlaceOrderDataStruct,
  PlaceOrderPathStruct,
  PoolBaseDataStructOutput,
} from '../typechain/PlaceOrder';
import { ExchangeMarkets } from '../HedgeSettings';
import { SpotEx } from './SpotEx';
import { PrintLineLog, exchangeMarketAddressMap, exchangeMarketMap, exchangeMarketPoolIdMap } from './Start';
import { ethers } from 'hardhat';
import { Logger } from 'log4js';
import { BigNumberish, Contract, Wallet, BigNumber, providers } from 'ethers';
import {
  TickMath,
  SqrtPriceMath,
  Position,
  TickListDataProvider,
  Tick as V3Tick,
  Pool as V3SdkPool,
} from '@uniswap/v3-sdk';
import { sqrt, Token as V3SdkToken } from '@uniswap/sdk-core';
import { PoolPairData } from '../src/balancer-labs/src/types';
import { BalancercalcOutGivenIn } from '../src/balancer';
import { scale, bnum, calcOutGivenIn } from '../src/balancer-labs/src/bmath';
import { calculateSpotPrice } from '../src/balancer-v2-monorepo/pvt/helpers/src/models/pools/stable/math';
import { getSpotPrice, getSlippageLinearizedSpotPriceAfterSwap } from '../src/balancer-labs/src/helpers';
import { BigintIsh, JSBI } from '@uniswap/sdk';
import {
  commitWaitingMap,
  GetFeeData,
  lastBlockNumber,
  lastCommitOkTime,
  lastCommitOkTimeBid,
  lastCommitOkTimeAsk,
  lastConfirmOkPriceBid,
  lastConfirmOkPriceAsk,
  instancePlaceOrder,
} from './SpotDx';
import { SpotCx } from './SpotCx';
import { TransactionResponse } from '@ethersproject/providers';

let logger: Logger;
type TokenPair = {
  token0: string;
  token1: string;
  symbol0: string;
  symbol1: string;
  decimals0: number;
  decimals1: number;
};
let tokenMap = new Map<string, TokenPair>();
type Erc20Data = {
  symbol: string;
  decimals: number;
};
let erc20DataMap = new Map<string, Erc20Data>();
export class PoolPriceInfo {
  public pool: ExchangeMarket;
  public tokenFrom: string;
  public tokenTo: string;
  public keyFrom: string;
  public keyTo: string;
  public side: number; //买卖方向
  public pairInfo: TokenPairInfo;
  constructor(pool: ExchangeMarket, pairInfo: TokenPairInfo, side: number) {
    this.pool = pool;
    this.pairInfo = pairInfo;
    this.side = side;
    if (side == 0) {
      this.tokenFrom = pool.token0.address;
      this.tokenTo = pool.token1.address;
      this.keyFrom = pool.token0.key;
      this.keyTo = pool.token1.key;
    } else {
      this.tokenFrom = pool.token1.address;
      this.tokenTo = pool.token0.address;
      this.keyFrom = pool.token1.key;
      this.keyTo = pool.token0.key;
    }
    if (pairInfo) {
      pairInfo.path.poolPriceInfoMap.set(this.tokenFrom + this.tokenTo, this);
      console.log('新增PoolPriceInfo:', this.tokenFrom + this.tokenTo, side, pairInfo.path.poolPriceInfoMap.size);
    }
  }
  public GetPriceAfterAllCost = () => {
    if (!this.pool) {
      return 0;
    }
    if (this.side == 0) {
      return this.pool.token0PriceAfterAllCostBid;
    } else {
      return this.pool.token1PriceAfterAllCostBid;
    }
  };
  public GetPriceAfterAllCostAsk = () => {
    if (!this.pool) {
      return 0;
    }
    if (this.side == 0) {
      return this.pool.token0PriceAfterAllCostAsk;
    } else {
      return this.pool.token1PriceAfterAllCostAsk;
    }
  };
}
export class TokenPairInfo {
  public path: TokenPath; //所属路径
  public pool0Best: ExchangeMarket; //正向价格
  public pool1Best: ExchangeMarket; //反向价格
  // public startToken: TokenBaseInfo; //起始币
  // public endToken: TokenBaseInfo; //结束币
  public rbase0: number;
  public rbase1: number;
  public level: number; //登记
  public key: string; //key
  // public startAddress: string; //起始币
  public pools: Map<string, ExchangeMarket>; //池子地址->ExchangeMarket

  constructor(path: TokenPath) {
    this.path = path;
    // this.startToken = path.startToken;
    // this.endToken = path.endToken;
    this.pools = new Map<string, ExchangeMarket>();
    this.rbase0 = 0;
    this.rbase1 = 0;
  }
  public InitPrice = async (pool: ExchangeMarket) => {
    this.key = pool.key;
    let exchangePriceInfoMap = startEndTokenPriceInfoMap.get(this.path.startToken.address + this.path.endToken.address);
    exchangePriceInfoMap.set(pool.key, this);
    this.pools.set(pool.address, pool);
    await this.UpdatePrice(pool);
  };
  public UpdatePrice = async (pool: ExchangeMarket) => {
    let ret = { diff0: 0, diff1: 0 };
    // if (pool.type == 'BRIDGE') {
    //   return ret;
    // }
    if (!pool.price) {
      console.log('还未初始化,忽略更新:', pool.ex, pool.symbol);
      return ret;
    }
    let priceInfo: PoolPriceInfo;
    let needScan0 = !this.pool0Best || this.pool0Best.token0PriceAfterAllCostBid < pool.token0PriceAfterAllCostBid;
    if (needScan0 || this.pool0Best == pool) {
      let oldBest = this.pool0Best;
      this.pool0Best = pool;
      if (oldBest != pool) {
        console.log(
          'TokenPairInfo最优价格更新:0:',
          this.pool0Best.ex,
          oldBest?.ex,
          this.pool0Best.side,
          pool?.side,
          this.pool0Best.symbol,
          oldBest?.symbol,
          pool.token0.symbol,
          pool.token1.symbol,
          oldBest?.token0PriceAfterAllCostBid,
          this.pool0Best.token0PriceAfterAllCostBid,
        );
      }
      priceInfo = this.path.GetPoolPriceInfoByFromTo(pool.token0.address, pool.token1.address);
      if (!priceInfo) {
        priceInfo = new PoolPriceInfo(pool, this, 0);
      }
      if (
        priceInfo.GetPriceAfterAllCost() < this.pool0Best.token0PriceAfterAllCostBid ||
        (priceInfo.pool == this.pool0Best &&
          priceInfo.GetPriceAfterAllCost() != this.pool0Best.token0PriceAfterAllCostBid)
      ) {
        ret.diff0 =
          (this.pool0Best.token0PriceAfterAllCostBid - priceInfo.GetPriceAfterAllCost()) /
          this.pool0Best.token0PriceAfterAllCostBid;
        console.log(
          'PoolPriceInfo最优价格更新:0:',
          this.pool0Best.ex,
          priceInfo.pool?.ex,
          this.pool0Best.side,
          pool?.side,
          ret.diff0,
          this.pool0Best.address,
          priceInfo.pool?.address,
          pool.token0.symbol,
          pool.token1.symbol,
          priceInfo.GetPriceAfterAllCost(),
          priceInfo.pool?.token0PriceAfterAllCostBid,
          this.pool0Best.token0PriceAfterAllCostBid,
        );
        priceInfo.pool = this.pool0Best;
      }
    }
    let needScan1 = !this.pool1Best || this.pool1Best.token1PriceAfterAllCostBid < pool.token1PriceAfterAllCostBid;
    if (needScan1 || this.pool1Best == pool) {
      let oldBest = this.pool1Best;
      this.pool1Best = pool;
      if (oldBest != pool) {
        console.log(
          'TokenPairInfo最优价格更新:1:',
          this.pool1Best.ex,
          oldBest?.ex,
          this.pool1Best.side,
          pool?.side,
          this.pool1Best.symbol,
          oldBest?.symbol,
          pool.token0.symbol,
          pool.token1.symbol,
          oldBest?.token1PriceAfterAllCostBid,
          this.pool1Best.token1PriceAfterAllCostBid,
        );
      }
      priceInfo = this.path.GetPoolPriceInfoByFromTo(pool.token1.address, pool.token0.address);
      if (!priceInfo) {
        priceInfo = new PoolPriceInfo(pool, this, 1);
      }
      if (
        priceInfo.GetPriceAfterAllCost() < this.pool1Best.token1PriceAfterAllCostBid ||
        (priceInfo.pool == this.pool1Best &&
          priceInfo.GetPriceAfterAllCost() != this.pool1Best.token1PriceAfterAllCostBid)
      ) {
        ret.diff1 =
          (this.pool1Best.token1PriceAfterAllCostBid - priceInfo.GetPriceAfterAllCost()) /
          this.pool1Best.token1PriceAfterAllCostBid;
        console.log(
          'PoolPriceInfo最优价格更新:1:',
          this.pool1Best.ex,
          priceInfo.pool?.ex,
          this.pool1Best.side,
          pool?.side,
          ret.diff1,
          this.pool1Best.address,
          priceInfo.pool?.address,
          pool.token0.symbol,
          pool.token1.symbol,
          priceInfo.GetPriceAfterAllCost(),
          priceInfo.pool?.token1PriceAfterAllCostBid,
          this.pool1Best.token1PriceAfterAllCostBid,
        );
        priceInfo.pool = this.pool1Best;
      }
    }
    // let totalToken0PriceX96AfterCommissionAndSlippage = BigNumber.from(0);
    // for (let [addr, pool] of this.pools) {
    //   totalToken0PriceX96AfterCommissionAndSlippage = totalToken0PriceX96AfterCommissionAndSlippage.add(
    //     pool.token0PriceX96AfterCommissionAndSlippage
    //   );
    // }
    if (this.pool0Best && this.pool1Best) {
      let profitRate = this.pool0Best.token0PriceAfterAllCostBid * this.pool1Best.token1PriceAfterAllCostBid;
      if (profitRate > 1) {
        console.log(
          '价格优势交易对:',
          profitRate > 10, //太大说明是计算问题
          pool.token0.symbol,
          pool.token1.symbol,
          profitRate,
          this.pool0Best.token0PriceAfterAllCostBid,
          this.pool1Best.token1PriceAfterAllCostBid,
          this.pool0Best.ex,
          this.pool1Best.ex,
          this.pool0Best.address,
          this.pool1Best.address,
        );
      }
    }
    return ret;
  };
}

type TokenInfoProfitRet = {
  poolPathInfo: PoolPathInfo;
  profitPrice: number;
};
let feePoolMap = new Map<string, any>();
let addrMap = new Map();
export class PoolPathInfo {
  public pathId: number; //路径编号
  public path: TokenPath; //所属路径
  public profitRet: TokenInfoProfitRet; //最优路径结果保存下来
  public pathDesc: string; //交易路径记录下
  public poolBaseDataPath: PoolBaseDataStruct[]; //配置指定路径
  public poolPriceInfoPath: PoolPriceInfo[]; //配置指定路径
  constructor(path: TokenPath) {
    this.path = path;
    this.poolBaseDataPath = []; //配置指定路径
    this.poolPriceInfoPath = [];
  }

  public GetPathToTokenPriceBid = (tokenTo: TokenBaseInfo) => {
    if (this.poolPriceInfoPath.length == 0) {
      return 1;
    }
    let price = 1;
    for (let v of this.poolPriceInfoPath) {
      price = price * v.GetPriceAfterAllCost();
      if (v.tokenTo == tokenTo.address) {
        return price;
      }
    }
    //不应该走到这里
    console.log('路径里找不到目标token,有问题:GetPathToTokenPriceBid:', tokenTo.address);
    return 1;
  };
  public GetPathPriceBid = () => {
    return this.GetBestPriceFromLayer0();
  };
  // public GetPathPriceAsk = () => {
  //   let priceDxAsk = 1;
  //   for (let v of this.poolPriceInfoPath) {
  //     priceDxAsk = priceDxAsk * v.GetPriceAfterAllCostAsk();
  //   }
  //   return priceDxAsk;
  // };

  public GetOnchainOverOffchainSpread = () => {
    let priceDxBid = this.GetPathPriceBid();
    let priceCxAsk = this.path.spotCx.GetAskPriceAfterAllCostBySide(this.path.exSide);
    let profitPrice = priceDxBid / priceCxAsk;
    return { profitPrice, priceDxBid, priceCxAsk };
  };
  public GetPathPriceAsk = () => {
    let price = 1;
    for (let v of this.poolPriceInfoPath) {
      price = price * v.GetPriceAfterAllCostAsk();
    }
    return price;
  };
  public GetOffchainOverOnchainSpread = () => {
    let priceDxAsk = 0;
    for (let tokenPath of this.path.spotCx.tokenPaths) {
      if (tokenPath != this.path && tokenPath.spotCx == this.path.spotCx) {
        //说明还没初始化好
        if (!tokenPath.poolPathBest) {
          return { profitPrice: 0, priceDxAsk: 0, priceCxBid: 0 };
        }
        priceDxAsk = 1 / tokenPath.poolPathBest.tokenInfo.GetPathPriceBid();
        break;
      }
    }
    let priceCxBid = this.path.spotCx.GetPriceAfterAllCostBySide(this.path.exSide);
    let profitPrice = priceCxBid / priceDxAsk;
    return { profitPrice, priceDxAsk, priceCxBid };
  };
  public GetProfitPrice = () => {
    let priceDx = this.GetPathPriceBid();
    // let profitPrice = 1 + (priceDx - this.path.spotEx.GetAskPriceAfterAllCostBySide(this.path.exSide)) / priceDx;
    // let profitPrice = priceDx / this.path.spotEx.GetAskPriceAfterAllCostBySide(this.path.exSide);
    this.pathDesc = `${this.path.startToken.symbol}:${this.path.endToken.symbol}`;
    for (let pool of this.poolPriceInfoPath) {
      this.pathDesc = `${this.pathDesc}-${pool.pool.symbol}:${pool.pool.address}:${
        pool.side
      }:${pool.GetPriceAfterAllCost()}`;
    }
    console.log(
      'xxxxxx:GetProfitPrice:',
      this.path.startToken.symbol,
      this.path.endToken.symbol,
      // profitPrice,
      priceDx,
      this.path.spotCx.GetPriceAfterAllCostBySide(this.path.exSide),
      this.path.spotCx.GetAskPriceAfterAllCostBySide(this.path.exSide),
      this.poolPriceInfoPath.length,
      this.pathDesc,
    );
    return priceDx;
  };
  public GetBestPriceFromLayer0 = () => {
    let price = 1;
    for (let v of this.poolPriceInfoPath) {
      price = price * v.GetPriceAfterAllCost();
    }
    return price;
  };
  public GetBestPath = (desc: string) => {
    //  &&    this.bestPathFromLayer0[this.bestPathFromLayer0.length - 1].pairInfo.key != this.bestPathToLayer0[0].pairInfo.key
    let profitPrice = this.GetProfitPrice();
    let ret = this.getPoolPath();
    ret.profitPrice = profitPrice;
    if (profitPrice > 1) {
      logger.debug(
        '发现机会:',
        desc,
        this.path.startToken.symbol,
        this.path.endToken.symbol,
        ret.path.length,
        profitPrice,
        this.GetBestPriceFromLayer0(),
        ret.desc,
        'xxx',
        ...this.getTokenPath(),
      );
    }
    return ret;
  };
  public getPoolPath = (): PoolPathList => {
    let ret: PoolPathList = {
      desc: '',
      path: [],
      tokenPath: this.path,
      tokenInfo: this,
      createAt: Date.now(),
      pathId: this.pathId,
    };
    let fromToken = this.path.startToken.address;
    for (let pool of this.poolPriceInfoPath) {
      let key = pool.pool.address + ':' + pool.pool.token0.address + ':' + pool.pool.token1.address;
      if (pool.pool.token0.address == fromToken) {
        if (pool.pool.type != 'BRIDGE') {
          ret.desc = ret.desc + pool.pool.ex + '-0-' + key + ',';
          ret.path.push({
            pool: pool.pool,
            side: 0,
            ex: pool.pool.ex,
            dxType: pool.pool.dxType,
            address: pool.pool.address,
            tokenFrom: pool.pool.token0,
            tokenTo: pool.pool.token1,
          });
        }
        fromToken = pool.pool.token1.address;
      } else if (pool.pool.token1.address == fromToken) {
        if (pool.pool.type != 'BRIDGE') {
          ret.desc = ret.desc + pool.pool.ex + '-1-' + key + ',';
          ret.path.push({
            pool: pool.pool,
            side: 1,
            ex: pool.pool.ex,
            dxType: pool.pool.dxType,
            address: pool.pool.address,
            tokenFrom: pool.pool.token1,
            tokenTo: pool.pool.token0,
          });
        }
        fromToken = pool.pool.token0.address;
      } else {
        console.log(
          '路径错误:0:',
          pool.pool.address,
          pool.tokenFrom,
          pool.tokenTo,
          fromToken,
          pool.pool.token0.address,
          pool.pool.token1.address,
          ret.desc,
          'end',
        );
        return ret;
      }
    }
    ret.desc = ret.desc.substring(0, ret.desc.length - 1);
    return ret;
  };
  public getTokenPath = () => {
    let tokens = [this.path.startToken.address];
    for (let pool of this.poolPriceInfoPath) {
      let price = pool.GetPriceAfterAllCost();
      tokens.push(`${pool.tokenTo}:${price}:${1 / price}`);
    }
    return tokens;
  };
}

type TokenInfoProfitPrice = {
  poolPathInfo: PoolPathInfo;
  profitPrice: number;
};
type TokenPairInfoMap = Map<string, TokenPairInfo>;
export let startEndTokenPriceInfoMap: Map<string, TokenPairInfoMap> = new Map<string, TokenPairInfoMap>(); //

export class TokenPath {
  public gasBase: BigNumber; //bnb对起始币的价格
  public minProfit: BigNumber; //最小期望利润
  public minVolume: number; //最小下单量
  public maxVolume: BigNumber; //最大下单量
  public minVolumeBig: BigNumber; //最小下单量
  public startToken: TokenBaseInfo; //起始币
  public endToken: TokenBaseInfo; //结束币
  public waitCommitMap: Map<string, TryTrendingRet>; //
  public waitCommitPoolMap: Map<string, any>; //
  public MongoPoolMap: Map<string, ExchangeMarket>;
  public waitProfitList: TryTrendingRet[]; //把盈利但是亏gas费的路径存下来看能不能组合一个长路径
  public blockNumber: number;
  public lastLoopPrice: number;
  public loopFlag: boolean;
  public chanceType: number; //0表示链下,1表示链上,2表示pending,3表示mined
  public startTokenBalance: BigNumber; //
  public startTokenInstance: WETH9; //
  public endTokenBalance: BigNumber; //
  public endTokenInstance: WETH9; //
  public startTokenAddress: string; //起始币
  public endTokenAddress: string; //结束币
  public poolPriceInfoMap: Map<string, PoolPriceInfo>;
  public waitUpdatePoolMap: Map<string, number>; //等等刷新的池子
  public awaitPoolMap: Map<string, any>; //链上数据缓存
  public awaitPoolMapTmp: Map<string, any>; //链上数据缓存
  public exchangePriceInfoMap: TokenPairInfoMap;
  public spotCx: SpotCx;
  public position: number; //当前头寸
  public owner: Wallet;
  public exSide: number;
  public abiInstancePool: Contract; //
  public uniSwapQuoterV3: Contract; //
  public balancerVault: Contract; //
  // public instanceERC721: Contract; //
  public slot0: any; //记录最后一次成交价格
  public instanceTrendingCall: TrendingCall;
  public erc20ContractFactory: any;
  public erc20Instance: WETH9;
  public poolPathBest: PoolPathList; //保存一个最佳路径,随时等待机会使用
  public poolPathBest2: PoolPathList; //备用路径
  public lastBotMessageBlockNumber: number; //控制机器人提醒
  public poolPathInfos: PoolPathInfo[]; //配置指定路径
  public poolPathInfosTokenMap: Map<string, PoolPathInfo>;
  public poolPathInfosPoolIdMap: Map<BigNumberish, PoolPathInfo>;
  constructor(
    startToken: TokenBaseInfo,
    endToken: TokenBaseInfo,
    waitCommitMap: Map<string, TryTrendingRet>,
    waitCommitPoolMap: any,
    MongoPoolMap: Map<string, ExchangeMarket>,
  ) {
    this.poolPathInfosTokenMap = new Map<string, PoolPathInfo>();
    this.poolPathInfosPoolIdMap = new Map<BigNumberish, PoolPathInfo>();
    this.lastBotMessageBlockNumber = 0;
    this.chanceType = 0;
    this.lastLoopPrice = 0;
    this.loopFlag = false;
    this.waitCommitMap = waitCommitMap;
    this.waitCommitPoolMap = waitCommitPoolMap;
    this.MongoPoolMap = MongoPoolMap;
    this.waitProfitList = [];
    this.waitUpdatePoolMap = new Map<string, number>(); //等等刷新的池子
    this.awaitPoolMap = new Map<string, any>();
    this.awaitPoolMapTmp = new Map<string, any>();
    this.poolPriceInfoMap = new Map<string, PoolPriceInfo>();
    this.startToken = startToken;
    this.endToken = endToken;
    this.startTokenAddress = this.startToken.address; //
    this.endTokenAddress = this.endToken.address; //起始币
  }

  public GetPoolPriceInfoByFromTo = (tokenFrom: string, tokenTo: string) => {
    return this.poolPriceInfoMap.get(tokenFrom + tokenTo);
  };
  public GetPathToTokenPriceBid = (poolId: number, tokenTo: TokenBaseInfo) => {
    let poolPathInfo = this.poolPathInfosPoolIdMap.get(poolId);
    return poolPathInfo.GetPathToTokenPriceBid(tokenTo);
  };
  public Start = async (
    _logger: Logger,
    poolPaths: string[][],
    _abiInstancePool: Contract,
    _uniSwapQuoterV3: Contract,
    _balancerVault: Contract,
    _instanceERC721: Contract,
    _instanceTrendingCall: TrendingCall,
    _cxspotEx: SpotCx,
    _cxSide: number,
    _owner: Wallet,
  ) => {
    logger = _logger;
    // await InitAllCollections(arbdb);
    // await ScanV2Factories(arbdb, uniSwapV2Factory, abiInstance);
    this.owner = _owner;
    this.spotCx = _cxspotEx;
    this.exSide = _cxSide;
    this.abiInstancePool = _abiInstancePool;
    this.uniSwapQuoterV3 = _uniSwapQuoterV3;
    this.balancerVault = _balancerVault;
    // this.instanceERC721 = _instanceERC721;
    this.instanceTrendingCall = _instanceTrendingCall;
    this.erc20ContractFactory = await ethers.getContractFactory('WETH9');
    this.erc20Instance = this.erc20ContractFactory.connect(this.owner).attach(WMATIC_ADDRESS) as WETH9;

    if (this.startTokenAddress == WMATIC_ADDRESS) {
      this.minVolume = 5;
      this.maxVolume = BigNumber.from(10).pow(this.startToken.decimals).mul(1000000);
      this.minProfit = BigNumber.from(10).pow(this.startToken.decimals - 2); //0.02bnb
      this.gasBase = BigNumber.from(1e6);
    } else if (this.startTokenAddress == METH_ADDRESS) {
      this.minVolume = 0.004;
      this.maxVolume = BigNumber.from(10).pow(this.startToken.decimals).mul(200);
      this.minProfit = BigNumber.from(10).pow(this.startToken.decimals - 2); //0.02bnb
      this.gasBase = BigNumber.from(500);
    } else {
      this.minVolume = 10;
      this.maxVolume = BigNumber.from(10).pow(this.startToken.decimals).mul(1000000);
      this.minProfit = BigNumber.from(10).pow(this.startToken.decimals - 2); //10U
      this.gasBase = BigNumber.from(2.3 * 1e6);
    }
    this.minVolumeBig = BigNumber.from('0x' + (this.minVolume * this.startToken.one).toString(16));
    this.gasBase = this.gasBase.mul(this.startToken.oneBig); // / 1e18; //换算为起始币精度,1e18现在不能除得等用的时候,不然会小数
    console.log('初始化token数量:', ExchangeMarkets.length);
    this.exchangePriceInfoMap = new Map<string, TokenPairInfo>(); //
    startEndTokenPriceInfoMap.set(this.startToken.address + this.endToken.address, this.exchangePriceInfoMap);
    this.exchangePriceInfoMap.clear();
    this.poolPathInfos = [];
    let pathId = 0;
    for (let poolPath of poolPaths) {
      let poolBaseDataPath: PoolBaseDataStruct[] = [];
      for (let symbol of poolPath) {
        let poolBaseData = PlaceOrderPoolSymbolMap.get(symbol);
        if (!poolBaseData) {
          console.log('路径配置不正确,启动失败:', symbol, poolBaseData);
          sendBotMessage('路径配置不正确,启动失败');
        }
        poolBaseDataPath.push(poolBaseData);
      }
      //检查路径方向
      if (
        poolBaseDataPath[0].token0 != this.startToken.address &&
        poolBaseDataPath[0].token1 != this.startToken.address
      ) {
        poolBaseDataPath = poolBaseDataPath.reverse();
      }
      let poolPriceInfoPath = new PoolPathInfo(this);
      poolPriceInfoPath.pathId = pathId;
      pathId++;
      for (let poolBaseData of poolBaseDataPath) {
        poolPriceInfoPath.poolBaseDataPath.push(poolBaseData);
      }
      this.poolPathInfos.push(poolPriceInfoPath);
    }
    for (let poolPathInfo of this.poolPathInfos) {
      let poolBaseDataPath = poolPathInfo.poolBaseDataPath;
      let fromToken = this.startToken.address;
      for (let poolBaseData of poolBaseDataPath) {
        let side = 0;
        if (fromToken == poolBaseData.token0) {
          side = 0;
          fromToken = poolBaseData.token1;
        } else if (fromToken == poolBaseData.token1) {
          side = 1;
          fromToken = poolBaseData.token0;
        } else {
          console.log('严重数据配置错误:0:', fromToken, poolBaseData);
        }
        if (exchangeMarketPoolIdMap.has(poolBaseData.poolId)) {
          let exchangePriceInfoMap = startEndTokenPriceInfoMap.get(this.startToken.address + this.endToken.address);
          let market = exchangeMarketAddressMap.get(poolBaseData.addr);
          // let tokenPairInfo = exchangePriceInfoMap.get(market.key);
          // if (!tokenPairInfo) {
          //   tokenPairInfo = new TokenPairInfo(this);
          //   let priceInfo = this.GetPoolPriceInfoByFromTo(poolBaseData.token0, poolBaseData.token1);
          //   if (!priceInfo) {
          //     priceInfo = new PoolPriceInfo(market, tokenPairInfo, 0);
          //   }
          //   priceInfo = this.GetPoolPriceInfoByFromTo(poolBaseData.token1, poolBaseData.token0);
          //   if (!priceInfo) {
          //     priceInfo = new PoolPriceInfo(market, tokenPairInfo, 1);
          //   }
          // }
          let priceInfo = this.GetPoolPriceInfoByFromTo(poolBaseData.token0, poolBaseData.token1);
          if (!priceInfo) {
            priceInfo = new PoolPriceInfo(market, null, 0);
            this.poolPriceInfoMap.set(poolBaseData.token0 + poolBaseData.token1, priceInfo);
            priceInfo.pool = market;
          }
          priceInfo = this.GetPoolPriceInfoByFromTo(poolBaseData.token1, poolBaseData.token0);
          if (!priceInfo) {
            priceInfo = new PoolPriceInfo(market, null, 1);
            this.poolPriceInfoMap.set(poolBaseData.token1 + poolBaseData.token0, priceInfo);
            priceInfo.pool = market;
          }
        }
      }
    }
    for (let poolPathInfo of this.poolPathInfos) {
      let poolBaseDataPath = poolPathInfo.poolBaseDataPath;
      let fromToken = this.startToken.address;
      for (let poolBaseData of poolBaseDataPath) {
        if (!this.poolPathInfosTokenMap.has(poolBaseData.token0)) {
          this.poolPathInfosTokenMap.set(poolBaseData.token0, poolPathInfo);
        }
        if (!this.poolPathInfosTokenMap.has(poolBaseData.token1)) {
          this.poolPathInfosTokenMap.set(poolBaseData.token1, poolPathInfo);
        }
        if (!this.poolPathInfosPoolIdMap.has(poolBaseData.poolId)) {
          this.poolPathInfosPoolIdMap.set(poolBaseData.poolId, poolPathInfo);
        }

        let side = 0;
        if (fromToken == poolBaseData.token0) {
          side = 0;
          fromToken = poolBaseData.token1;
        } else if (fromToken == poolBaseData.token1) {
          side = 1;
          fromToken = poolBaseData.token0;
        } else {
          console.log('严重数据配置错误:1:', fromToken, poolBaseData);
        }
        // let priceInfo =
        //   side == 0
        //     ? this.GetPoolPriceInfoByFromTo(poolBaseData.token0, poolBaseData.token1)
        //     : this.GetPoolPriceInfoByFromTo(poolBaseData.token1, poolBaseData.token0);
        let priceInfo: PoolPriceInfo;
        let market = exchangeMarketAddressMap.get(poolBaseData.addr);
        if (side == 0) {
          priceInfo = new PoolPriceInfo(market, null, 0);
          // this.poolPriceInfoMap.set(poolBaseData.token0 + poolBaseData.token1, priceInfo);
          priceInfo.pool = market;
        } else {
          priceInfo = new PoolPriceInfo(market, null, 1);
          // this.poolPriceInfoMap.set(poolBaseData.token1 + poolBaseData.token0, priceInfo);
          priceInfo.pool = market;
        }
        poolPathInfo.poolPriceInfoPath.push(priceInfo);
      }
    }

    await this.InitTokenPairInfos();
  };
  public InitTokenPairInfos = async () => {
    let exchangePriceInfoMap = startEndTokenPriceInfoMap.get(this.startToken.address + this.endToken.address);
    //先处理带weth的V2
    for (let v of ExchangeMarkets) {
      if (v.type == 'DX') {
        let tokenPairInfo = exchangePriceInfoMap.get(v.key);
        if (!tokenPairInfo) {
          tokenPairInfo = new TokenPairInfo(this);
          console.log('初始化tokenPairInfo:', v.symbol, v.key);
        }
        await tokenPairInfo.InitPrice(v);
      } else {
        console.log('忽略初始化tokenPairInfo:', v.symbol, v.key);
      }
    }
    console.log('初始化tokenpairs数量:', ExchangeMarkets.length, exchangePriceInfoMap.size);
  };
  public UpdatePosition = (poolPathBest: PoolPathList) => {
    poolPathBest = poolPathBest || this.poolPathBest;
    //先只计算价格最好的第一个,然后直接break
    //一个方向维护,另外一个方向用就可以,不用也不能再维护
    if (this.startToken.key == this.spotCx.market.token0.key) {
      let gridConfig = poolPathBest.tokenPath.spotCx.gridConfig;
      let latticeTable = this.spotCx.gridConfig.latticeTable;
      let OnchainOverOffchainSpread = poolPathBest.tokenInfo.GetOnchainOverOffchainSpread().profitPrice - 1;
      let OffchainOverOnchainSpread = poolPathBest.tokenInfo.GetOffchainOverOnchainSpread().profitPrice - 1;
      // OnchainOverOffchainSpread = OnchainOverOffchainSpread * this.spotCx.thresholdBase;
      // OffchainOverOnchainSpread = OffchainOverOnchainSpread * this.spotCx.thresholdBase;
      gridConfig.OnOverOffPositivePosition = gridConfig.OnOverOffPositivePositionConfirm;
      gridConfig.OnOverOffNegativePosition = gridConfig.OnOverOffNegativePositionConfirm;
      let AddPositionRange_OnOverOff = GetNotioinalByProfitPrice(OnchainOverOffchainSpread, latticeTable).PositionBuild;
      let ReducePositionRange_OnOverOff = GetNotioinalByProfitPrice(
        -OffchainOverOnchainSpread,
        latticeTable,
      ).PositionReduce;
      let AddPositionRange_OffOverOn = GetNotioinalByProfitPrice(OffchainOverOnchainSpread, latticeTable).PositionBuild;
      let ReducePositionRange_OffOverOn = GetNotioinalByProfitPrice(
        -OnchainOverOffchainSpread,
        latticeTable,
      ).PositionReduce;

      if (AddPositionRange_OffOverOn > poolPathBest.tokenPath.spotCx.gridConfig.OnOverOffPositivePosition) {
        poolPathBest.tokenPath.spotCx.gridConfig.OnOverOffPositivePosition = AddPositionRange_OffOverOn;
      } else if (ReducePositionRange_OffOverOn < poolPathBest.tokenPath.spotCx.gridConfig.OnOverOffPositivePosition) {
        poolPathBest.tokenPath.spotCx.gridConfig.OnOverOffPositivePosition = ReducePositionRange_OffOverOn;
      }
      if (AddPositionRange_OnOverOff > poolPathBest.tokenPath.spotCx.gridConfig.OnOverOffNegativePosition) {
        poolPathBest.tokenPath.spotCx.gridConfig.OnOverOffNegativePosition = AddPositionRange_OnOverOff;
      } else if (ReducePositionRange_OnOverOff < poolPathBest.tokenPath.spotCx.gridConfig.OnOverOffNegativePosition) {
        poolPathBest.tokenPath.spotCx.gridConfig.OnOverOffNegativePosition = ReducePositionRange_OnOverOff;
      }
      poolPathBest.tokenPath.spotCx.gridConfig.OnchainOverOffchainSpread = OnchainOverOffchainSpread;
      poolPathBest.tokenPath.spotCx.gridConfig.OffchainOverOnchainSpread = OffchainOverOnchainSpread;
      poolPathBest.tokenPath.spotCx.gridConfig.OnchainBid = poolPathBest.tokenInfo.GetPathPriceBid();
      poolPathBest.tokenPath.spotCx.gridConfig.OnchainAsk = poolPathBest.tokenInfo.GetPathPriceAsk();
      poolPathBest.tokenPath.spotCx.gridConfig.OffchainBid = poolPathBest.tokenPath.spotCx.GetPriceAfterAllCostBySide(
        poolPathBest.tokenPath.exSide,
      );
      poolPathBest.tokenPath.spotCx.gridConfig.OffchainAsk =
        poolPathBest.tokenPath.spotCx.GetAskPriceAfterAllCostBySide(poolPathBest.tokenPath.exSide);
      console.log(
        `算法调试日志,AddPositionRange_OnOverOff:${AddPositionRange_OnOverOff},ReducePositionRange_OnOverOff:${ReducePositionRange_OnOverOff},AddPositionRange_OffOverOn:${AddPositionRange_OffOverOn},ReducePositionRange_OffOverOn:${ReducePositionRange_OffOverOn},${JSON.stringify(
          poolPathBest.tokenPath.spotCx.gridConfig,
        )}`,
      );
      // } else {
      //   if (notional.PositionBuild > pathProfit.tokenPath.spotEx.gridConfig.OnOverOffNegativePosition) {
      //     pathProfit.tokenPath.spotEx.gridConfig.OnOverOffNegativePosition = notional.PositionBuild;
      //   } else if (notional.PositionReduce < pathProfit.tokenPath.spotEx.gridConfig.OnOverOffNegativePosition) {
      //     pathProfit.tokenPath.spotEx.gridConfig.OnOverOffNegativePosition = notional.PositionReduce;
      //   }
    }
    //   break;
    // }
  };

  public SetLoopFlag = (loopFlag: boolean) => {
    //如果变化达到千分之一就尝试计算
    if (Math.abs(this.lastLoopPrice - this.spotCx.market.price) / this.spotCx.market.price > 0.0001) {
      this.lastLoopPrice = this.spotCx.market.price;
      this.loopFlag = true;
    }
  };
  public Loop = async (desc: string, blockNumber: number) => {
    this.blockNumber = blockNumber;
    this.waitProfitList = [];
    //如果这个方向的余额已经不够了,就不要再循环了
    // let pathProfits = await this.UpdatePoolPrice(desc, blockNumber);
    if (this.loopFlag) {
      await this.UpdatePoolPrice(desc, blockNumber);
      if (this.startToken.key == this.spotCx.market.token0.key) {
        for (let tokenPath of this.spotCx.tokenPaths) {
          if (tokenPath != this && tokenPath.spotCx == this.spotCx) {
            await tokenPath.UpdatePoolPrice(desc, blockNumber);
            break;
          }
        }
      }
      // }
      for (let poolPathInfo of this.poolPathInfos) {
        poolPathInfo.profitRet = { poolPathInfo: poolPathInfo, profitPrice: 0 };
        poolPathInfo.profitRet.profitPrice = poolPathInfo.GetProfitPrice();
      }
      //降序排序得b-a
      this.poolPathInfos = this.poolPathInfos.sort((a: PoolPathInfo, b: PoolPathInfo) => {
        return b.profitRet.profitPrice - a.profitRet.profitPrice;
      });
      this.poolPathBest = this.poolPathInfos[0].GetBestPath('loop');
      this.poolPathBest2 = null;
      if (this.poolPathInfos[0]) {
        this.poolPathBest2 = this.poolPathInfos[0].GetBestPath('loop');
      }
      this.loopFlag = false;
      //暂停也只是暂停下单,不暂停数据加工,因为其他地方还要用
      // if (this.spotCx.gridConfig.pause == true) {
      //   return;
      // }
      // this.UpdatePosition(null);
      if (!this.spotCx.gridConfig.pause) {
        if (!this.spotCx.gridConfig.pauseEndTime) {
          this.UpdatePosition(null);
        } else {
          if (this.spotCx.gridConfig.pauseEndTime < Date.now()) {
            this.spotCx.gridConfig.pauseEndTime = null;
          }
        }
      }
      //暂时测试跟单策略,不做交易
      await this.tryPaths(null, false);
    }
  };

  public trace(message: any, ...args: any[]): void {
    logger.trace(message, ...args);
  }
  public debug(message: any, ...args: any[]): void {
    logger.debug(message, ...args);
  }
  public info(message: any, ...args: any[]): void {
    logger.info(message, ...args);
  }
  public warn(message: any, ...args: any[]): void {
    logger.warn(message, ...args);
  }
  public error(message: any, ...args: any[]): void {
    logger.error(message, ...args);
  }
  public fatal(message: any, ...args: any[]): void {
    logger.fatal(message, ...args);
  }
  public log(message: any, ...args: any[]): void {
    console.log(`${this.startToken.symbol}:${this.endToken.symbol}`, message, ...args);
  }

  public tryPaths = async (
    pathProfit: PoolPathList,
    onlyOneNotional: boolean,
    gasLimit: BigNumber = null,
    noSimulate: boolean = false,
  ) => {
    pathProfit = pathProfit || this.poolPathBest;
    console.log(`paths自主扫描进度开始:${this.startToken.symbol}-${this.endToken.symbol},${pathProfit?.path.length}`);
    if (!pathProfit) {
      return false;
    }

    let priceCx = pathProfit.tokenPath.spotCx.GetAskPriceAfterAllCostBySide(pathProfit.tokenPath.exSide);
    // let spotDiff = priceCx - pathProfit.tokenPath.spotEx.gridConfig.lastCommitCxPrice;
    // if (spotDiff / priceCx < 0.0001) {
    //   console.log(
    //     `paths自主扫描进度结束:${pathProfits.length - num},网格价差太小:${priceCx},${
    //       pathProfit.tokenPath.spotEx.gridConfig.lastCommitCxPrice
    //     },${spotDiff / priceCx}`,
    //   );
    //   continue;
    // }
    let pathstr = '';
    for (let v of pathProfit.path) {
      pathstr = pathstr + v.address;
    }
    let arb: PlaceOrderInput = {
      header: { dxType: 0, volume: BigNumber.from(0), orderLen: 0, pathLen: 0, RKKgas: BigNumber.from(0) },
      orders: [],
      path: [],
      pathId: pathProfit.pathId,
      tokenPath: pathProfit.tokenPath,
      poolPathInfo: pathProfit.tokenInfo,
      priceCx: priceCx,
      chanceType: 0,
    };
    let lathpath: any; //PlaceOrderPath
    for (let tmppath of pathProfit.path) {
      let dxType = tmppath.dxType;
      let side = tmppath.side;
      let address = tmppath.address;
      // let tmpPair = await getNextToken(address, dxType);
      // console.log('xxx:', num++);
      //此处有猫腻,没毛病
      if (lathpath) {
        lathpath.dxType = dxType;
        lathpath = {
          dxType: 0,
        };
      } else {
        arb.header.dxType = dxType;
        lathpath = {
          dxType: 0,
        };
      }
      if (address.includes(':')) {
        let tmp = address.split(':');
        address = tmp[0];
        lathpath.token0 = tmp[1];
        lathpath.token1 = tmp[2];
      } else {
        if (side == 0) {
          lathpath.token0 = tmppath.tokenFrom.address;
          lathpath.token1 = tmppath.tokenTo.address;
        } else {
          lathpath.token0 = tmppath.tokenTo.address;
          lathpath.token1 = tmppath.tokenFrom.address;
        }
      }
      lathpath.side = side;
      lathpath.pool = tmppath.pool;
      lathpath.address = address;
      arb.path.push(lathpath);
    }
    let priceDx = pathProfit.tokenInfo.GetPathPriceBid();
    let op = '无操作';
    let volume = BigNumber.from(0);
    let gridConfig = this.spotCx.gridConfig;
    let TargetNotional = gridConfig.OnOverOffPositivePosition - gridConfig.OnOverOffNegativePosition;
    let DiffNotional = TargetNotional - gridConfig.TargetNotional;
    let DiffPosition = 0;
    //下单前做一次数据矫正
    if (DiffNotional != 0) {
      for (let tokenPath of this.spotCx.tokenPaths) {
        if (tokenPath.spotCx.isStartToken(tokenPath.startToken.key)) {
          let ret = await tokenPath.spotCx.CheckResetTargetNotional(tokenPath);
          break;
        }
      }
    } else if (this.spotCx.botDNotional) {
      if (this.spotCx.botDNotional > 0) {
        DiffNotional = this.spotCx.botDNotional;
        if (this.startToken.key == this.spotCx.market.token1.key) {
          DiffPosition = this.startToken.one * (TargetNotional * this.spotCx.gridConfig.UnitNotional);
        }
      } else if (this.spotCx.botDNotional < 0) {
        if (this.startToken.key == this.spotCx.market.token0.key) {
          DiffNotional = this.spotCx.botDNotional;
          DiffPosition =
            (this.startToken.one * (-DiffNotional * this.spotCx.gridConfig.UnitNotional) * priceDx) / priceCx;
        }
      }
    }
    DiffNotional = TargetNotional - gridConfig.TargetNotional;
    if (onlyOneNotional) {
      while (Math.abs(DiffNotional) > 1) {
        if (DiffNotional > 1) {
          if (gridConfig.OnOverOffPositivePosition > gridConfig.OnOverOffPositivePositionConfirm) {
            gridConfig.OnOverOffPositivePosition -= 1;
          } else {
            gridConfig.OnOverOffNegativePosition += 1;
          }
        } else if (DiffNotional < -1) {
          if (gridConfig.OnOverOffPositivePosition > gridConfig.OnOverOffPositivePositionConfirm) {
            gridConfig.OnOverOffPositivePosition += 1;
          } else {
            gridConfig.OnOverOffNegativePosition -= 1;
          }
        }
        TargetNotional = gridConfig.OnOverOffPositivePosition - gridConfig.OnOverOffNegativePosition;
        DiffNotional = TargetNotional - gridConfig.TargetNotional;
        let desc = `尝试降低下单量:${TargetNotional},${DiffNotional},${gridConfig.OnOverOffPositivePosition},${gridConfig.OnOverOffPositivePositionConfirm},${gridConfig.OnOverOffNegativePosition},${gridConfig.OnOverOffNegativePositionConfirm}`;
        sendBotMessage(desc);
      }
    }
    let TargetNotionalPending =
      gridConfig.OnOverOffPositivePositionPending - gridConfig.OnOverOffNegativePositionPending;
    if (DiffNotional) {
      if (TargetNotional == TargetNotionalPending) {
        console.log('无改单需求:', DiffNotional, TargetNotional, gridConfig.TargetNotional);
        DiffNotional = 0;
        console.log(
          `paths自主扫描进度结束:${this.startToken.symbol}-${this.endToken.symbol},头寸无变化,${DiffNotional}`,
        );
        return false;
      } else if (commitWaitingMap.size > 0) {
        console.log('有改单需求:', DiffNotional, TargetNotional, gridConfig.TargetNotional);
      }
    }
    //下单前做一次数据矫正
    if (DiffNotional != 0) {
      for (let tokenPath of this.spotCx.tokenPaths) {
        if (tokenPath.spotCx.isStartToken(tokenPath.startToken.key)) {
          let ret = await tokenPath.spotCx.CheckResetTargetNotional(tokenPath);
          break;
        }
      }
    }
    // if (DiffNotional >= 3) {
    //   if (this.startToken.key == this.spotCx.market.token1.key) {
    //     sendBotMessage(`下单单位超过4个Notional,限制为1个${DiffNotional},${onlyOneNotional}`);
    //   }
    // } else if (DiffNotional <= -3) {
    //   if (this.startToken.key == this.spotCx.market.token0.key) {
    //     sendBotMessage(`下单单位超过4个Notional,限制为1个${DiffNotional},${onlyOneNotional}`);
    //   }
    // }
    // if (onlyOneNotional || Math.abs(DiffNotional) >= 3) {
    //   if (DiffNotional > 2) {
    //     DiffNotional = 2;
    //   } else if (DiffNotional < -2) {
    //     DiffNotional = -2;
    //   }
    //   TargetNotional = DiffNotional + pathProfit.tokenPath.spotCx.gridConfig.TargetNotional;
    // }
    let max = false;
    // if (DiffNotional > 1) {
    //   TargetNotional = pathProfit.tokenPath.spotEx.gridConfig.TargetNotional + 1;
    //   max = true;
    //   DiffNotional = 1;
    // } else if (DiffNotional < -1) {
    //   TargetNotional = pathProfit.tokenPath.spotEx.gridConfig.TargetNotional - 1;
    //   DiffNotional = -1;
    //   max = true;
    // }
    if (DiffNotional == 0 || DiffNotional == Infinity) {
      DiffPosition =
        this.startToken.one *
        (TargetNotional * this.spotCx.gridConfig.UnitNotional - this.spotCx.gridConfig.ActualPosition);
      if (Math.abs(DiffPosition) < (this.startToken.one * this.spotCx.gridConfig.UnitNotional) / 5) {
        console.log(
          `paths自主扫描进度结束:${this.startToken.symbol}-${this.endToken.symbol},头寸无变化,${DiffNotional}`,
        );
        return false;
      } else {
        if (DiffPosition > 0) {
          if (this.startToken.key == this.spotCx.market.token1.key) {
            op = '建仓补仓';
            volume = BigNumber.from('0x' + Math.floor(DiffPosition / priceCx).toString(16));
            this.log(
              '准备建仓:',
              volume,
              pathProfit.tokenPath.spotCx.gridConfig.OnOverOffPositivePosition,
              pathProfit.tokenPath.spotCx.gridConfig.OnOverOffNegativePosition,
            );
          } else {
            return;
          }
        } else {
          op = '减仓补仓';
          if (this.startToken.key == this.spotCx.market.token0.key) {
            DiffPosition =
              (this.startToken.one *
                (this.spotCx.gridConfig.ActualPosition - TargetNotional * this.spotCx.gridConfig.UnitNotional) *
                priceDx) /
              priceCx;
          }
          volume = BigNumber.from('0x' + Math.floor(-DiffPosition).toString(16));
        }
      }
    } else if (DiffNotional > 0) {
      op = '建仓';
      //如果上一次是卖出,这次买入的原则是价格方向有变化
      if (DiffPosition == 0) {
        DiffPosition =
          this.startToken.one *
          (TargetNotional * this.spotCx.gridConfig.UnitNotional - this.spotCx.gridConfig.ActualPosition);
      }
      if (this.startToken.key == this.spotCx.market.token1.key) {
        if (DiffPosition < 0) {
          sendBotMessage(
            `DiffPosition为负数了,请确认:0:${TargetNotional}:${DiffPosition}:${pathProfit.tokenPath.spotCx.gridConfig.DiffNotional}:${priceDx}:${priceCx}`,
          );
          for (let tokenPath of this.spotCx.tokenPaths) {
            if (tokenPath.spotCx.isStartToken(tokenPath.startToken.key)) {
              await tokenPath.UpdateStartEndTokenBalance(true);
              await tokenPath.spotCx.ResetActualPositionConfirm(tokenPath);
              break;
            }
          }
          return false;
        }
        volume = BigNumber.from('0x' + Math.floor(DiffPosition / priceCx).toString(16));
        this.log(
          '准备建仓:',
          volume,
          pathProfit.tokenPath.spotCx.gridConfig.OnOverOffPositivePosition,
          pathProfit.tokenPath.spotCx.gridConfig.OnOverOffNegativePosition,
        );
      } else {
        this.log('无需建仓:');
        return false;
        //由另外一条路径执行
      }
    } else {
      op = '减仓';
      if (this.startToken.key == this.spotCx.market.token0.key) {
        if (DiffPosition == 0) {
          DiffPosition =
            (this.startToken.one *
              (this.spotCx.gridConfig.ActualPosition - TargetNotional * this.spotCx.gridConfig.UnitNotional) *
              priceDx) /
            priceCx;
        }
        if (DiffPosition < 0) {
          sendBotMessage(
            `DiffPosition为负数了,请确认:1:${TargetNotional}:${DiffPosition}:${pathProfit.tokenPath.spotCx.gridConfig.DiffNotional}:${priceDx}:${priceCx}`,
          );
          for (let tokenPath of this.spotCx.tokenPaths) {
            if (tokenPath.spotCx.isStartToken(tokenPath.startToken.key)) {
              await tokenPath.UpdateStartEndTokenBalance(true);
              await tokenPath.spotCx.ResetActualPositionConfirm(tokenPath);
              break;
            }
          }
          return false;
        }
        volume = BigNumber.from('0x' + Math.floor(DiffPosition).toString(16));
        this.log(
          '准备减仓:',
          DiffNotional,
          volume,
          pathProfit.tokenPath.spotCx.gridConfig.OnOverOffPositivePosition,
          pathProfit.tokenPath.spotCx.gridConfig.OnOverOffNegativePosition,
        );
      } else {
        this.log('无需减仓:', DiffNotional);
        return false;
        //由另外一条路径执行
      }
    }
    // if (max) {
    //   this.log(
    //     '下单单位过大,减半:',
    //     volume,
    //     pathProfit.tokenPath.spotEx.gridConfig.OnOverOffPositivePosition,
    //     pathProfit.tokenPath.spotEx.gridConfig.OnOverOffNegativePosition,
    //   );
    //   volume = volume.div(2);
    // }
    arb.header.volume = volume;
    // arb.header.volumeMinTo = volumeMinTo;
    arb.TargetNotionalTmp = TargetNotional;
    arb.DiffNotionalTmp = DiffNotional;
    arb.DiffPositionTmp = DiffPosition;
    arb.poolPath = pathProfit;
    arb.gasLimit = gasLimit;

    //这里得更新gasPrice
    let onlineChance = this.chanceType;
    let ret = await this.findTrendingPath(
      this.startTokenInstance.provider as providers.WebSocketProvider,
      arb,
      noSimulate,
    );
    if (ret && ret.pathAddr.length >= 1) {
      if (pathProfit.tokenPath.spotCx.gridConfig.DiffNotional != 0) {
        sendBotMessage(`存在未确认单的情况,不能再下单:${pathProfit.tokenPath.spotCx.gridConfig.DiffNotional}`);
        return false;
      }
      //如果余额不足
      ret.indata.OffsetPosition = 0;
      if (volume.gt(arb.header.volume)) {
        if (Math.abs(DiffNotional) > 1) {
          console.log('尝试1个Notional');
          return this.tryPaths(this.poolPathBest, true, ret.indata.gasLimit, true);
        } else {
          ret.indata.OffsetPosition =
            parseFloat(volume.sub(arb.header.volume).toString()) / parseFloat(volume.toString());
          console.log('余额不足,计算缺少比例:', ret.indata.OffsetPosition);
        }
      }
      volume = arb.header.volume;
      TargetNotional = arb.TargetNotionalTmp;
      DiffNotional = arb.DiffNotionalTmp;
      DiffPosition = arb.DiffPositionTmp;
      ret.indata.chanceType = onlineChance;
      ret.indata.op = op;
      ret.indata.TargetNotional = TargetNotional;
      ret.indata.DiffNotional = DiffNotional;
      ret.indata.DiffPosition = DiffPosition;

      if (this.startToken.key == this.spotCx.market.token1.key) {
      }
      this.log(
        '下单计划:',
        op,
        DiffPosition,
        parseFloat(volume.toString()) / this.startToken.one,
        pathProfit.tokenPath.spotCx.gridConfig.OnchainOverOffchainSpread,
        pathProfit.tokenPath.spotCx.gridConfig.OffchainOverOnchainSpread,
        priceDx,
        priceCx,
      );
      if (this.startToken.key == this.spotCx.market.token1.key) {
        priceDx = 1 / priceDx;
        priceCx = 1 / priceCx;
      }
      ret.indata.lastBlockNumber = lastBlockNumber;

      // ret.indata.header.volume = volume;
    } else {
      let symbols = '';
      if (ret?.pathAddr) {
        for (let addr of ret?.pathAddr) {
          let market = exchangeMarketAddressMap.get(addr);
          symbols = symbols + (symbols.length > 0 ? ':' : '') + market?.symbol;
        }
      }
      let desc = `下单计划:${pathProfit.tokenPath.startToken.symbol}-${
        pathProfit.tokenPath.endToken.symbol
      },路径查找失败:路径:${symbols},机会:${arb.chanceType},${
        parseFloat(volume.toString()) / pathProfit.tokenPath.startToken.one
      },priceDx:${priceDx},priceCx:${priceCx}`;
      this.log(desc);
      if (this.lastBotMessageBlockNumber != lastBlockNumber) {
        this.lastBotMessageBlockNumber = lastBlockNumber;
        // if (this.poolPathBest2) {
        //   if (this.poolPathBest2 != pathProfit) {
        //     desc = `${desc},准备尝试备用路径:${await this.GetPoolPathListSymbols(
        //       pathProfit,
        //     )},${await this.GetPoolPathListSymbols(this.poolPathBest2)}`;
        //   } else if (Math.abs(DiffNotional) > 1 && !onlyOneNotional) {
        //     desc = `${desc},备用使用一个Notional下单`;
        //   } else {
        //     desc = `${desc},备用线路也失败`;
        //   }
        // } else {
        //   desc = `${desc},无备用线路`;
        // }
        if (Math.abs(DiffNotional) > 1) {
          if (Math.abs(DiffNotional) > 1 && !onlyOneNotional && this.poolPathBest == pathProfit) {
            desc = `${desc},备用使用一个Notional下单`;
          }
        }
        sendBotMessage(desc);
      }
      for (let tokenPath of this.spotCx.tokenPaths) {
        if (tokenPath.spotCx.isStartToken(tokenPath.startToken.key)) {
          await tokenPath.UpdateStartEndTokenBalance(true);
          let ret = await tokenPath.spotCx.CheckResetTargetNotional(tokenPath);
          break;
        }
      }
      //先尝试一次备用路径,不行就用一个notional下单
      if (Math.abs(DiffNotional) > 1) {
        if (Math.abs(DiffNotional) > 1 && !onlyOneNotional && this.poolPathBest == pathProfit) {
          console.log('尝试1个Notional');
          return this.tryPaths(this.poolPathBest, true);
          // } else if (this.poolPathBest2 && this.poolPathBest2 != pathProfit) {
          //   console.log('尝试备用路径');
          //   return this.tryPaths(this.poolPathBest2, false);
        }
      }
    }
    let retok = false;
    if (ret && ret.pathAddr.length >= 1 && (await this.checkCanCommit(ret))) {
      ret.indata.pathstr = pathstr;
      ret.waitCommitTime = Date.now();
      for (let path of ret.pathAddr) {
        ret.pathAddrStr = ret.pathAddrStr + '-' + path;
      }
      if (!this.waitCommitMap.has(ret.pathAddrStr)) {
        // if (!firstCommit) {
        //   firstCommit = true;
        //   let empty = true;
        //   for (let parth of ret.pathAddr) {
        //     if (this.waitCommitPoolMap.get(parth)) {
        //       empty = false;
        //     } else {
        //       this.waitCommitPoolMap.set(parth, ret);
        //     }
        //   }
        // } else {
        this.waitCommitMap.set(ret.pathAddrStr, ret);
        retok = true;
        // }
      } else {
        console.log('过滤重复机会:', ret.pathAddrStr);
      }
      // let lastBlockNumber = (await this.startTokenInstance.provider.getBlock('latest')).number;
    } else {
      //这里需要回退
      gridConfig.OnOverOffPositivePosition = gridConfig.OnOverOffPositivePositionConfirm;
      gridConfig.OnOverOffNegativePosition = gridConfig.OnOverOffNegativePositionConfirm;
      // this.poolPathBest = null;
    }
    //同类币并行计算下看是否有价值
    // if (this.startTokenAddress == this.endTokenAddress && this.waitProfitList.length > 1) {
    //   let startRet = this.waitProfitList[0];
    //   for (let ret1 of this.waitProfitList) {
    //     for (let ret of this.waitProfitList) {
    //       ret.indata.path;
    //     }
    //   }
    // }
    console.log(`paths自主扫描进度结束:${this.startToken.symbol}-${this.endToken.symbol}`);
    return retok;
  };
  public GetPoolPathListSymbols = async (poolPathList: PoolPathList) => {
    let symbols = '';
    for (let path of poolPathList.path) {
      symbols = symbols + ':' + exchangeMarketAddressMap.get(path.address).symbol;
    }
    return symbols;
  };
  public UpdatePoolMap = async (pool_addrs: string[], awaitPoolMap: Map<string, any>) => {
    if (awaitPoolMap) {
      this.awaitPoolMap.clear();
      for (let [k, v] of awaitPoolMap) {
        this.awaitPoolMap.set(k, v);
      }
    }
    let now = Date.now();
    //全部遍历
    if (pool_addrs.length == 0) {
      for (let [address, v] of this.MongoPoolMap) {
        this.waitUpdatePoolMap.set(address, now);
      }
    } else {
      for (let address of pool_addrs) {
        this.waitUpdatePoolMap.set(address, now);
      }
    }
    //强制刷新
    this.loopFlag = true;
  };
  public UpdatePoolPrice = async (desc: string, blockNuber?: number) => {
    if (blockNuber) {
      this.blockNumber = blockNuber;
    }
    let pools: ExchangeMarket[] = [];
    let priceInfos: PoolPriceInfo[] = [];
    for (let [address, v] of this.MongoPoolMap) {
      pools.push(v);
    }
    for (let pool of pools) {
      let tokenPairInfo = this.exchangePriceInfoMap.get(pool.key);
      if (!tokenPairInfo) {
        console.log('动态添加tokenPairInfo:0:', desc, pool.key, this.exchangePriceInfoMap.size);
        tokenPairInfo = new TokenPairInfo(this);
        await tokenPairInfo.InitPrice(pool);
      }
      let ret = await tokenPairInfo.UpdatePrice(pool);
      //如果价差够大就扫描机会
      if (true || ret?.diff0 > 0.0) {
        let priceInfo = this.poolPriceInfoMap.get(pool.token0.address + pool.token1.address);
        if (!priceInfo) {
          console.log('xxxxxxxx:priceInfo:0:', pool.token0.symbol, pool.token1.symbol);
        }
        priceInfos.push(priceInfo);
      }
      if (true || ret?.diff1 > 0.0) {
        let priceInfo = this.poolPriceInfoMap.get(pool.token1.address + pool.token0.address);
        if (!priceInfo) {
          console.log('xxxxxxxx:priceInfo:1:', pool.token1.symbol, pool.token0.symbol);
        }
        priceInfos.push(priceInfo);
      }
    }

    for (let priceInfo of priceInfos) {
      //TODO 这里做刷新
    }
    this.loopFlag = true;
  };
  public getNextToken = async (
    provider: providers.WebSocketProvider,
    address: string,
    token0: string,
    token1: string,
    pathToken: string[],
    dataHeader: PlaceOrderPath,
  ): Promise<TokenPair> => {
    let key = address + (token0 ? token0 : '') + (token1 ? token1 : '');
    let tokenpair = tokenMap.get(key);
    if (!tokenpair) {
      let pool = this.abiInstancePool.attach(address);
      token0 = dataHeader.token0 || (await pool.token0());
      token1 = dataHeader.token1 || (await pool.token1());
      let erc20Data0 = erc20DataMap.get(token0);
      let erc20Data1 = erc20DataMap.get(token1);
      if (!erc20Data0 || !erc20Data1) {
        erc20Data0 = { decimals: 18, symbol: 'Unknown' };
        erc20Data1 = { decimals: 18, symbol: 'Unknown' };
        let erc200 = this.erc20Instance.attach(token0) as WETH9;
        let erc201 = this.erc20Instance.attach(token1) as WETH9;
        try {
          erc20Data0.decimals = await erc200.decimals();
          erc20Data1.decimals = await erc201.decimals();
          erc20Data0.symbol = await erc200.symbol();
          erc20Data1.symbol = await erc201.symbol();
          erc20DataMap.set(token0, erc20Data0);
          erc20DataMap.set(token1, erc20Data1);
        } catch {
          console.log('错误的ERC20:', address, token0, token1);
        }
      }
      tokenpair = {
        token0: token0,
        token1: token1,
        decimals0: erc20Data0.decimals,
        decimals1: erc20Data1.decimals,
        symbol0: erc20Data0.symbol,
        symbol1: erc20Data1.symbol,
      };
      tokenMap.set(key, tokenpair);
    }
    let tokenout = '';
    let tokenin = pathToken[pathToken.length - 1];
    dataHeader.token0 = tokenpair.token0;
    dataHeader.token1 = tokenpair.token1;
    if (tokenin.toLowerCase() == tokenpair.token0.toLowerCase()) {
      tokenout = tokenpair.token1;
      dataHeader.side = 0;
    } else if (tokenin.toLowerCase() == tokenpair.token1.toLowerCase()) {
      tokenout = tokenpair.token0;
      dataHeader.side = 1;
    } else {
      console.error('错误的交换路径:', address, tokenin, tokenpair.token0, tokenpair.token1);
      return null;
    }
    pathToken.push(tokenout);
    return tokenpair;
  };
  public findTrendingPath = async (
    provider: providers.WebSocketProvider,
    indata: PlaceOrderInput,
    noSimulate: boolean,
  ): Promise<TryTrendingRet> => {
    // console.log('xxxxxx:findTrendingPath:0:', indata);
    let pathDxType: number[] = [];
    let pathSide: number[] = [];
    if (!indata || indata.path.length == 0) {
      console.log('findTrendingPath,indata错误:', indata);
      return null;
    }
    let ret: TryTrendingRet = {
      pathAddrStr: '',
      pathAddr: [],
      pathAddrNo0x: [],
      indata: indata,
    };
    let pathToken: string[] = [indata.tokenPath.startTokenAddress];
    let index = 0;
    let desc = '';
    let rbase = indata.tokenPath.minVolume;
    let maxRate = 1;
    for (let path of indata.path) {
      //调试必须带20的路径
      // if (!includeDxType(ret.indata, 20)) {
      // if (!includeDxType(ret.indata, 80) && !includeDxType(ret.indata, 81)) {
      // if (!includeDxType(ret.indata, 40)) {
      //   return null;
      // }
      let exchange = path.pool;
      let dxType = exchange.dxType;
      logger.debug('xxxxxxxxxxx:dxType:begin:', dxType, path.side, rbase, path.address, path.token0, path.token1);
      //这里不能判断空,因为有情况不空
      let pool = path.address.length == 42 ? this.abiInstancePool.attach(path.address) : null;
      let tokenpairs = await this.getNextToken(provider, path.address, path.token0, path.token1, pathToken, path);
      if (!tokenpairs) {
        console.log('tokenpairs err:', path);
        return null;
      }
      // let exchange = exchangeMarketAddressMap.get(path.address);
      // if (!exchange) {
      //   console.log('找不到池子:exchangeMarketAddressMap:', path.address);
      //   return null;
      // }
      path.fee = exchange.fee;
      path.decimals0 = tokenpairs.decimals0;
      path.decimals1 = tokenpairs.decimals1;
      if (path.side == 0) {
        path.tokenFrom = tokenpairs.token0;
        path.tokenTo = tokenpairs.token1;
        path.decimalsFrom = tokenpairs.decimals0;
        path.decimalsTo = tokenpairs.decimals1;
      } else {
        path.tokenFrom = tokenpairs.token1;
        path.tokenTo = tokenpairs.token0;
        path.decimalsFrom = tokenpairs.decimals1;
        path.decimalsTo = tokenpairs.decimals0;
      }
      if (Math.floor(dxType / 10) == 1) {
        //v1
        //先山寨
        path.feePrecision = 10000;
        let param = path as TrendingV2;
        ret.pathAddr.push(param.address);
        pathDxType.push(dxType);
        pathSide.push(param.side);
        let priceX96 = exchange.owner.lastBlockConfirmPriceX96;
        if (path.side == 0) {
          path.priceX96 = priceX96;
        } else {
          path.priceX96 = MAX_UINT96.mul(MAX_UINT96).div(priceX96);
        }
      } else if (Math.floor(dxType / 10) == 7) {
        //v3
        let param = path as TrendingV3;
        ret.pathAddr.push(param.address);
        pathDxType.push(dxType);
        pathSide.push(param.side);
        param.decimals0 = tokenpairs.decimals0;
        param.decimals1 = tokenpairs.decimals1;
        param.fee = exchange.fee;
        path.tick = 0;

        let priceX96 = exchange.owner.lastBlockConfirmPriceX96;
        if (priceX96.eq(0)) {
          console.log('价格为0了:', param);
          return null;
        }
        if (param.side == 0) {
          param.priceX96 = priceX96;
        } else {
          param.priceX96 = MAX_UINT96.mul(MAX_UINT96).div(priceX96);
        }
      } else if (Math.floor(dxType / 10) == 6) {
        path.poolId = exchange.poolId;
        path.decimals0 = tokenpairs.decimals0;
        path.decimals1 = tokenpairs.decimals1;
        path.balanceFrom = BigNumber.from(0);
        let priceX18 = exchange.owner.lastBlockConfirmPriceX18;
        let priceX96 = exchange.owner.lastBlockConfirmPriceX96;
        if (path.side == 0) {
          path.price = priceX18;
          path.priceX96 = priceX96;
        } else {
          path.price = MAX_UINT18_ZERO.mul(MAX_UINT18_ZERO).div(priceX18);
          path.priceX96 = MAX_UINT96.mul(MAX_UINT96).div(priceX96);
        }
        console.log(
          'xxxxxxxxx:balancer:price:',
          path.addrType,
          path.side,
          priceX18.toString(),
          priceX96.toString(),
          path.price.toString(),
          path.priceX96.toString(),
        );

        let poolId = await pool.getPoolId();
        let vault = this.balancerVault;
        let tokenInfoFrom = await vault.getPoolTokenInfo(poolId, path.tokenFrom);
        path.balanceFrom = tokenInfoFrom.cash;
        path.fee = 0; //这里因为已经是税收后价格了,所以不考虑税收
        //下面这一句先山寨推进
        path.address = CONTRACT_BALANCER_VAULT_ADDRESS;
        ret.pathAddr.push(exchange.poolId + exchange.token0.symbol + exchange.token1.symbol);
        pathDxType.push(dxType);
        pathSide.push(path.side);
      } else {
        break;
      }
      desc =
        desc +
        ',' +
        dxType + //dx类型
        ',' +
        path.side + //买卖方向
        ',' +
        ret.pathAddr[index] + //池子地址
        ',' +
        pathToken[index] + //token0
        ',' +
        pathToken[index + 1]; //token1
      index++;
      //精度不够了,放弃
      if (rbase < 0.000001) {
        console.log('流动性太小导致精度不够了:', dxType, rbase, path.address, path.tokenFrom, path.tokenTo);
        return;
      }
      if (path.side == 0) {
        path.balanceFrom = path.balanceFrom || path.reserve0;
        path.balanceTo = path.balanceTo || path.reserve1;
      } else {
        path.balanceFrom = path.balanceFrom || path.reserve1;
        path.balanceTo = path.balanceTo || path.reserve0;
      }
      logger.debug('xxxxxxxxxxx:dxType:end:', dxType, rbase, path.R, path.address, path.token0, path.token1);
      dxType = path.dxType;
    }
    ret.indata.header.pathLen = ret.pathAddr.length;
    if (pathToken.length > 1) {
      console.log('pathAddr:', ret.pathAddr.length, ret.pathAddr);
      console.log('pathToken:', pathToken);
      let ok = await this.tryFindMaxK(ret, null, noSimulate);
      if (!ok) {
        return null;
      }
      console.log(
        '找到最大下单量:',
        ok.indata.tokenPath.startToken.symbol,
        ok.indata.tokenPath.endToken.symbol,
        parseFloat(ok.indata.header.volume.toString()) / ok.indata.tokenPath.startToken.one,
      );
      return ok;
    }
    let tmpList = [];
    for (let index = 0; index < ret.pathAddr.length; index++) {
      const addr = ret.pathAddr[index];
      const dxType = pathDxType[index];
      const side = pathSide[index];
      tmpList.push(dxType.toString() + '-' + side.toString() + '-' + addr);
    }
    ret.pathAddr = tmpList;
    return ret;
  };
  public tryFindMaxK = async (ret: TryTrendingRet, curK: BigNumber, noSimulate: boolean): Promise<TryTrendingRet> => {
    let indata = ret.indata;
    let R = BigNumber.from(0);
    let V = BigNumber.from(0);
    let precision = BigNumber.from(
      '0x' + (ret.indata.tokenPath.minVolume * ret.indata.tokenPath.startToken.one).toString(16),
    );
    let initVolume = precision;

    // let initVolumeTo = precision.mul(indata.tokenPath.endToken.oneBig).div(indata.tokenPath.startToken.oneBig);
    // cxPrice = cxPrice.mul(950).div(1000); //留下千分之五的利润
    // if (!curK || curK.eq(0)) {
    if (true) {
      {
        //测试山寨
        V = indata.header.volume;
        let Vc = V;
        ret.Vc = Vc;
        // let K = indata.header.volume;
        //这里如果滑点率非常低会导致K非常大,应该给给max值,随后,2048个最大
        curK = V;
        // let maxVolume = indata.tokenPath.maxVolume;
        // curK = R.gt(0) ? Vc.mul(1e9).div(R.mul(2)) : maxVolume;
        // if (curK.gt(maxVolume)) {
        //   curK = maxVolume;
        // }
        let balance = indata.tokenPath.startTokenBalance;
        if (indata.tokenPath.startTokenAddress != indata.tokenPath.endTokenAddress) {
          if (balance.lt(indata.tokenPath.startToken.balanceMinBigNumber)) {
            balance = BigNumber.from(0);
            // } else {
            //   balance = balance.sub(indata.tokenPath.startToken.balanceMinBigNumber);
          }
        }
        if (curK.gt(balance)) {
          if (curK.gt(balance.mul(10))) {
            let msg = `最大下单量超过余额,放弃:${indata.tokenPath.startToken.symbol},${
              indata.tokenPath.endToken.symbol
            },${parseFloat(curK.toString()) / indata.tokenPath.startToken.one},${
              parseFloat(balance.toString()) / indata.tokenPath.startToken.one
            },${
              parseFloat(indata.header.volume.toString()) / indata.tokenPath.startToken.one
            },${indata.tokenPath.startToken.balanceMinBigNumber.toString()}`;
            logger.debug(msg);
            if (this.lastBotMessageBlockNumber != lastBlockNumber) {
              this.lastBotMessageBlockNumber = lastBlockNumber;
              sendBotMessage(msg);
            }
            //这种情况应该是分叉导致,尝试修复
            this.spotCx.gridConfig.OnOverOffPositivePosition = this.spotCx.gridConfig.OnOverOffPositivePositionConfirm;
            this.spotCx.gridConfig.OnOverOffNegativePosition = this.spotCx.gridConfig.OnOverOffNegativePositionConfirm;
            return null;
          } else {
            let msg = `最大下单量超过余额,使用全部余额:${indata.tokenPath.startToken.symbol},${
              indata.tokenPath.endToken.symbol
            },${parseFloat(curK.toString()) / indata.tokenPath.startToken.one},${parseFloat(balance.toString())},${
              parseFloat(indata.header.volume.toString()) / indata.tokenPath.startToken.one
            },${indata.tokenPath.startToken.balanceMinBigNumber.toString()}`;
            logger.debug(msg);
            if (this.lastBotMessageBlockNumber != lastBlockNumber) {
              this.lastBotMessageBlockNumber = lastBlockNumber;
              sendBotMessage(msg);
            }
            curK = balance;
          }
          if (balance.gt(indata.tokenPath.startToken.balanceMinBigNumber)) {
            curK = balance;
          } else {
            curK = BigNumber.from(0);
          }
        }
        //检查是否有类似0X这种限高情况
        curK = this.checkPathAmountInMax(curK, ret);
        console.log(
          'xxxx:2:',
          initVolume.toString(),
          // V0.toString(),
          V.toString(),
          curK.toString(),
          R.toString(),
          Vc.toString(),
        );
        //先假定算出来的是最优的
        indata.header.volume = curK;
        indata.header.R = R;
      }
    }
    let K = curK;
    if (K.gt(0)) {
      let checkOk = noSimulate || (await this.checkSimulateOk(ret));
      if (checkOk != true) {
        if (checkOk == null) {
          console.log('有问题的池子,放弃:', ret.pathAddr);
          return null;
        }
        if (K.gte(precision.mul(4))) {
          // console.log('递减最大下单量:', maxK.toString(), K.toString(), minK.toString(), precision.toString());
          // return tryFindMaxK(provider, ret, K, K.div(2), minK, gasLimit, reversed);
          return null;
        }
        console.log('模拟执行失败并且下单量太小,放弃:', initVolume.toString(), V.toString(), K.toString());
        //得重置下单量,否则多次跟单时会被误导
        indata.header.volume = BigNumber.from(0);
        return null;
      }
      //直接使用计算出来的值
      return ret;
    } else {
      console.log('亏损,放弃:', initVolume.toString(), V.toString(), K.toString());
    }
    indata.header.volume = BigNumber.from(0);
    return null;
  };
  public checkPathAmountInMax = (initVolume: BigNumber, ret: TryTrendingRet) => {
    // let indata = ret.indata;
    // let V = initVolume;
    // let R = BigNumber.from(0);
    // let dxType = indata.header.dxType;
    // let index = 0;
    // for (let path of indata.path) {
    //   if (path.amountInMax && path.amountInMax.lt(V)) {
    //     if (index == 0) {
    //       console.log('限高池子:0:', path.address, path.amountInMax.toString(), V.toString());
    //       return path.amountInMax;
    //     }
    //     //反向计算,然后返回
    //     for (let index2 = index - 1; index2 >= 0; index2--) {
    //       path = indata.path[index2];
    //       let priceX96 = MAX_UINT96.mul(MAX_UINT96)
    //         .div(path.priceX96)
    //         .mul(1e6)
    //         .div(1e6 - path.fee);
    //       V = V.mul(priceX96).div(MAX_UINT96);
    //     }
    //     console.log('限高池子:1:', path.address, path.amountInMax?.toString(), V.toString(), initVolume.toString());
    //     return V;
    //   }
    //   V = V.mul(path.priceX96)
    //     .div(MAX_UINT96)
    //     .mul(1e6 - path.fee)
    //     .div(1e6);
    //   dxType = path.dxType;
    //   index++;
    // }
    return initVolume;
  };
  public checkMaxAmountIn = async (
    initInputRate: number,
    dxType: number,
    amountIn: BigNumber,
    path: PlaceOrderPath,
  ): Promise<BigNumber> => {
    if (dxType >= 70 && dxType < 80) {
    } else if (dxType == 50) {
      //0X协议
      amountIn = path.amountInMax?.lt(amountIn) ? path.amountInMax : amountIn;
    }
    return amountIn;
  };
  public getR = async (initVolume: BigNumber, ret: TryTrendingRet) => {
    let indata = ret.indata;
    let V = initVolume;
    let R = BigNumber.from(0);
    let dxType = indata.header.dxType;
    let initInputRate = indata.tokenPath.startToken.one / parseFloat(initVolume.toString());
    for (let path of indata.path) {
      // V = await checkMaxAmountIn(initInputRate, dxType, V, path);
      // if (V.eq(0)) {
      //   return null;
      // }
      if (path.balanceFrom && V.gt(path.balanceFrom.div(2))) {
        console.log('下单量先控制不能超过锁仓量的一半:', V.toString(), path.balanceFrom.toString());
        return null;
      }

      R = R.add(BigNumber.from(Math.floor(path.R * 1e9).toString()).toString()); //8位吧,少了精度不够,多了益处
      V = V.mul(path.priceX96)
        .div(MAX_UINT96)
        .mul(1e6 - path.fee)
        .div(1e6);
      dxType = path.dxType;
    }
    return R;
  };
  public checkCanCommit = async (ret: TryTrendingRet): Promise<TryTrendingRet> => {
    if (!ret || ret.pathAddr.length < 1) {
      return null;
    }
    let indata = ret.indata;
    let K = indata.header.volume;
    let R = indata.header.R;
    let Vc = ret.Vc;
    return ret;
  };
  public getVLog = (ret: TryTrendingRet) => {
    let indata = ret.indata;
    let dxType = indata.header.dxType;
    let V = indata.header.volume;
    let startV = parseFloat(V.toString()) / indata.tokenPath.startToken.one;
    let endV = startV;
    console.log('getVLog:', 0, indata.tokenPath.startToken.address, startV);
    for (let path of indata.path) {
      console.log('getVLog:', 0, indata.tokenPath.startToken.address, startV);
      V = V.mul(path.priceX96)
        .div(MAX_UINT96)
        .mul(1e6 - path.fee)
        .div(1e6);
      endV = parseFloat(V.toString()) / 10 ** path.decimalsTo;
      console.log('getVLog:', dxType, path.address, path.tokenFrom, path.tokenTo, endV);
      dxType = path.dxType;
    }
    return endV - startV;
  };
  public checkSimulateOk = async (ret: TryTrendingRet) => {
    // logger.debug('路径:', ret.indata.header, ret.pathAddr.toString());
    ret.indata.header.pathLen = ret.pathAddr.length;
    let gas = BigNumber.from(0);
    //1e18 = 10 ** (await erc200.decimals(),如果换usd需要换精度
    let precision = BigNumber.from(
      '0x' + (ret.indata.tokenPath.minVolume * ret.indata.tokenPath.startToken.one).toString(16),
    );
    let R = ret.indata.header.R;
    let K = ret.indata.header.volume;
    let RKKgas = R.mul(K).mul(K).div(precision).div(1e9).add(gas);
    ret.indata.header.RKKgas = BigNumber.from(0);
    let encodeData = this.getEncodeData(ret.indata);
    if (!encodeData) {
      console.log('路径可下单量太小,放弃');
      return false;
    }
    let gasLimit = BigNumber.from(0);
    this.getVLog(ret);
    // console.log('instanceTrendingCall.getInputData:', ret.indata.header, ...ret.indata.orders);
    // console.log('instanceTrendingCall.getInputData:', await instancePlaceOrder.decodePlaceOrderInput(encodeData));
    let getK = await this.instanceTrendingCall.getInputData(encodeData);
    console.log(
      'call instanceTrendingCall.getInputData:',
      getK.OrderNotionalAll.toString(),
      getK.header,
      ...getK.orders,
    );
    ret.indata.removeTokenIdIndexMax = 0;
    ret.indata.liquidity = BigNumber.from(0);
    ret.indata.removeTokenId = BigNumber.from(0);
    try {
      gasLimit = await this.instanceTrendingCall.estimateGas.placeOrderCallDeadlineBlock(
        encodeData,
        0,
        0,
        lastBlockNumber + 100,
      );
    } catch (e) {
      if (!e.error || (!e.error.body && !e.error.response)) {
        console.log('checkSimulate estimateGas body err:', this.blockNumber, encodeData, e);
        return false;
      }
      let datastr = e.error.body;
      if (!datastr) {
        datastr = e.error.response;
      }
      let data = JSON.parse(datastr);
      console.log('checkSimulate estimateGas err:', this.blockNumber, data.error.code, data.error.message);
      if (data.error.message != 'execution reverted: canceled') {
        if (data.error.message == 'execution reverted: UniswapV2: K') {
          // TokenPath.ResetPoolPrice({
          //   address: '',
          //   _reserve0: BigNumber.from(0),
          //   _reserve1: BigNumber.from(0),
          // });
          return false;
        }
        //垃圾币
        if (data.error.message.includes('INSUFFICIENT_INPUT_AMOUNT')) {
          console.log('垃圾币:', data.error.message);
          return null;
        }
        //垃圾币
        if (data.error.message.includes('INSUFFICIENT_OUTPUT_AMOUNT')) {
          console.log('垃圾币:', data.error.message);
          return null;
        }
        //垃圾池子
        if (data.error.message.includes('UnAuthorized')) {
          console.log('垃圾池子:', data.error.message);
          return null;
        }
        //垃圾池子
        if (data.error.message.includes('TRANSFER_FAILED')) {
          console.log('垃圾池子:', data.error.message);
          return null;
        }
        if (data.error.message == 'execution reverted: SPL') {
          return false;
        }
        console.log('checkSimulate estimateGas err:', this.blockNumber, e);
      }
      return false;
    }
    //如果是因为刹车,就只用一个notional的
    // let diffrate = Math.abs(ret.indata.DiffNotionalTmp);
    // if (gasLimit.toNumber() < 70000 && diffrate > 1) {
    //   ret.indata.header.volume = ret.indata.header.volume.div(diffrate);
    //   ret.indata.TargetNotionalTmp = ret.indata.TargetNotionalTmp / diffrate;
    //   ret.indata.DiffNotionalTmp = ret.indata.DiffNotionalTmp / diffrate;
    //   ret.indata.DiffPositionTmp = ret.indata.DiffPositionTmp / diffrate;
    //   sendBotMessage('断崖了,改为只下一个notional的量');
    //   return await this.checkSimulateOk(ret);
    // }

    let minGasLimit = 80000;
    if (gasLimit.toNumber() < minGasLimit) {
      console.log('checkSimulate gasLimit err:', this.blockNumber, gasLimit.toNumber());
      try {
        // let realV = await this.instanceTrendingCall.callStatic.placeOrderCallReturn(encodeData);
        // if (realV.lte(K.mul(ret.indata.tokenPath.endToken.oneBig).div(ret.indata.tokenPath.startToken.oneBig))) {
        //   console.log('checkSimulate profit err:', this.blockNumber, realV.toString(), K.toString());
        //   return false;
        // } else {
        //   console.log('checkSimulate profit:', this.blockNumber, gasLimit.toNumber(), realV.toString(), K.toString());
        // }
      } catch {}
      console.log('checkSimulate gasLimit err:', this.blockNumber, gasLimit.toNumber());
      return false;
    }
    if (gasLimit.toNumber() < 70000) {
      if (this.lastBotMessageBlockNumber != lastBlockNumber) {
        this.lastBotMessageBlockNumber = lastBlockNumber;
        sendBotMessage(`模拟执行刹车了,放行观察:${lastBlockNumber}`);
      }
    }
    console.log('checkSimulateOk:', gasLimit.toString());
    ret.indata.gasLimit = gasLimit;
    return true;
  };
  public getEncodeData = (indata: PlaceOrderInput) => {
    if (!indata.header.tokenStart) {
      indata.header.tokenStart = indata.tokenPath.startTokenAddress; //这里准备支持非闭环币
      indata.header.tokenEnd = indata.tokenPath.endTokenAddress; //这里准备支持非闭环币
    }
    //先写死最优滑点率和最糟滑点率
    // let GreenLightSlippageThreshold = 0.001;
    // let CutoffSlippageThreshold = 0.01;
    let GreenLightSlippageThreshold = 0.0005;
    let CutoffSlippageThreshold = 0.003;
    indata.header.GreenLightSlippageThreshold = BigNumber.from(
      '0x' + Math.floor(GreenLightSlippageThreshold * 1e6).toString(16),
    );
    indata.header.CutoffSlippageThreshold = BigNumber.from(
      '0x' + Math.floor(CutoffSlippageThreshold * 1e6).toString(16),
    );
    indata.header.MinOrderSizeRate = BigNumber.from(10 * Math.abs(indata.DiffNotionalTmp)); //单个notional的1/10
    if (indata.header.tokenStart == indata.header.tokenEnd) {
      indata.header.ReferencePriceX96 = MAX_UINT96;
    } else {
      // let cxPrice = this.spotEx.GetPriceAfterAllCostBySide(this.exSide);
      // let cxPrice = indata.tokenInfo.GetPathPriceBid();
      let gridConfig = indata.tokenPath.spotCx.gridConfig;
      let priceDx = gridConfig.OnchainBid || indata.poolPathInfo.GetPathPriceBid();
      let lastSlippage = gridConfig.lastSlippage;
      if (indata.tokenPath.startToken.key == indata.tokenPath.spotCx.market.token1.key) {
        priceDx = 1 / gridConfig.OnchainAsk;
      }
      // indata.header.ReferencePriceX96 = BigNumber.from('0x' + Math.floor(priceDx * 2 ** 96).toString(16))
      //   .mul(indata.tokenPath.endToken.oneBig)
      //   .div(indata.tokenPath.startToken.oneBig);
      let priceDxTmp = priceDx;
      //如果是0头寸,就控制滑点最小避免被滑点搞到亏损
      let absDiff = Math.abs(indata.DiffNotionalTmp);
      let slippage = Math.abs(absDiff || 1) * 0.001 + (lastSlippage || 0) / 2;
      if (indata.poolPath.path.length >= 1) {
        for (let pool of indata.poolPath.path) {
          slippage += absDiff * (pool.pool.slippage0 / 1e6);
        }
      }
      // if (slippage > 0.003) {
      //   console.log('滑点超过预期,限制下:', slippage, indata.DiffNotionalTmp, gridConfig.lastSlippage);
      //   slippage = 0.003;
      // } else if (slippage < 0.001) {
      //   slippage = 0.001;
      // }
      if (indata.chanceType) {
        priceDx = priceDx * (1 - slippage); //给个千分之五的滑点
      } else {
        priceDx = priceDx * (1 - slippage); //给个千分之五的滑点
      }
      indata.priceDxStop = priceDx;
      console.log(
        '刹车控制:',
        indata.tokenPath.startToken.symbol,
        indata.tokenPath.endToken.symbol,
        priceDxTmp,
        priceDx,
        indata.DiffNotionalTmp,
        slippage,
        lastSlippage,
        gridConfig.lastSlippage,
        indata.tokenPath.spotCx.gridConfig.OnchainOverOffchainSpread,
        indata.tokenPath.spotCx.gridConfig.OffchainOverOnchainSpread,
        indata.header.volume.toString(),
      );
    }
    // indata.header.priceDx = priceDx;
    indata.header.priceDx = 1;
    indata.orders = [];
    let index = 0;
    for (let poolPriceInfo of indata.poolPathInfo.poolPriceInfoPath) {
      let side = poolPriceInfo.side;
      if (side == 0) {
        indata.header.priceDx = indata.header.priceDx * poolPriceInfo.pool.spotPrice0WithFee;
      } else {
        indata.header.priceDx = indata.header.priceDx * (1 / poolPriceInfo.pool.spotPrice1WithFee);
      }
    }
    indata.header.ReferencePriceX96 = BigNumber.from('0x' + Math.floor(indata.header.priceDx * 2 ** 96).toString(16))
      .mul(indata.tokenPath.endToken.oneBig)
      .div(indata.tokenPath.startToken.oneBig);
    for (let poolPathInfo of this.poolPathInfos) {
      let priceDx = indata.header.priceDx;
      if (poolPathInfo.pathId != indata.pathId) {
        priceDx = 1;
        for (let poolPriceInfo of poolPathInfo.poolPriceInfoPath) {
          let side = poolPriceInfo.side;
          if (side == 0) {
            priceDx = priceDx * poolPriceInfo.pool.spotPrice0WithFee;
          } else {
            priceDx = priceDx * (1 / poolPriceInfo.pool.spotPrice1WithFee);
          }
        }
        //如果价格太差就不上链了
        if (priceDx < indata.header.priceDx * (1 - CutoffSlippageThreshold)) {
          console.log(
            '价格太差不上链:',
            indata.poolPathInfo.pathId,
            poolPathInfo.pathId,
            indata.header.priceDx,
            priceDx,
          );
          continue;
        }
      }
      let placeOrderData: PlaceOrderData = {
        SlippageRate: BigNumber.from(0),
        path: [],
      };
      let slippageAll = 0;
      for (let poolPriceInfo of poolPathInfo.poolPriceInfoPath) {
        let side = poolPriceInfo.side;
        slippageAll += side == 0 ? poolPriceInfo.pool.slippageOne0 : poolPriceInfo.pool.slippageOne1;
        let poolId = side == 0 ? poolPriceInfo.pool.poolId : poolPriceInfo.pool.poolId;
        let pool = { poolId: poolId, side: side };
        placeOrderData.path.push(pool);
      }
      //这个数字本身被放大了1e6
      slippageAll = slippageAll / 1e6;
      //如果滑点率太小,则指定一个精度6位不够7位来
      if (!slippageAll || slippageAll < 1 / 1e7) {
        console.log('slippageAll:太小:', slippageAll);
        slippageAll = (1 / 1e7) * 2;
      }
      placeOrderData.SlippageRate = BigNumber.from('0x' + Math.floor(slippageAll * 1e7).toString(16));
      // placeOrderData.ReverseSlippageRate = BigNumber.from('0x' + Math.floor((1 / slippageAll) * 1e6).toString(16));
      placeOrderData.ReverseSlippageRate = BigNumber.from('0x' + Math.floor(1 / slippageAll).toString(16));

      //计算是否值得添加这条路径,跟链上算法保持一致
      {
        let MarketAdverseShift = indata.header.priceDx / priceDx - 1;
        let MaxNotional = (CutoffSlippageThreshold - MarketAdverseShift) / slippageAll / 2;
        let ReferenceNotional = parseFloat(indata.header.volume.toString()) / indata.tokenPath.startToken.one;
        console.log('预计本路径可下单量:', MaxNotional, ReferenceNotional, MarketAdverseShift, slippageAll);
        if (MaxNotional < ReferenceNotional / 10) {
          console.log('路径可成交量太小,放弃:', MaxNotional / ReferenceNotional);
          continue;
        }
      }
      indata.orders.push(placeOrderData);
      index++;
      //最大只支持3条路径
      if (index >= 3) {
        break;
      }
    }

    return encodePlaceOrderInput(indata);
  };
  public UpdateStartEndTokenBalance = async (updateGridConfig?: boolean) => {
    let ret = await this.GetStartEndTokenBalance();
    this.startTokenBalance = ret.startTokenBalance;
    this.endTokenBalance = ret.endTokenBalance;
    if (updateGridConfig) {
      this.spotCx.gridConfig.token0Balance =
        parseFloat(this.startTokenBalance.toString()) / this.spotCx.market.token0.one;
      this.spotCx.gridConfig.token1Balance =
        parseFloat(this.endTokenBalance.toString()) / this.spotCx.market.token1.one;
    }
  };
  public GetStartTokenBalance = async () => {
    return (await this.GetStartEndTokenBalance()).startTokenBalance;
  };
  public GetStartEndTokenBalance = async () => {
    let startTokenFeeOwned = 0;
    let endTokenFeeOwned = 0;
    let tokenId = 0; //nft
    let startTokenBalance = await this.startTokenInstance.balanceOf(this.instanceTrendingCall.address);
    let endTokenBalance = await this.endTokenInstance.balanceOf(this.instanceTrendingCall.address);
    return { startTokenBalance, endTokenBalance, startTokenFeeOwned, endTokenFeeOwned, tokenId };
  };
}
