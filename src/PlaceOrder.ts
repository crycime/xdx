import { ParamType } from '../src/abi/lib/index';
import { AbiCoderPacked } from '../src/abi/src.ts';
import { BigNumberish } from 'ethers';
// import { ethers } from 'hardhat';
// import { AbiCoder } from 'web3-eth-abi';

import { GetTokenAddressById, TrendingAddrMap, ARBITRAGE_ADDR, ExchangeMarket, PoolPathList } from '../src/constants';
import { TupleCoder } from '../src/abi/src.ts/coders/tuple';
import { Reader, Writer } from '../src/abi/src.ts/coders/abstract-coder';
import { BigNumber } from '@ethersproject/bignumber';
import { PoolPathInfo, TokenPath } from './TokenPath';
import { Token } from 'graphql';
import { lastBlockNumber, MAX_UINT96 } from './SpotDx';
import { defaultAbiCoderPacked } from '../src/abi/src.ts';
import {
  PlaceOrder,
  PoolBaseDataStruct,
  PlaceOrderInputStruct,
  PlaceOrderDataStruct,
  PlaceOrderPathStruct,
  PoolBaseDataStructOutput,
} from '../typechain/PlaceOrder';
import { exchangeMarketAddressMap, exchangeMarketMap, exchangeMarketPoolIdMap } from './Start';

enum DxType {
  DxType_V2 = '0x00', //v2,univ2,sushiv2
  DxType_Cream = '0x01', //Cream.Finance
  DxType_OneInch = '0x02', //1inch
  DxType_Bancor = '0x03', //Bancor: Converter
  DxType_0XProtocal = '0x04', //0x Protocol
  DxType_Balancer = '0x05', //Balancer
  DxType_V3 = '0x06', //UniSwapV3
  DxType_Curve = '0x07', //Curve
}
export function EncodeParamHeader() {}

export function EncodeParamType<T1>(abiCoder: AbiCoderPacked, data: T1, param: ParamType) {
  let coders = abiCoder._getCoder(ParamType.from(param));
  let coder = new TupleCoder([coders], '_');
  let writer = new Writer(1);
  coder.encode(writer, { data: data });
  return writer.data;
}

export function DecodeParamType<T1>(abiCoder: AbiCoderPacked, param: ParamType, data: string) {
  let coders = abiCoder._getCoder(ParamType.from(param));
  let coder = new TupleCoder([coders], '_');
  let reader = new Reader(data);
  let ret = coder.decode(reader);
  return ret.data as T1;
}

