import { Market, Ticker } from '../src/ccxws/src/index';

import { BigNumber } from 'ethers';
import { PoolPathInfo, TokenPath } from './TokenPath';
import { SpotEx } from './SpotEx';
//静态数据配置

export const MAX_UINT256 = BigNumber.from(2).pow(256); //.sub(1);
export const MAX_UINT128 = BigNumber.from(2).pow(128); //.sub(1);
export const MAX_UINT96 = BigNumber.from(2).pow(96); //.sub(1);
export const MAX_UINT18_ZERO = BigNumber.from(10).pow(18);
export const MAX_UINT24_ZERO = BigNumber.from(10).pow(24);
export const MAX_UINT6_ZERO = BigNumber.from(10).pow(6);
export const BIGNUMBER_ZERO = BigNumber.from(0);
export const DEFAULT_GAS_LIMIT = BigNumber.from(1000000);

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

export const UNI_V3_QUOTER_ADDRESSES = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6'; //matic
export const UNI_V3_NFT_ADDRESSES = '0xc36442b4a4522e871399cd717abdd847ab11fe88'; //matic

export const CONTRACT_BANCOR_NETWORK_ADDRESS = '0x2F9EC37d6CcFFf1caB21733BdaDEdE11c823cCB0'; //Bancor: Swaps
export const CONTRACT_ZX_EXCHANGE_ADDRESS_V4 = '0xDef1C0ded9bec7F1a1670819833240f027b25EfF'; //matic
export const CONTRACT_ZX_EXCHANGE_ADDRESS_V3 = '0x61935CbDd02287B511119DDb11Aeb42F1593b7Ef';
export const CONTRACT_ZX_ERC20_PROXY_ADDRESS_V3 = '0x95E6F48254609A6ee006F7D493c8e5fB97094ceF';
export const CONTRACT_BALANCER_BALANCERHELPER = '0xA961672E8Db773be387e775bc4937C678F3ddF9a'; //matic 已废弃
export const CONTRACT_CURVE_POOL_REGISTRY = '0x722272D36ef0Da72FF51c5A65Db7b870E2e8D4ee'; //matic
export const CONTRACT_BALANCER_VAULT_ADDRESS = '0xBA12222222228d8Ba445958a75a0704d566BF2C8'; //matic
export const CONTRACT_BALANCER_FACTORY_ADDRESS = '0xc66Ba2B6595D3613CCab350C886aCE23866EDe24'; //matic Balancer: Stable Pool Factory
export const CONTRACT_BALANCER_REGISTRY = '0x65e67cbc342712DF67494ACEfc06fe951EE93982'; //matic 已废弃
export const CONTRACT_ADDRESS_ROUTER_V2 = '0x7a250d5630b4cf539739df2c5dacb4c659f2488d';
export const CONTRACT_ADDRESS_FACTORY_SUSHI = '';

export const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
export const eth_address = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
export const METH_ADDRESS = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'; //主链过来的eth
export const WETH_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'; //WMATIC
export const WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'; //WMATIC
export const weth_address = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'; //小写
export const WBTC_ADDRESS = '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6';
export const USDT_ADDRESS = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
export const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
export const DAI_ADDRESS = '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063';
export const UST_ADDRESS = '0xe6469ba6d2fd6130788e0ea9c0a0515900563b59';
export const UNI_ADDRESS = '0xb33EaAd8d922B1083446DC23f610c2567fB5180f';
export const QUICK_ADDRESS = '0x831753DD7087CaC61aB5644b308642cc1c33Dc13';
export const MIMATIC_ADDRESS = '0xa3Fa99A148fA48D14Ed51d610c367C61876997F1'; //matic网络的稳定币miMATIC
export enum FeeAmount {
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000,
}

export const FeeAmountIndex: { [amount in FeeAmount]: number } = {
  [FeeAmount.LOW]: 0,
  [FeeAmount.MEDIUM]: 1,
  [FeeAmount.HIGH]: 2,
};

