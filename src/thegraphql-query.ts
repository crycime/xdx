import { BigNumber } from '@ethersproject/bignumber';

import { ERC20 } from '../typechain/ERC20';
import { ERC20Fee } from '../src/ERC20Fee';
import { ClientError, gql, GraphQLClient } from 'graphql-request';
import { Db } from 'mongodb';
import {
  BTCB_ADDRESS,
  WBNB_ADDRESS,
  USDT_ADDRESS,
  USDC_ADDRESS,
  BUSD_ADDRESS,
  CAKE_ADDRESS,
  PANCAKE_V2_FACTORY_ADDRESS,
} from '../src/constants';
import { GetQoutEthPrice } from '../src/CxPrice';
import { InitMongodb, mongodb } from '../src/mongodb';
import { getPoolActiveMap, CommonPoolData, UniSwapPoolData } from '../src/pool-history';
import { ethers } from 'hardhat';
import { providers } from 'ethers';

let MIN_LOCK_ETH = 4.0;
export type APIMetaDataV4 = {
  orderHash: string;
  remainingFillableTakerAmount: string;
  state: string;
  createdAt: string;
};
export type ArbMongoPool = {
  key: string;
  address: string;
  factory: string;
  hasWeth: boolean;
  dxType: number;
  fee: number;
  feePrecision: number;
  side?: number; //0X只能提供单方向交易,指定下
  blockNumber?: number; //最后活跃区块
  T0: ArbMongoToken;
  T1: ArbMongoToken;
  token0: string;
  token1: string;
  token0Price?: number; //不带精度的价格
  token1Price?: number; //不带精度的价格
  token0PriceX18?: BigNumber; //10**18次精度价格
  token1PriceX18?: BigNumber; //10**18次精度价格
  token0PriceX96?: BigNumber; //2**96次精度价格
  token1PriceX96?: BigNumber; //2**96次精度价格
  R0?: number; //0.1个eth情况下的滑点率
  R1?: number; //0.1个eth情况下的滑点率
  BigR0?: number; //10个eth情况下的滑点率
  BigR1?: number; //10个eth情况下的滑点率
  token0PriceX96AfterCommissionAndSlippage?: BigNumber;
  token1PriceX96AfterCommissionAndSlippage?: BigNumber;
  token0PriceAfterCommissionAndSlippage?: number;
  token1PriceAfterCommissionAndSlippage?: number;
  reserve0?: number;
  reserve1?: number;
  reserveBigNumber0?: BigNumber;
  reserveBigNumber1?: BigNumber;
  remainingFillableTakerAmount?: BigNumber;
  totalValueLockedETH?: number;
  poolId?: BigNumber; //balancer池子Id
  swapFee?: BigNumber; //balancer池子费率
  denorm0?: BigNumber;
  denorm1?: BigNumber;
};
export type ArbMongoRoute = {
  address: string;
  routerType: number;
  poolNum: number;
  desc: string;
};
export type ArbMongoFactory = {
  address: string;
  dxType: number;
  poolNum: number;
  fee: number;
  feePrecision: number;
};
export type ArbMongoToken = {
  address: string;
  symbol: string;
  decimals: number;
  poolNum: number;
  one?: number;
  priceEth?: number;
};

//key token0+token
export type ArbMongoTokenPair = {
  key: string;
  token0: string;
  token1: string;
  poolNum: number;
  pools: string[];
};

let erc20Connect: any;
let abiERC20FeeConnect: any;
let provider: any;
let erc20ActiveMap = new Map<string, number>();
let poolActiveMap = new Map<string, UniSwapPoolData>();