export type TrendingTick = {
  tick: number; //0表示结束,TrendingDxType
};
export let ParamTypeTrendingTick = ParamType.fromObject({
  name: 'data',
  type: 'tuple',
  components: [
    {
      name: 'tick',
      type: 'int24',
      internalType: 'int24',
    },
  ],
});
export type TrendingPrice = {
  price: BigNumber; //0表示结束,TrendingDxType
};
export let ParamTypeTrendingPrice = ParamType.fromObject({
  name: 'data',
  type: 'tuple',
  components: [
    {
      name: 'price',
      type: 'uint256',
      internalType: 'uint256',
    },
  ],
});
export type TrendingPriceX96 = {
  priceX96: BigNumber; //0表示结束,TrendingDxType
};
export let ParamTypeTrendingPriceX96 = ParamType.fromObject({
  name: 'data',
  type: 'tuple',
  components: [
    {
      name: 'priceX96',
      type: 'uint256',
      internalType: 'uint256',
    },
  ],
});
export type TrendingIndexFromTo = {
  indexFrom: number; //token下标
  indexTo: number; //token下标
};
export let ParamTrendingIndexFromTo = ParamType.fromObject({
  name: 'data',
  type: 'tuple',
  components: [
    {
      name: 'indexFrom',
      type: 'uint8',
      internalType: 'uint8',
    },
    {
      name: 'indexTo',
      type: 'uint8',
      internalType: 'uint8',
    },
  ],
});
export type TrendingBalanceFrom = {
  balanceFrom: BigNumber; //0表示结束,TrendingDxType
};
export let ParamTrendingBalanceFrom = ParamType.fromObject({
  name: 'data',
  type: 'tuple',
  components: [
    {
      name: 'balanceFrom',
      type: 'uint256',
      internalType: 'uint256',
    },
  ],
});
export type TrendingPoolId = {
  poolId: string; //0表示结束,TrendingDxType
};
export let ParamTrendingTrendingPoolId = ParamType.fromObject({
  name: 'data',
  type: 'tuple',
  components: [
    {
      name: 'poolId',
      type: 'bytes32',
      internalType: 'bytes32',
    },
  ],
});
export type TrendingTokenToAddress = {
  tokenTo: string; //0表示结束,TrendingDxType
};
//20字节
export let ParamTypeTrendingTokenToAddress = ParamType.fromObject({
  name: 'data',
  type: 'tuple',
  components: [
    {
      name: 'tokenTo',
      type: 'bytes20',
      internalType: 'bytes20',
    },
  ],
});
export type TrendingAddress = {
  address: string; //0表示结束,TrendingDxType
};
//20字节
export let ParamTypeTrendingAddress = ParamType.fromObject({
  name: 'data',
  type: 'tuple',
  components: [
    {
      name: 'address',
      type: 'bytes20',
      internalType: 'bytes20',
    },
  ],
});
export type TrendingNext = {
  dxType?: number; //0表示结束,TrendingDxType
};
//1字节
export let ParamTypeTrendingNext = ParamType.fromObject({
  name: 'data',
  type: 'tuple',
  components: [
    {
      name: 'dxType',
      type: 'uint8',
      internalType: 'uint8',
    },
  ],
});
export type PlaceOrderHeader = TrendingNext & {
  orderLen?: number; //1字节
  pathLen?: number; //兼容用
  startTokenDecimals?: number; //起始币精度
  volume: BigNumber; //7字节/缩小5字节精度
  priceDx?: number; //链下计算方便用
  ReferencePriceX96?: BigNumber; //The best pool's spot price as of order placement from offline; measured as "One token0 exchange to how many token1"
  GreenLightSlippageThreshold?: BigNumber; //Allowed slippage that an order can be placed right away, for example, 0.1%
  MinOrderSizeRate?: BigNumber; //最小下单量的比例
  CutoffSlippageThreshold?: BigNumber;
  gasPrice?: BigNumber; //gasPrice费4字节Gwei
  R?: BigNumber; //滑点率4字节1e9
  RKKgas?: BigNumber; //3字节<<48
  tokenStart?: string; //起始币
  tokenEnd?: string; //结束币
};
//13字节
export let ParamTypePlaceOrderHeader = ParamType.fromObject({
  name: 'data',
  type: 'tuple',
  components: [
    {
      name: 'orderLen',
      type: 'uint8',
      internalType: 'uint8',
    },
    {
      name: 'startTokenDecimals',
      type: 'uint8',
      internalType: 'uint8',
    },
    {
      name: 'MinOrderSizeRate',
      type: 'uint8',
      internalType: 'uint8',
    },
    {
      name: 'volume',
      type: 'uint80',
      internalType: 'uint80',
    },
    // {
    //   name: 'ReferenceNotional',
    //   type: 'uint80',
    //   internalType: 'uint80',
    // },
    {
      name: 'ReferencePriceX96',
      type: 'uint256',
      internalType: 'uint256',
    },
    {
      name: 'GreenLightSlippageThreshold',
      type: 'uint24',
      internalType: 'uint24',
    },
    {
      name: 'CutoffSlippageThreshold',
      type: 'uint24',
      internalType: 'uint24',
    },
  ],
});
export type PlaceOrderData = {
  SpotPriceX96?: BigNumber; //链上
  SlippageRate?: BigNumber; //链下
  ReverseSlippageRate?: BigNumber; //链下
  MinOrderSize?: BigNumber; //链下
  MarketAdverseShift?: BigNumber; //链上
  OrderNotional?: BigNumber; //链上
  path: PlaceOrderPath[];
  pathLen?: number; //兼容用
  pathstr?: string; //提交交易一定时间内不要重复,避免死循环下单
};
export type PlaceOrderInput = {
  header: PlaceOrderHeader;
  orders: PlaceOrderData[];
  pathId: number; //路径编号,兼容用
  path: PlaceOrderPath[]; //这里先用来兼容,之后就不要了
  pathstr?: string; //这里先用来兼容,之后就不要 了
  hash?: string;
  tokenPath: TokenPath;
  poolPath?: PoolPathList;
  gasLimit?: BigNumber; //
  poolPathInfo?: PoolPathInfo;
  priceCx?: number;
  DiffNotional?: number;
  DiffNotionalTmp?: number;
  TargetNotionalTmp?: number; //临时用
  DiffPosition?: number;
  DiffPositionTmp?: number;
  lastBlockNumber?: number;
  TargetNotional?: number; //最新目标头寸
  OffsetPosition?: number; //余额不足时与1个Notional的差额比例
  op?: string;
  pathDesc?: string;
  chanceType: number; //0表示链下,1表示链上,2表示pending,3表示mined
  removeTokenIdIndexMax?: number;
  removeTokenId?: BigNumber;
  liquidity?: BigNumber;
  priceDxStop?: number; //刹车价
};
export type TryTrendingRet = {
  // encodeData: string;
  pathAddrStr?: string;
  pathAddr: string[];
  pathAddrNo0x: string[]; //查找备用
  indata: PlaceOrderInput;
  Vc?: BigNumber;
  waitCommitTime?: number; //提交交易的时间
  realProfit?: number; //真实利润,利润-gas
  startTokenBalane?: BigNumber; //起始币余额
};