export const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
  [FeeAmount.LOW]: 10,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 200,
};
export function GetTokenAddressById(id: number): string {
  if (id == 1) {
    return WETH_ADDRESS;
  } else if (id == 2) {
    return WBTC_ADDRESS;
  } else if (id == 3) {
    return USDT_ADDRESS;
  } else if (id == 4) {
    return USDC_ADDRESS;
  }
  return '';
}
export function GetIdByTokenAddress(address: string): number {
  if (address.toLowerCase() == WETH_ADDRESS.toLowerCase()) {
    return 1;
  } else if (address.toLowerCase() == WBTC_ADDRESS.toLowerCase()) {
    return 2;
  } else if (address.toLowerCase() == USDT_ADDRESS.toLowerCase()) {
    return 3;
  } else if (address.toLowerCase() == USDC_ADDRESS.toLowerCase()) {
    return 4;
  }
  return 0;
}

export const UNI_V3_MAX_TICK = 887272;
export const UNI_V3_MIN_TICK = -887272;
export const PANCAKE_V2_FACTORY_ADDRESS = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';

export enum TrendingDxType {
  TrendingDxType_None = 0, //无效
  TrendingDxType_V2 = 1, //v2,univ2,sushiv2
}

export let TrendingAddrMap: Map<string, number>;

export function GetTokenPairKey(token0: string, token1: string) {
  token0 = token0.toLowerCase();
  token1 = token1.toLowerCase();
  return token0 < token1 ? token0 + token1 : token1 + token0;
}

//还不能工作,性价比不够
export const ARBITRAGE_ADDR = [
  // '0x167384319B41F7094e62f7506409Eb38079AbfF8', //UNI-V3:WETH-METH-03
  // '0x45dDa9cb7c25131DF268515131f647d726f50608', //UNI-V3:USDC-METH-005
  // '0x9B08288C3Be4F62bbf8d1C20Ac9C5e6f9467d8B7', //UNI-V3:WETH-USDC-005
];

// 程序：
// 连续对冲：MMContinuousHedge
// 调仓：Adjustment

export const EPSILON = 0.0000000000001;