export let InitAllCollections = async (arbdb: Db, _erc20Connect: any, _abiERC20FeeConnect: any, _provider: any) => {
  erc20Connect = _erc20Connect;
  abiERC20FeeConnect = _abiERC20FeeConnect;
  provider = _provider;
  try {
    await arbdb.createCollection('pools');
    await arbdb.createCollection('tokens');
    await arbdb.createCollection('factories');
    await arbdb.createCollection('tokenpairs');
  } catch {}
  //轻易不要初始化,需要很久1小时
  // await arbdb.collection('pool_actives').deleteMany({});
  // await arbdb.collection('pool_actives').createIndex({ key: 1 }, { background: false, unique: true });
  // poolActiveMap = await getPoolActiveMap(provider);
  // for (let [key, poolData] of poolActiveMap) {
  //   await SavePoolActive2Mongo(arbdb, key, poolData);
  // }
  await arbdb.collection('pools').deleteMany({});
  await arbdb.collection('pools').createIndex({ key: 1 }, { background: false, unique: true });
  //token没必要每次清除,因为中心化交易所拿一次价格不容易
  // await arbdb.collection('tokens').deleteMany({});
  // await arbdb.collection('tokens').createIndex({ address: 1 }, { background: false, unique: true });
  //从中心化交易所中获取相对eth报价
  // await InitTokensPrice(arbdb);
  //await arbdb.dropCollection('tokenpairs');
  await arbdb.collection('factories').deleteMany({});
  await arbdb.collection('factories').createIndex({ address: 1 }, { background: false, unique: true });
  await arbdb.collection('routers').deleteMany({});
  await arbdb.collection('routers').createIndex({ address: 1 }, { background: false, unique: true });
  await arbdb.collection('tokenpairs').deleteMany({});
  await arbdb.collection('tokenpairs').createIndex({ key: 1 }, { background: false, unique: true });

  poolActiveMap = await LoadPoolActive(arbdb);
  await InitFactories(arbdb);
  await InitRoutes(arbdb);
};
let baseTokens = [WBNB_ADDRESS, CAKE_ADDRESS, BTCB_ADDRESS, USDT_ADDRESS, USDC_ADDRESS, BUSD_ADDRESS];
let checkCommonLiquidity = (poolData: CommonPoolData, pool: ArbMongoPool) => {
  if (!baseTokens.includes(pool.T0.address) && !baseTokens.includes(pool.T1.address)) {
    console.log('非主流池子,放弃:', pool.address, pool.factory, pool.token0, pool.token1);
    return false;
  }
  let btcMin = 1;
  let bnbMin = 20;
  let usdMin = 10000;
  if (pool.T0.address == WBNB_ADDRESS) {
    if (parseFloat(poolData.balance0.toString()) < bnbMin * 10 ** pool.T0.decimals) {
      //WETH
      return false;
    }
    pool.totalValueLockedETH = parseFloat(poolData.balance0.toString());
  }
  if (pool.T1.address == WBNB_ADDRESS) {
    if (parseFloat(poolData.balance1.toString()) < bnbMin * 10 ** pool.T1.decimals) {
      return false;
    }
    pool.totalValueLockedETH = parseFloat(poolData.balance1.toString());
  }
  //USDT
  if (pool.T0.address == USDT_ADDRESS && parseFloat(poolData.balance0.toString()) < usdMin * 10 ** pool.T0.decimals) {
    return false;
  }
  if (pool.T1.address == USDT_ADDRESS && parseFloat(poolData.balance1.toString()) < usdMin * 10 ** pool.T1.decimals) {
    return false;
  }
  //USDC
  if (pool.T0.address == USDC_ADDRESS && parseFloat(poolData.balance0.toString()) < usdMin * 10 ** pool.T0.decimals) {
    return false;
  }
  if (pool.T1.address == USDC_ADDRESS && parseFloat(poolData.balance1.toString()) < usdMin * 10 ** pool.T1.decimals) {
    return false;
  }
  //DAI
  if (pool.T0.address == BUSD_ADDRESS && parseFloat(poolData.balance0.toString()) < usdMin * 10 ** pool.T0.decimals) {
    return false;
  }
  if (pool.T1.address == BUSD_ADDRESS && parseFloat(poolData.balance1.toString()) < usdMin * 10 ** pool.T1.decimals) {
    return false;
  }
  //WBTC
  if (pool.T0.address == BTCB_ADDRESS && parseFloat(poolData.balance0.toString()) < btcMin * 10 ** pool.T0.decimals) {
    return false;
  }
  if (pool.T1.address == BTCB_ADDRESS && parseFloat(poolData.balance1.toString()) < btcMin * 10 ** pool.T1.decimals) {
    return false;
  }

  return true;
};