export type PlaceOrderPath = TrendingNext & {
  poolId?: BigNumberish; //池子索引id
  side: number; //253表示0->1,254表示1->0,255表示地址,其他表示从下标取
  addrType?: number; //255表示地址,以下表示从数组下标取
  address?: string; //池子地址,20字节
  R?: number; //滑点率
  priceX96?: BigNumber; //价格
  price?: BigNumber; //价格
  tick?: number; //v3tick
  fee?: number; //手续费率
  feePrecision?: number; //手续费率基数
  swapFee?: BigNumber; //18位精度,目前balancer极速啊用
  decimals0?: number; //精度0
  decimals1?: number; //精度1
  decimalsFrom?: number;
  decimalsTo?: number;
  reserveSlot0?: BigNumber; //当前tick锁仓量
  reserveSlot1?: BigNumber; //当前tick锁仓量
  reserve0?: BigNumber; //锁仓量
  reserve1?: BigNumber; //锁仓量
  indexFrom?: number; //token下标
  indexTo?: number; //token下标
  balanceFrom?: BigNumber; //锁仓量
  balanceTo?: BigNumber; //锁仓量
  denormFrom?: BigNumber; //分母
  denormTo?: BigNumber; //分母
  denorm0?: BigNumber; //分母
  denorm1?: BigNumber; //分母
  tokenFrom?: string; //地址
  tokenTo?: string; //地址
  tokenToType?: number; //0表示用tokenTo
  token0?: string; //池子地址
  token1?: string; //池子地址
  gasProtocolFeeMultiplier?: BigNumber; //0X协议费通过gas来收取,目前收取是7W
  amountInMax?: BigNumber; //最大可购买量
  poolData0XV4?: any; //0X Proto
  maker?: string; //0X Proto
  selectorDataLen?: number; //0X Proto
  isMPool?: boolean; //balancer是否为BPool
  pool?: ExchangeMarket;
};
//3字节

export let ParamTypePlaceOrderData = ParamType.fromObject({
  name: 'data',
  type: 'tuple',
  components: [
    {
      name: 'pathLen',
      type: 'uint8',
      internalType: 'uint8',
    },
    {
      name: 'SlippageRate',
      type: 'uint24',
      internalType: 'uint24',
    },
    {
      name: 'ReverseSlippageRate',
      type: 'uint24',
      internalType: 'uint24',
    },
  ],
});
export let ParamTypePlaceOrderPath = ParamType.fromObject({
  name: 'data',
  type: 'tuple',
  components: [
    {
      name: 'poolId',
      type: 'uint8',
      internalType: 'uint8',
    },
    {
      name: 'side',
      type: 'uint8',
      internalType: 'uint8',
    },
  ],
});

export type TrendingV2 = PlaceOrderPath & {
  reserve0: string; //32字节,最小质押量,低于了就不退出
  reserve1?: string; //32字节,最小质押量,低于了就不退出
};
//38字节
export let ParamTypeTrendingV2 = ParamType.fromObject({
  name: 'data',
  type: 'tuple',
  components: [
    ...ParamTypePlaceOrderPath.components,
    // {
    //   name: 'reserve0',
    //   type: 'uint256',
    //   internalType: 'uint256',
    // },
    // {
    //   name: 'price',
    //   type: 'uint24',
    //   internalType: 'uint24',
    // },
  ],
});
export type TrendingV3 = PlaceOrderPath & {
  liquidity: string; //16字节
  tick: number; //3字节
};
//22字节
export let ParamTypeTrendingV3 = ParamType.fromObject({
  name: 'data',
  type: 'tuple',
  components: [
    ...ParamTypePlaceOrderPath.components,
    // {
    //   name: 'liquidity',
    //   type: 'uint128',
    //   internalType: 'uint128',
    // },
    // {
    //   name: 'tick',
    //   type: 'int24',
    //   internalType: 'int24',
    // },
  ],
});