enum SpotType {
  SpotType_Simple, //单一行情(直连)
  SpotType_Composite, //组合行情(非直连)
}
export type MarketPrice = Market & {
  side?: number; //0表示0买1,反过来是1买0
  price?: number; //实时价格base/qout或者qout/base,取决于side;
  ticker?: Ticker;
};
export type TokenBaseInfo = {
  symbol: string;
  // alian: string; //因为USDT在交易所和链上名称相同了,加个别名区分下
  decimals: number;
  address: string;
  one?: number;
  oneBig?: BigNumber;
  balanceMin?: number;
  balanceMinBigNumber?: BigNumber;
  priceUsd?: number;
  key: string; //同价值币的描述,比如USDT/USDC的key都是USD
  balance?: number; //余额
  startBalance?: number; //启动时初始余额,用来计算盈利
  minBalance?: number; //最小成交额
  updateAt?: number; //最后更新时间,msec
  ex: string;
};
export type ExchangeMarket = {
  poolId?: number; //对应链上池子id
  balancerPoolId?: string; //balancer用
  parent?: ExchangeMarket; //上级
  market0?: ExchangeMarket; //路径,cx算价格用
  market1?: ExchangeMarket; //路径,cx算价格用
  marketSymbole0?: string; //路径符号,程序来生成链表路径
  marketSymbole1?: string; //路径符号,程序来生成链表路径
  symbol: string;
  status?: string; //状态存档文件名称
  address: string; //DX用,池子地址,CX用ex.symbol
  router?: string; //入口合约
  token0: TokenBaseInfo;
  token1: TokenBaseInfo;
  side: 0 | 1; //0买1还是1买0
  type: 'CX' | 'DX' | 'BRIDGE';
  ex:
    | 'huobi'
    | 'binance'
    | 'binance_future'
    | 'okex'
    | 'ftx'
    | 'univ3'
    | 'univ2'
    | 'quickv2'
    | 'pancake'
    | 'biswap'
    | 'balancerv2'; //交易名称
  weight?: BigNumber; //总权重
  weight0?: BigNumber; //token0权重
  weight1?: BigNumber; //token1总权重
  priority?: number; //优先级,如果多交易所拿数据,用优先级高的,0最高
  dxType: number; //如果是dex,描述出类型
  fee: number; //费率百万分之一的单位
  gas: number; //折合为U的固定开销
  slippageOne0?: number; //卖一个币的滑点,百万分之一的单位
  slippageOne1?: number; //卖一个币的滑点,百万分之一的单位
  slippage0?: number; //下单单位滑点,百万分之一的单位
  slippage1?: number; //下单单位滑点,百万分之一的单位
  MaxTicketSize: number; //最大下单量,折合为U
  id?: string; //中心化交易所用,程序填充
  key?: string; //token0.key:token1.key
  ticker?: Ticker; //最新报价信息
  price?: number; //实时价格base/qout或者qout/base,取决于side;
  isAn?: boolean; //是否计算平均移动值
  allSlippage?: number; //实时价格base/qout或者qout/base,取决于side;
  spotPrice0WithFee?: number; //不带滑点带fee的价格
  spotPrice1WithFee?: number; //不带滑点带fee的价格
  askAfterAllCost?: number; //买方报价
  bidAfterAllCost?: number; //卖方报价
  token0PriceAfterAllCostBidOld?: number;
  token1PriceAfterAllCostBidOld?: number;
  token0PriceAfterAllCostAskOld?: number;
  token1PriceAfterAllCostAskOld?: number;
  token0PriceAfterAllCostBidRatio?: number;
  token1PriceAfterAllCostBidRatio?: number;
  token0PriceAfterAllCostAskRatio?: number;
  token1PriceAfterAllCostAskRatio?: number;
  token0PriceAfterAllCostBid?: number; //0买1价格卖
  token1PriceAfterAllCostBid?: number; //1买0价格卖
  token0PriceAfterAllCostAsk?: number; //0买1价格买
  token1PriceAfterAllCostAsk?: number; //1买0价格卖
  lastToken0PriceAfterAllCost?: number; //用来判断是否有变化
  MaxTicketSizeAskAfterAllCost?: number; //最大可卖出总量
  MaxTicketSizeBidAfterAllCost?: number; //最大可买入总量
  owner?: SpotEx; //所属交易所
};
export let TokenInfoEnum = {
  USDT: {
    symbol: 'USDT',
    key: 'USD',
    decimals: 6,
    one: 10 ** 6,
    oneBig: BigNumber.from(10).pow(6),
    balanceMin: 0,
    balanceMinBigNumber: BigNumber.from(0),
    priceUsd: 0,
    address: USDT_ADDRESS,
    balance: 10000, //模拟余额
    minBalance: 100, //最小成交额
    startBalance: 0, //启动时初始余额,用来计算盈利
    ex: 'polygon',
  },
  USDC: {
    symbol: 'USDC',
    key: 'USD',
    decimals: 6,
    one: 10 ** 6,
    oneBig: BigNumber.from(10).pow(6),
    balanceMin: 0,
    balanceMinBigNumber: BigNumber.from(0),
    priceUsd: 0,
    address: USDC_ADDRESS,
    balance: 1000, //模拟余额
    minBalance: 100, //最小成交额
    startBalance: 0, //启动时初始余额,用来计算盈利
    ex: 'polygon',
  },
  DAI: {
    symbol: 'DAI',
    key: 'USD',
    decimals: 18,
    one: 10 ** 18,
    oneBig: BigNumber.from(10).pow(18),
    balanceMin: 0,
    balanceMinBigNumber: BigNumber.from(0),
    priceUsd: 0,
    address: DAI_ADDRESS,
    balance: 10000, //模拟余额
    minBalance: 100, //最小成交额
    startBalance: 0, //启动时初始余额,用来计算盈利
    ex: 'polygon',
  },
  WMATIC: {
    symbol: 'WMATIC',
    key: 'MATIC',
    decimals: 18,
    one: 10 ** 18,
    oneBig: BigNumber.from(10).pow(18),
    balanceMin: 0,
    balanceMinBigNumber: BigNumber.from(0),
    priceUsd: 0,
    address: WMATIC_ADDRESS,
    balance: 5000, //模拟余额
    minBalance: 50, //最小成交额
    startBalance: 0, //启动时初始余额,用来计算盈利
    ex: 'polygon',
  },
  WETH: {
    symbol: 'WETH',
    key: 'ETH',
    decimals: 18,
    one: 10 ** 18,
    oneBig: BigNumber.from(10).pow(18),
    balanceMin: 0,
    balanceMinBigNumber: BigNumber.from(0),
    priceUsd: 0,
    address: METH_ADDRESS,
    balance: 2.5, //模拟余额
    minBalance: 0.025, //最小成交额
    startBalance: 0, //启动时初始余额,用来计算盈利
    ex: 'polygon',
  },
  WBTC: {
    symbol: 'WBTC',
    key: 'BTC',
    decimals: 8,
    one: 10 ** 8,
    oneBig: BigNumber.from(10).pow(8),
    balanceMin: 0,
    balanceMinBigNumber: BigNumber.from(0),
    priceUsd: 0,
    address: WBTC_ADDRESS,
    balance: 0.25, //模拟余额
    minBalance: 0.0025, //最小成交额
    startBalance: 0, //启动时初始余额,用来计算盈利
    ex: 'polygon',
  },
  USD: {
    symbol: 'USDT',
    key: 'USD',
    decimals: 6,
    address: 'USDT',
    one: 10 ** 6,
    oneBig: BigNumber.from(10).pow(6),
    balanceMin: 0,
    balanceMinBigNumber: BigNumber.from(0),
    priceUsd: 0,
    balance: 10000, //模拟余额
    minBalance: 100, //最小成交额
    startBalance: 0, //启动时初始余额,用来计算盈利
    ex: 'binance',
  },
  ETH: {
    symbol: 'ETH',
    key: 'ETH',
    decimals: 18,
    one: 10 ** 18,
    oneBig: BigNumber.from(10).pow(18),
    balanceMin: 0,
    balanceMinBigNumber: BigNumber.from(0),
    priceUsd: 0,
    address: 'ETH',
    balance: 2.5, //模拟余额
    minBalance: 0.025, //最小成交额
    startBalance: 0, //启动时初始余额,用来计算盈利
    ex: 'binance',
  },
  MATIC: {
    symbol: 'MATIC',
    key: 'MATIC',
    decimals: 18,
    one: 10 ** 18,
    oneBig: BigNumber.from(10).pow(18),
    balanceMin: 0,
    balanceMinBigNumber: BigNumber.from(0),
    priceUsd: 0,
    address: 'MATIC',
    balance: 5000, //模拟余额
    minBalance: 50, //最小成交额
    startBalance: 0, //启动时初始余额,用来计算盈利
    ex: 'binance',
  },
  BTC: {
    symbol: 'BTC',
    key: 'BTC',
    decimals: 8,
    one: 10 ** 8,
    oneBig: BigNumber.from(10).pow(8),
    balanceMin: 0,
    balanceMinBigNumber: BigNumber.from(0),
    priceUsd: 0,
    address: 'BTC',
    balance: 0.25, //模拟余额
    minBalance: 0.0025, //最小成交额
    startBalance: 0, //启动时初始余额,用来计算盈利
    ex: 'binance',
  },
};
export let GetTokenBaseInfoBySymbol = (symbol: string) => {
  for (let token of Object.values(TokenInfoEnum)) {
    if (token.symbol == symbol) {
      return token;
    }
  }
  return null;
};