export let LoadPoolActive = async (arbdb: Db) => {
  let rows = (await arbdb
    .collection('pool_actives')
    .find({}, { projection: { _id: 0 } })
    .toArray()) as unknown as UniSwapPoolData[];
  let mapRow = new Map<string, UniSwapPoolData>();
  for (let row of rows) {
    mapRow.set(row.key.toLowerCase(), row);
  }
  return mapRow;
};

let erc20CheckMap = new Map<string, boolean>();
//0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84 stETH,带交易手续费的币,有点bt
//0x8B3192f5eEBD8579568A2Ed41E6FEB402f93f73F stETH,带交易手续费的币,有点bt
let CheckErc20Ok = (address: string) => {
  if (address == '0xd233D1f6FD11640081aBB8db125f722b5dc729dc') {
    //此币被锁定
    return false;
  } else if (address == '0x777E2ae845272a2F540ebf6a3D03734A5a8f618e') {
    //此币禁止bots
    return false;
  } else if (address == '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84') {
    //此币有手续费
    return false;
  } else if (address == '0x8B3192f5eEBD8579568A2Ed41E6FEB402f93f73F') {
    //此币有手续费
    return false;
  }
  return true;
};
let tokenMap = new Map<string, ArbMongoToken>();

let SavePool2Mongo = async (arbdb: Db, pool: ArbMongoPool, hasWeth: boolean) => {
  pool.T0.address = ethers.utils.getAddress(pool.T0.address);
  pool.T1.address = ethers.utils.getAddress(pool.T1.address);
  let poolPdata = poolActiveMap.get(pool.address);
  if (!poolPdata) {
    if (!erc20ActiveMap.has(pool.T0.address) || !erc20ActiveMap.has(pool.T1.address)) {
      console.log('SavePool2Mongo不支持的币种:', pool.address, pool.T0.address, pool.T1.address);
      return;
    }
  } else {
    erc20ActiveMap.set(pool.T0.address, poolPdata.blockNumber);
    erc20ActiveMap.set(pool.T1.address, poolPdata.blockNumber);
  }
  let ignore = false;
  tokenMap.set(pool.T0.address, pool.T0);
  tokenMap.set(pool.T1.address, pool.T1);
  //做个执行测试,看ERC20是否正常工作
  if (!CheckErc20Ok(pool.T0.address) || !CheckErc20Ok(pool.T1.address)) {
    return;
  }
  pool.address = ethers.utils.getAddress(pool.address);
  pool.factory = ethers.utils.getAddress(pool.factory);
  pool.hasWeth = hasWeth;
  let result0: any = await arbdb.collection('tokens').findOne({ address: pool.T0.address });
  if (!result0) {
    // ignore = true; //如果这里打开就是要放弃不直连eth的币
    result0 = pool.T0;
    result0.poolNum = 1;
    result0.one = 10 ** result0.decimals;
  } else {
    result0.poolNum = result0.poolNum + 1;
  }
  let result1: any = await arbdb.collection('tokens').findOne({ address: pool.T1.address });
  if (!result1) {
    // ignore = true; //如果这里打开就是要放弃不直连eth的币
    result1 = pool.T1;
    result1.poolNum = 1;
    result1.one = 10 ** result1.decimals;
  } else {
    result1.poolNum = result1.poolNum + 1;
  }
  if (!hasWeth && ignore) {
    console.log('ignore pool:', pool.address, result0?.address, result1?.address);
    return;
  }
  let updateResult = await arbdb
    .collection('tokens')
    .updateOne({ address: result0.address }, { $set: result0 }, { upsert: true });
  updateResult = await arbdb
    .collection('tokens')
    .updateOne({ address: result1.address }, { $set: result1 }, { upsert: true });
  //修改下pool里token的数据结构,改为存成地址
  pool.token0 = result0.address;
  pool.token1 = result1.address;
  pool.key = pool.address + '-' + pool.token0 + '-' + pool.token1;
  // console.log('xxxx:0:', pool.address, pool.token0, pool.token1);
  updateResult = await arbdb.collection('pools').updateOne({ key: pool.key }, { $set: pool }, { upsert: true });
};