export type TrendingZXExchangeV3 = PlaceOrderPath & {
  makerAddress?: string;
  // takerAddress?: string;
  feeRecipientAddress?: string;
  // senderAddress?: string;
  makerAssetAmount?: string;
  takerAssetAmount?: string;
  // makerFee?: string;
  // takerFee?: string;
  expirationTimeSeconds?: string;
  orderHash?: string;
  salt?: string;
  makerAssetData?: string;
  takerAssetData?: string;
  // makerFeeAssetData?: string;
  // takerFeeAssetData?: string;
  signature?: string;
  signature0?: string;
  signature1?: string;
  signature2?: string;
};

export type TrendingZXExchangeV3Order = {
  makerAddress?: string;
  feeRecipientAddress?: string;
  makerAssetAmount?: string;
  takerAssetAmount?: string;
  expirationTimeSeconds?: string;
  salt?: string;
  makerAssetData?: string;
  takerAssetData?: string;
  signature0?: string;
  signature1?: string;
  signature2?: string;
};

export let encodePlaceOrderInput = (indata: PlaceOrderInput) => {
  if (indata.orders.length == 0) {
    console.log('没有可交易路径:', indata.header, indata.orders);
    return '';
  }
  indata.header.orderLen = indata.orders.length;
  indata.header.startTokenDecimals = indata.tokenPath.startToken.decimals;
  let encodeData = '0x' + EncodeParamType(defaultAbiCoderPacked, indata.header, ParamTypePlaceOrderHeader).substr(2);
  console.log('参数:', lastBlockNumber, encodeData);
  for (let order of indata.orders) {
    order.pathLen = order.path.length;
    encodeData = encodeData + EncodeParamType(defaultAbiCoderPacked, order, ParamTypePlaceOrderData).substr(2);
    for (let path of order.path) {
      let dxType = path.dxType;
      encodeData = encodeData + EncodeParamType(defaultAbiCoderPacked, path, ParamTypePlaceOrderPath).substr(2);
      //balancer
      if (dxType == 60) {
        path.balanceFrom = BigNumber.from(0);
        encodeData = encodeData + EncodeParamType(defaultAbiCoderPacked, path, ParamTypeTrendingPriceX96).substr(2);
        encodeData = encodeData + EncodeParamType(defaultAbiCoderPacked, path, ParamTrendingBalanceFrom).substr(2);
      } else if (dxType == 61) {
        path.balanceFrom = BigNumber.from(0);
        encodeData = encodeData + EncodeParamType(defaultAbiCoderPacked, path, ParamTypeTrendingPriceX96).substr(2);
        encodeData = encodeData + EncodeParamType(defaultAbiCoderPacked, path, ParamTrendingBalanceFrom).substr(2);
      }
    }
  }
  return encodeData;
};

export let PlaceOrderPoolIdList: PoolBaseDataStruct[] = [];
export let PlaceOrderPoolAddressMap = new Map<string, PoolBaseDataStruct>();
export let PlaceOrderPoolSymbolMap = new Map<string, PoolBaseDataStruct>();
export let InitPlaceOrderPoolList = async (instancePlaceOrder: PlaceOrder) => {
  let poolList = await instancePlaceOrder.getPoolList();
  poolList = [...poolList].sort((a: any, b: any) => {
    return a.poolId - b.poolId;
  });
  console.log('InitPlaceOrderPoolList:', poolList);
  for (let pool of poolList) {
    PlaceOrderPoolIdList.push(pool);
    let market = exchangeMarketAddressMap.get(pool.addr);
    if (market) {
      PlaceOrderPoolAddressMap.set(pool.addr, pool);
      PlaceOrderPoolSymbolMap.set(market.symbol, pool);
      market.poolId = pool.poolId;
      exchangeMarketPoolIdMap.set(market.poolId, market);
    }
  }
};