//交易路径结构,兼容模式
export type PoolPath = {
  pool: ExchangeMarket; //池子
  side: 0 | 1; //0买1还是1买0
  ex: string;
  dxType: number; //cx=0
  address: string; //池子地址
  tokenFrom: TokenBaseInfo; //起始币
  tokenTo: TokenBaseInfo; //结束币
};

export type PoolPathList = {
  desc: string; //池子地址
  profit?: number; //利润,缓存用
  profitPrice?: number; //利润比
  maxInputFirst?: number; //起始币最大可投入量
  inputRate?: number; //投入比例
  // maxInputUSD?: number; //按USD计价最大可投入量
  pathId: number; //路径编号
  path: PoolPath[]; //起始币
  tokenPath: TokenPath;
  tokenInfo: PoolPathInfo;
  createAt: number; //创建时间msec
};

//中心化交易时合约
export type CxContract = {
  ContractName: string; //合约
  Symbol: string; //符号
  ContractMultiplier: number; //最小下单单位
  ContractMaxTicket: number;
  ContractMinTicket: number;
  UniswapPosition?: number; //当前defi头寸,这个是程序计算用字段,不用填
  token0?: TokenBaseInfo; //合约对应的币
  token1?: TokenBaseInfo; //合约对应的币USD
  // PositionToTake?: number; //当前等等对冲的数量,这个数据不能存档,加载的时候得清零
};
export type RecordedCxContract = {
  //CxContract &
  ContractName: string; //合约
  Symbol: string; //符号
  ContractMultiplier: number; //最小下单单位
  ContractDirection: number; //合约方向
  ContractMaxTicket: number;
  ContractMinTicket: number;
  // UniswapPosition?: number; //当前defi头寸,这个是程序计算用字段,不用填
  // ContractName: string; //合约
  ActualPosition?: number; //累计真实头寸
  PositionEntryLevel?: number; //
  RealizedPNL?: number; //真实累计盈亏,以后需要考虑手续费
  UnrealizedPNL?: number; //模拟盈亏
  UniswapBid?: number; //推测当前defi价格,几个交易所整合后的平均价
  UniswapAsk?: number; //推测当前defi价格,几个交易所整合后的平均价
  UniswapPrice?: number; //推测当前defi价格,几个交易所整合后的平均价
  RecordedHedgePosition?: number; //当前defi头寸,这个是程序计算用字段,不用填
  PositionToTake?: number; //当前等等对冲的数量,这个数据不能存档,加载的时候得清零
  lastRecordPositionInfo?: string; //日志重复过滤,
  lastRecordPositionPNL?: string; //日志重复过滤,
};
export type HedgeContract = {
  id: string; //交易对
  contracts: CxContract[];
};