let SavePoolActive2Mongo = async (arbdb: Db, key: string, poolData: UniSwapPoolData) => {
  await arbdb.collection('pool_actives').updateOne({ key: key }, { $set: poolData }, { upsert: true });
};

let routers: ArbMongoRoute[] = [
  { address: '0x10ED43C718714eb63d5aA57B78B54704E256024E', poolNum: 0, routerType: 11, desc: 'Pancake V2: Router 2' },
  // { address: '0x10ED43C718714eb63d5aA57B78B54704E256024E', poolNum: 0, routerType: 12, desc: 'Pancake V1: Router 1' },
  { address: '0xcF0feBd3f17CEf5b47b0cD257aCf6025c5BFf3b7', poolNum: 0, routerType: 13, desc: 'ApeRouter' },
];
let factories: ArbMongoFactory[] = [
  { address: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', poolNum: 0, dxType: 11, fee: 25, feePrecision: 10000 }, //PancakeV2
  { address: '0xBCfCcbde45cE874adCB698cC183deBcF17952812', poolNum: 0, dxType: 12, fee: 2, feePrecision: 1000 }, //PancakeV1
  { address: '0x0841BD0B734E4F5853f0dD8d7Ea041c241fb0Da6', poolNum: 0, dxType: 13, fee: 3, feePrecision: 1000 }, //ApeRouter
  { address: '0x858E3312ed3A876947EA49d572A7C42DE08af7EE', poolNum: 0, dxType: 14, fee: 3, feePrecision: 1000 }, //Biswap
  { address: '0x86407bEa2078ea5f5EB5A52B2caA963bC1F889Da', poolNum: 0, dxType: 15, fee: 2, feePrecision: 1000 }, // Baby
  { address: '0x3CD1C46068dAEa5Ebb0d3f55F6915B10648062B8', poolNum: 0, dxType: 16, fee: 3, feePrecision: 1000 }, // Mdex
];
let waitNewFactoryV2ForkMap = new Map<string, UniSwapPoolData>();
let InitFactories = async (arbdb: Db) => {
  let factoryMap = new Map<string, any>();
  for (let factory of factories) {
    factoryMap.set(factory.address, factory);
  }
  let factoryDataMap = new Set<string>();
  for (let [key, poolData] of poolActiveMap) {
    if (poolData.factoryAddress != '') {
      let factory = factoryMap.get(poolData.factoryAddress);
      waitNewFactoryV2ForkMap.set(poolData.key, poolData);
      if (!factory) {
        factory = { address: poolData.factoryAddress, poolNum: 0, dxType: 10, fee: 3, feePrecision: 1000 };
      }
      console.log('发现新的V2类池子:', poolData.key, poolData.factoryAddress, poolData.blockNumber);
      if (!factoryDataMap.has(poolData.factoryAddress)) {
        factoryDataMap.add(poolData.factoryAddress);
        await SaveFactory2Mongo(arbdb, factory);
      }
    }
  }
  console.log('InitFactories:', factoryMap.size, factoryDataMap.size, poolActiveMap.size);
};

let SaveFactory2Mongo = async (arbdb: Db, factory: ArbMongoFactory) => {
  await arbdb.collection('factories').updateOne({ address: factory.address }, { $set: factory }, { upsert: true });
};
let InitRoutes = async (arbdb: Db) => {
  for (let router of routers) {
    await SaveRouter2Mongo(arbdb, router);
  }
};
let SaveRouter2Mongo = async (arbdb: Db, router: ArbMongoRoute) => {
  await arbdb.collection('routers').updateOne({ address: router.address }, { $set: router }, { upsert: true });
};
let SaveTokenPair2Mongo = async (arbdb: Db, pair: ArbMongoTokenPair, pool: ArbMongoPool) => {
  pair.key = pair.token0 < pair.token1 ? pair.token0 + pair.token1 : pair.token1 + pair.token0;
  let result = (await arbdb.collection('tokenpairs').findOne({ key: pair.key })) as unknown as ArbMongoTokenPair;
  if (!result) {
    result = pair;
  }
  result.pools = result.pools || [];
  if (!result.pools.includes(pool.address)) {
    result.pools.push(pool.address);
    result.poolNum = result.pools.length;
  }
  await arbdb.collection('tokenpairs').updateOne({ key: result.key }, { $set: result }, { upsert: true });
};
let excludePoolMap = new Set<string>();
excludePoolMap.add('0xcd1b405eC7F5597822d36a1Ec053aA7e0AF11147');
excludePoolMap.add('0xFF648F4e089199a81050d343cE9724CC3cEFeDd2'); //Unifi: UnAuthorized
let excludeTokenMap = new Set<string>();
excludeTokenMap.add('0xFAd8E46123D7b4e77496491769C167FF894d2ACB');
excludeTokenMap.add('0xEce59e58046179A762513727607629641190e421');
excludeTokenMap.add('0xB1CeD2e320E3f4C8e3511B1DC59203303493F382');
excludeTokenMap.add('0x2A9718defF471f3Bb91FA0ECEAB14154F150a385');
excludeTokenMap.add('0xCAb599D699f818e6ceFd07cF54f448DAB9367B05'); //此币有最小下单量要求
export let LoadPools = async (arbdb: Db, unique: boolean) => {
  let rows = (await arbdb
    .collection('pools')
    .find({}, { projection: { _id: 0 } })
    .toArray()) as unknown as ArbMongoPool[];
  let mapRow = new Map<string, ArbMongoPool>();
  for (let row of rows) {
    if (excludePoolMap.has(row.address)) {
      console.log('忽略垃圾池子:', row.address);
      continue;
    }
    if (excludeTokenMap.has(row.token0) || excludeTokenMap.has(row.token1)) {
      console.log('忽略垃圾币所在池子:', row.address, row.token0, row.token1);
      continue;
    }
    mapRow.set(row.address, row);
    if (!unique) {
      //下面都是冗余,因为目前只是查询,浪费不大,先推进
      mapRow.set(row.address.toLowerCase(), row);
      mapRow.set(row.key, row);
      mapRow.set(row.key.toLowerCase(), row);
    }
  }
  return mapRow;
};

export let InitTokensPrice = async (arbdb: Db) => {
  let tokens = new Map<string, ArbMongoToken>();
  await LoadTokens(arbdb, tokens);
  for (let [k, v] of tokens) {
    v.priceEth = await GetQoutEthPrice(v.symbol);
    await arbdb.collection('tokens').updateOne({ address: v.address }, { $set: v }, { upsert: true });
  }
};
export let LoadTokens = async (arbdb: Db, mapRow: Map<string, ArbMongoToken>) => {
  let rows = (await arbdb
    .collection('tokens')
    .find({}, { projection: { _id: 0 } })
    .toArray()) as unknown as ArbMongoToken[];
  for (let row of rows) {
    mapRow.set(row.address, row);
  }
  return mapRow;
};
export let LoadTokenPairsToArray = async (arbdb: Db) => {
  let rows = (await arbdb
    .collection('tokenpairs')
    .find({}, { projection: { _id: 0 }, sort: { poolNum: -1 } })
    .toArray()) as unknown as ArbMongoTokenPair[];
  return rows;
};
export let LoadTokenPairs = async (arbdb: Db) => {
  let rows = (await arbdb
    .collection('tokenpairs')
    .find({}, { projection: { _id: 0 } })
    .toArray()) as unknown as ArbMongoTokenPair[];
  let mapRow = new Map<string, ArbMongoTokenPair>();
  for (let row of rows) {
    mapRow.set(row.key, row);
  }
  return mapRow;
};
export let LoadFactories = async (arbdb: Db) => {
  let rows = (await arbdb
    .collection('factories')
    .find({}, { projection: { _id: 0 } })
    .toArray()) as unknown as ArbMongoFactory[];
  let mapRow = new Map<string, ArbMongoFactory>();
  for (let row of rows) {
    // console.log(row);
    mapRow.set(row.address, row);
  }
  return mapRow;
};

export let LoadRouters = async (arbdb: Db) => {
  let rows = (await arbdb
    .collection('routers')
    .find({}, { projection: { _id: 0 } })
    .toArray()) as unknown as ArbMongoRoute[];
  let mapRow = new Map<string, ArbMongoRoute>();
  for (let row of rows) {
    // console.log(row);
    mapRow.set(row.address, row);
  }
  return mapRow;
};
let SaveToken2Mongo = async (arbdb: Db, address: string, blockNumber: number) => {
  let T: ArbMongoToken = tokensMap.get(address);
  let erc20Instance = erc20Connect.attach(address) as ERC20;
  let erc20FeeInstance = abiERC20FeeConnect.attach(address);
  if (!T) {
    try {
      T = {
        symbol: await erc20Instance.symbol(),
        decimals: await erc20Instance.decimals(),
        address: erc20Instance.address,
        poolNum: 0,
      };
      //判断是否为山寨币
      // {
      //   try {
      //     await erc20FeeInstance._taxFee();
      //     console.log('税收币,放弃:', address);
      //     return null;
      //   } catch {}
      //   try {
      //     await erc20FeeInstance.uniswapV2Pair();
      //     console.log('uniswapV2池子币,放弃:', address);
      //     return null;
      //   } catch {}
      // }
    } catch {
      console.log('SaveToken2Mongo Token错误:', address);
      return null;
    }
  }
  let num = erc20ActiveMap.get(T.address);
  if (!num || num < blockNumber) {
    erc20ActiveMap.set(erc20Instance.address, blockNumber);
  }
  T.poolNum += 1;
  let updateResult = await arbdb.collection('tokens').updateOne({ address: T.address }, { $set: T }, { upsert: true });
  return T;
};
let tokensMap = new Map<string, ArbMongoToken>();
export let ScanV2Factories = async (arbdb: Db, factoryInstance: any, abiInstanceV2: any) => {
  let factories = await LoadFactories(arbdb);
  let pools = await LoadPools(arbdb, false);
  let tokens = new Map<string, ArbMongoToken>();
  await LoadTokens(arbdb, tokens);
  for (let [k, v] of tokens) {
    v.poolNum = 0;
    tokensMap.set(k, v);
  }
  for (let [newPoolAddress, poolData] of waitNewFactoryV2ForkMap) {
    let factory = factories.get(poolData.factoryAddress);
    let poolInstance = abiInstanceV2.attach(newPoolAddress);
    let token0: any;
    let token1: any;
    try {
      token0 = await poolInstance.token0();
      token1 = await poolInstance.token1();
    } catch (e) {
      console.log('非V2类池子:', newPoolAddress, poolData);
      continue;
    }
    let T0 = await SaveToken2Mongo(arbdb, token0, poolData.blockNumber);
    let T1 = await SaveToken2Mongo(arbdb, token1, poolData.blockNumber);
    if (!T0 || !T1) {
      console.log('非标准ERC20,放弃:', token0, token1);
      continue;
    }
    let pool: ArbMongoPool = {
      key: poolData.key,
      address: newPoolAddress,
      factory: poolData.factoryAddress,
      hasWeth: false,
      dxType: 11,
      fee: 3,
      feePrecision: 1000,
      T0: T0,
      T1: T1,
      token0: token0,
      token1: token1,
    };
    pool.address = newPoolAddress.toLowerCase();
    pool.factory = factory.address;
    pool.dxType = factory.dxType;
    try {
      pool.fee = parseFloat((await poolInstance.swapFee()).toString());
      if (pool.fee < 10) {
        pool.feePrecision = 1000;
      } else {
        pool.feePrecision = 10000;
      }
    } catch (e) {
      try {
        let instance = factoryInstance.attach(poolData.factoryAddress);
        pool.fee = parseFloat((await instance.getPairFees(newPoolAddress)).toString());
        if (pool.fee < 10) {
          pool.feePrecision = 1000;
        } else {
          pool.feePrecision = 10000;
        }
      } catch {
        pool.fee = factory.fee ? factory.fee : 3;
        pool.feePrecision = factory.feePrecision ? factory.feePrecision : 1000;
      }
    }
    let hasWeth = pool.token0 == WBNB_ADDRESS || pool.token1 == WBNB_ADDRESS;
    pool.hasWeth = hasWeth;
    let tmpreserve: any;
    try {
      tmpreserve = await poolInstance.getReserves();
      if (tmpreserve._reserve0.eq(0)) {
        console.log(
          '锁仓量为0,放弃:',
          hasWeth,
          factory.address,
          newPoolAddress,
          token0,
          token1,
          pool.token0,
          pool.token1,
        );
        continue;
      }
    } catch {
      console.log('先忽略山寨的V3池子', token0, token1, poolData);
      continue;
    }
    let commonPoolData: CommonPoolData = {
      key: poolData.key,
      token0: pool.token0,
      token1: pool.token1,
      address: pool.address,
      dxType: pool.dxType,
      factoryAddress: pool.factory,
      balance0: tmpreserve._reserve0,
      balance1: tmpreserve._reserve1,
      blockNumber: poolData.blockNumber,
    };
    let balance0: number = parseFloat(commonPoolData.balance0.toString()) / 10 ** pool.T0.decimals;
    let balance1: number = parseFloat(commonPoolData.balance1.toString()) / 10 ** pool.T1.decimals;
    if (!checkCommonLiquidity(commonPoolData, pool)) {
      console.log(
        '锁仓量不够,先放弃:',
        hasWeth,
        factory.address,
        newPoolAddress,
        pool.token0,
        pool.token1,
        balance0,
        balance1,
      );
      continue;
    }
    console.log('find new pool:', factory.address, newPoolAddress, pool.token0, pool.token1, balance0, balance1);

    pool.token0 = pool.token0.toLowerCase();
    pool.token1 = pool.token1.toLowerCase();
    await SavePool2Mongo(arbdb, pool, hasWeth);
  }
  //更新工厂合约的池子数量统计
  console.log('update factories beg...');
  let rows = await arbdb
    .collection('pools')
    .aggregate()
    .group({ _id: '$factory', count: { $sum: 1 } })
    .toArray();
  for (let row of rows) {
    let factory = factories.get(row._id);
    if (factory) {
      factory.poolNum = row.count;
      await SaveFactory2Mongo(arbdb, factory);
      console.log('update factory row:', row);
    }
  }
  console.log('update factories end:', rows.length);
  //需要重新获取池子
  pools = await LoadPools(arbdb, true);
  await arbdb.collection('tokenpairs').deleteMany({});
  let tokenpairs = await LoadTokenPairs(arbdb); //删除完就是空的了,重置需要
  console.log('update tokenpairs beg...');
  for (let [_, pool] of pools) {
    let key = pool.token0 < pool.token1 ? pool.token0 + pool.token1 : pool.token1 + pool.token0;
    let pair = tokenpairs.get(key);
    if (!pair) {
      pair = {
        key: key,
        token0: pool.token0,
        token1: pool.token1,
        pools: [],
        poolNum: 0,
      };
    }
    tokenpairs.set(key, pair);
    await SaveTokenPair2Mongo(arbdb, pair, pool);
  }
  console.log('update tokenpairs end', tokenpairs.size);
};

export let PrintLog = async (arbdb: Db) => {
  let factoryMap = await LoadFactories(arbdb);
  let tokens = new Map<string, ArbMongoToken>();
  await LoadTokens(arbdb, tokens);
  let tokenpairs = await LoadTokenPairs(arbdb);
  let tmpTokensMap = new Map();
  for (let [k, v] of tokens) {
    if (v.poolNum >= 2) {
      //描述,地址,引用池子数量,符号
      console.log('token:', v.address, v.poolNum, v.symbol);
      tmpTokensMap.set(k, v.poolNum);
    }
  }
  for (let [k, v] of tokenpairs) {
    if (tmpTokensMap.has(v.token0) && tmpTokensMap.has(v.token1)) {
      //描述,交易对,引用池子数量,具体池子地址
      console.log('tokenpair:', v.token0, v.token1, v.poolNum, ...v.pools);
    }
  }
  for (let [k, v] of factoryMap) {
    // if (v.poolNum >= 2) {
    //描述,工厂合约地址,交易所类型,引用池子数量
    console.log('factory:', v.address, v.dxType, v.poolNum);
    // }
  }
};