export type RecordedHedgeContract = {
  id: string; //交易对
  contracts: RecordedCxContract[];
  UnrealizedPNL?: number; //这个是程序计算用字段,不用填
};

export type PositionData = {
  id: string; //交易对
  Liquidity: number; //折合为V3里的流动性
  LowerBound: number; //最小价格
  UpperBound: number; //最大价格
  SpotMoveThreshold: number; //阀值0.05表示百分之五
  OrderCushion: number; //下单价缓冲,优于当前价格的百分比0.01表示下单价优于当前价百分之一
  AverageLength: number; //均线因子
};

//订单信息
export type OrderInfo = {
  OrderID: number;
  ContractName: string;
  Symbol: string; //符号
  OrderAmountWithDirection: number;
  OrderLevel: number;
  FilledAmount: number; //已成交总量
  FilledLevel: number;
  PriceReference: number;
  PriceReferenceSpot?: number;
  FilledSlippage: number;
  owner: any; //用于回调
  simulate: boolean; //是否为模拟单
  lastRecordExecutedTradeInfo?: string; //日志重复过滤
};

//日志
export type StatusLog = {
  id: string; //交易对
  pause: boolean; //暂停运行
  simulate: boolean; //模拟下单
  createTime: string; //初始化时间
  updateTime?: string; //最后更新时间
  InsertOrderId: number; //记录最新下单序号
  hedgeContract: RecordedHedgeContract;
  positionData: PositionData; //策略配置也存下来,方便检查配置匹配才能启动
  // TradedContractBidPrice0: number;
  // TradedContractAskPrice0: number;
  // TradedContractBidPrice1: number;
  // TradedContractAskPrice1: number;
  // RecordedPosition0: number;
  // RecordedPosition1: number;
};

export type PendingTransactionHash = {
  hash: string;
  from: string;
  to: string;
  input: string;
  gasPrice: string;
  gasTipCap: string;
  gasFeeCap: string;
  gasPriceBig: BigNumber;
  gasTipCapBig: BigNumber;
  gasFeeCapBig: BigNumber;
  nonce?: number;
  createAt: number;
  blockNumber: number;
};

//缓冲日志
export type LogLineData = {
  msec: number; //时间,毫秒
  data: string; //数据
};

export type V3SwapLog = {
  sender: string;
  recipient: string;
  amount0: number;
  amount1: number;
  sqrtPriceX96: number; //let priceX96 = slot0.sqrtPriceX96.pow(2).div(MAX_UINT96);
  liquidity: number;
  tick: number;
  price: number;
  tickPrice: number;
  address?: string; //合约地址
};

//网格交易配置
export type Notional = {
  // Notional: number; //步长
  // volume: number; //下单量
  Threshold: number; //相对初始价差百分比
  PositionBuild: number; //建仓单位
  PositionReduce: number; //减仓单位
  lastSlippage?: number; //因为是取整的,所有有slippage的刹车空间
};
export let LatticeTable: Notional[] = [
  { Threshold: 0.0, PositionBuild: 0, PositionReduce: 1 }, //0
  { Threshold: 0.0005, PositionBuild: 1, PositionReduce: 2 }, //1
  { Threshold: 0.001, PositionBuild: 2, PositionReduce: 3 }, //2
  { Threshold: 0.002, PositionBuild: 3, PositionReduce: 100 }, //3
  { Threshold: 0.004, PositionBuild: 4, PositionReduce: 100 }, //4
  { Threshold: 0.01, PositionBuild: 4, PositionReduce: 100 }, //5
  { Threshold: 0.02, PositionBuild: 4, PositionReduce: 100 }, //6
];
export type GridConfig = {
  UnitNotional: number; //token0下单单位
  MaxNotional?: number; //最大下单单位,可以不受表哥限制
  UnitNotionalTokenKey: string; //参考币
  token0BalanceInit: number; //token0初始余额
  token1BalanceInit: number; //token1初始余额
  token0Balance: number; //token0余额
  token1Balance: number; //token1余额
  NewLevel: number; //token0到token1的最新一次成交价
  PositionEntryLevel: number; //平均持仓价
  ActualPosition: number; //token0到token1的真实头寸
  ActualPositionOffset?: number; //便宜值
  TargetPosition: number; //模型期望的头寸,只是单位
  TargetNotional: number; //模型期望的头寸,只是单位
  OffsetPosition?: number; //余额不足时与1个Notional的差额比例
  DiffNotional: number; //等待下单但是还为confirm的差额
  OnchainBid: number; //
  OnchainAsk: number; //
  OffchainBid: number; //
  OffchainAsk: number; //
  OnchainBidLastCommit?: number; //
  OnchainAskLastCommit?: number; //
  OffchainBidLastCommit?: number; //
  OffchainAskLastCommit?: number; //
  OnchainOverOffchainSpread: number; //
  OffchainOverOnchainSpread: number; //
  OnOverOffPositivePosition: number; //token0到token1的建仓头寸
  OnOverOffNegativePosition: number; //token0到token1的减仓头寸
  OnOverOffPositivePositionPending?: number; //token0到token1的建仓头寸
  OnOverOffNegativePositionPending?: number; //token0到token1的减仓头寸
  OnOverOffPositivePositionConfirm: number; //token0到token1 confirm的建仓头寸
  OnOverOffNegativePositionConfirm: number; //token0到token1 confirm的减仓头寸
  lastThreshold: number; //最后一次下单时价差
  RealizedPNL?: number; //已交割盈亏
  UnrealizedPNL?: number; //浮动盈亏
  commitTimes: number; //提交订单次数
  gasCost?: number; //总gas开销
  latticeTable?: Notional[];
  pause: boolean; //暂停运行
  pauseEndTime?: number; //暂停结束时间
  checkReset: boolean; //是否自动矫正
  createTime: string; //初始化时间
  updateTime?: string; //最后更新时间
  lastSlippage?: number; //因为是取整的,所有有slippage的刹车空间
  viewpoint?: number; //看涨看跌态度影响
  pairId?: number; //交易对编号
  AnDx?: number; //交易对编号
  AnCx?: number; //交易对编号
  AnTime?: number; //交易对编号
  lastConfirmOkPrice?: number; //最新成交价
  lastOp?: string; //最新操作
  lastOp1?: string; //最新操作
  Signal?: string; //信号源,PENDG,
};
export type AverageConfig = {
  symbole: string; //交易对
  An: number; //最新An值
  Alpha: number; //步长
  price: number; //最新价格
  createMsec?: number; //初始化时间
  updateMsec?: number; //最后更新时间
  createTime?: string; //初始化时间
  updateTime?: string; //最后更新时间
};
export let GetNotioinalByProfitPrice = (profitPrice: number, latticeTable: Notional[] = LatticeTable) => {
  latticeTable = latticeTable || LatticeTable;
  if (profitPrice < 0) {
    return { Threshold: 0.0, PositionBuild: 0, PositionReduce: 0, lastSlippage: 0 };
  }
  // profitPrice = Math.abs(profitPrice);
  for (let index = latticeTable.length - 1; index >= 0; index--) {
    let v = latticeTable[index];
    if (profitPrice >= v.Threshold) {
      v.lastSlippage = profitPrice - v.Threshold;
      return v;
    }
  }
  return latticeTable[0];
};
