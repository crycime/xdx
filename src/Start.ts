import * as fs from 'fs';
import * as path from 'path';

import { Logger } from 'log4js';
import * as ccxt from 'ccxt';
import { Update } from 'telegraf/src/core/types/typegram';
import { Context, Telegraf } from 'telegraf';
import moment from 'moment';
import { Db } from 'mongodb';
import { Market, BinanceClient, HuobiSwapsClient, HuobiClient, Ticker } from '../src/ccxws/src/index';
import { Contract, Wallet, BigNumber, providers, BigNumberish } from 'ethers';
import { ethers, network, config, artifacts } from 'hardhat';
import { sendBotMessage, TeleGramBotInit } from '../src/telegram-bot';
import { lastBlockNumber, InitSpotDx, SpotDx, lastBlockTime, commitTrending, feeData } from '../src/SpotDx';
import { SpotCx } from '../src/SpotCx';
import { TokenPath } from '../src/TokenPath';
import { LoadStatusConfig, SaveStatusConfig } from '../src/status';
import { TryTrendingRet } from '../src/PlaceOrder';
import { getOwnerPrivateKey, CONTRACT_ARBITRAGE_ADDRESS } from '../.privatekey';
import { TrendingCall } from '../typechain/TrendingCall';
import {
  BalancerVaultABI,
  UniSwapV3QuoterABI,
  TrendingABI,
  UniSwapV2FactoryABI,
  UniSwapV3FactoryABI,
} from '../src/TrendingABI';
import { NonfungiblePositionManagerABI } from './NonfungiblePositionManagerABI';
import { WETH9 } from '../typechain/WETH9';

import {
  LogLineData,
  CxContract,
  RecordedCxContract,
  OrderInfo,
  EPSILON,
  PositionData,
  MarketPrice,
  HedgeContract,
  StatusLog,
  TokenBaseInfo,
  ExchangeMarket,
  TokenInfoEnum,
  PoolPathList,
  UNI_V3_QUOTER_ADDRESSES,
  CONTRACT_BALANCER_VAULT_ADDRESS,
  WMATIC_ADDRESS,
  GetTokenBaseInfoBySymbol,
} from './constants';
import { appendFile } from 'fs';
import { exit } from 'process';
import { timeStamp } from 'console';
import { SpotEx } from './SpotEx';
import { ExchangeMarkets } from '../HedgeSettings';

export type ConfigPair = {
  hedgeContract: HedgeContract;
  simulate: boolean;
};
let bot: Telegraf<Context<Update>>;

export let spotExMap = new Map<string, SpotEx>();
export let loopSpotCxs: SpotCx[] = [];
export let loopSpotDxs: SpotDx[] = [];
// export let loopSpotExs: SpotCx[] = [];
export let exchangeMarketMap = new Map<string, ExchangeMarket>();
export let exchangeMarketAddressMap = new Map<string, ExchangeMarket>();
export let exchangeMarketPoolIdMap = new Map<BigNumberish, ExchangeMarket>();
export let MongoPoolMap = new Map<string, ExchangeMarket>();

let uniSwapQuoterV3: Contract;
let erc20ContractFactory: any;
let wethInstance: WETH9;
let commiter: Wallet;
let myprovider: providers.WebSocketProvider | providers.JsonRpcProvider | providers.BaseProvider = ethers.provider;
let commitprovider_ws: providers.WebSocketProvider;
let commitprovider: providers.WebSocketProvider | providers.JsonRpcProvider | providers.BaseProvider = ethers.provider;
let config_network = config.networks[network.name] as any;
if (config_network && config_network.ws) {
  myprovider = ethers.getDefaultProvider(config_network.ws);
}
if (config_network && config_network.commit_url) {
  commitprovider = ethers.getDefaultProvider(config_network.commit_url);
}
if (config_network && config_network.commit_ws) {
  commitprovider_ws = ethers.getDefaultProvider(config_network.commit_ws) as providers.WebSocketProvider;
}
let pending_ws: providers.WebSocketProvider;
let slaver_providers: providers.WebSocketProvider[] = [];
if (config_network && config_network.slavers) {
  for (const ws of config_network.slavers) {
    let slaver_ws = ethers.getDefaultProvider(ws) as providers.WebSocketProvider;
    slaver_providers.push(slaver_ws);
  }
}
let instanceTrendingCall: TrendingCall;
export let tokenPaths: TokenPath[] = [];
export let loopStartTime: number = Date.now();
let waitCommitMap = new Map<string, TryTrendingRet>();
let waitCommitPoolMap = new Map<string, any>();
let waitStartList = [];
let startupPathProfits: PoolPathList[] = [];
export let GetCxMarketByKey = (key0: string, key1: string) => {
  for (let cxMarket of ExchangeMarkets) {
    if (cxMarket.type == 'CX' && cxMarket.token0.key == key0 && cxMarket.token1.key == key1) {
      return cxMarket;
    }
  }
};
export let GetSpotExByKey = (type: 'CX' | 'DX' | 'BRIDGE', key0: string, key1: string) => {
  let best: SpotEx;
  for (let [, ex] of spotExMap) {
    if (ex.market.type == type && ex.market.token0.key == key0 && ex.market.token1.key == key1) {
      best = best || ex;
      if (ex.market.priority < best.market.priority) {
        best = ex;
      }
    }
  }
  console.log('选择优先级最高交易所:GetSpotExByKey:', type, key0, key1, best?.market?.symbol);
  return best;
};
let logger: Logger;
export let Start = async (_logger: Logger) => {
  logger = _logger;
  for (let market of ExchangeMarkets) {
    // market.id = market.symbol.toLowerCase();
    market.id = market.id || market.symbol; //.toLowerCase();
    market.key = `${market.token0.address}:${market.token1.address}`;
    if (exchangeMarketMap.has(market.id)) {
      console.log('交易对符号配置重复:', market, exchangeMarketMap.get(market.id));
      exit(0);
      return false;
    }
    if (market.type != 'DX') {
      continue;
    }
    if (exchangeMarketMap.has(market.symbol)) {
      console.log('发现池子配置重复:', market.symbol, exchangeMarketMap.get(market.symbol));
    }
    exchangeMarketMap.set(market.symbol, market);
    //balancer是一个池子多个币,不唯一, 先屏蔽
    // if (exchangeMarketAddressMap.has(market.address)) {
    //   console.log('交易对地址配置重复:', market, exchangeMarketAddressMap.get(market.address));
    //   exit(0);
    //   return false;
    // }
    if (market.poolId) {
      //下面两行是为了兼容,数据有覆盖问题,不能查询使用智能查询是否存在
      exchangeMarketPoolIdMap.set(market.poolId, market);
      exchangeMarketAddressMap.set(market.poolId + market.token0.symbol + market.token1.symbol, market);
      exchangeMarketAddressMap.set((market.poolId + market.token0.symbol + market.token1.symbol).toLowerCase(), market);
    }
    exchangeMarketAddressMap.set(market.address, market);
    exchangeMarketAddressMap.set(market.address.toLowerCase(), market);
    //各种兼容
    exchangeMarketAddressMap.set(market.token0.address + market.token1.address, market);
    exchangeMarketAddressMap.set(market.token0.address.toLowerCase() + market.token1.address.toLowerCase(), market);
    exchangeMarketAddressMap.set(market.token1.address + market.token0.address, market);
    exchangeMarketAddressMap.set(market.token1.address.toLowerCase() + market.token0.address.toLowerCase(), market);
    exchangeMarketAddressMap.set((market.router || '') + market.token0.address + market.token1.address, market);
    exchangeMarketAddressMap.set(
      (market.router?.toLowerCase() || '') + market.token0.address.toLowerCase() + market.token1.address.toLowerCase(),
      market,
    );
    exchangeMarketAddressMap.set((market.router || '') + market.token1.address + market.token0.address, market);
    exchangeMarketAddressMap.set(
      (market.router?.toLowerCase() || '') + market.token1.address.toLowerCase() + market.token0.address.toLowerCase(),
      market,
    );
    MongoPoolMap.set(market.address, market);
    MongoPoolMap.set(market.address.toLowerCase(), market);
    console.log(
      '初始化:MongoPoolMap:',
      market.symbol,
      market.address,
      exchangeMarketAddressMap.size,
      MongoPoolMap.size,
    );
  }
  await InitSpotDx(logger, tokenPaths);
  let user;
  // let owner = new ethers.Wallet(await getOwnerPrivateKey(network.name), myprovider);
  // commiter = new ethers.Wallet(await getOwnerPrivateKey(network.name), commitprovider);
  let owner = new ethers.Wallet(await getOwnerPrivateKey(network.name), commitprovider_ws);
  commiter = new ethers.Wallet(await getOwnerPrivateKey(network.name), commitprovider_ws);
  [, user] = await ethers.getSigners();
  erc20ContractFactory = await ethers.getContractFactory('WETH9');
  wethInstance = erc20ContractFactory.connect(commiter).attach(WMATIC_ADDRESS) as WETH9;

  let ownerBalance = await owner.getBalance();
  console.log('deploy account:', owner.address, ethers.utils.formatEther(ownerBalance.toString()));

  let TrendingCallContractFactory = await ethers.getContractFactory('TrendingCall');
  instanceTrendingCall = TrendingCallContractFactory.connect(commiter).attach(
    CONTRACT_ARBITRAGE_ADDRESS,
  ) as TrendingCall;
  bot = TeleGramBotInit();

  if (true) {
    for (let market of ExchangeMarkets) {
      if (market.type == 'CX') {
        console.log('xxxxx:CX:', market);
        let spotCx = new SpotCx(market, tokenPaths, null, logger, commiter);
        if (await spotCx.Init()) {
          spotCx.LoadAverage();
          loopSpotCxs.push(spotCx);
        }
        spotExMap.set(spotCx.market.address, spotCx);
      } else if (market.type == 'DX') {
        console.log('xxxxx:DX:', market);
        let spotDx = new SpotDx(market, tokenPaths, commiter);
        await spotDx.Init();
        spotDx.LoadAverage();
        loopSpotDxs.push(spotDx);
        spotExMap.set(spotDx.market.address, spotDx);
        // console.log('xxxx:', spotDx.token0, spotDx.token1);
        // spotCx.spotDxs.push(spotDx);
      } else if (market.type == 'BRIDGE') {
        console.log('xxxxx:BRIDGE:', market);
        let spotBridge = new SpotEx(market, tokenPaths, commiter);
        spotExMap.set(spotBridge.market.address, spotBridge);
        // console.log('xxxx:', spotDx.token0, spotDx.token1);
        // spotCx.spotDxs.push(spotDx);
      }
    }
  }
  for (let spotCx of loopSpotCxs) {
    if (spotCx.market.isAn && spotCx.market.priority == 0) {
      for (let spotDx of loopSpotDxs) {
        if (spotDx.market.isAn) {
          spotCx.spotDx = spotDx;
          break;
        }
      }
    }
  }
  // if (loopSpotCxs.length == 0) {
  //   console.log('没有发现有效交易对,程序退出');
  //   exit(0);
  // }
  await sendBotMessage(`DX-WMATIC-BUSD启动`);
  let exitOnce = false;
  [`exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2`, `SIGTERM`].forEach((eventType: any) => {
    process.on(eventType, function (data: any) {
      if (!exitOnce) {
        exitOnce = true;
        console.log('eventType:', eventType, data);
        sendBotMessage(`\`DX-USDC-WETH退出:${eventType}\``);
        // for (let spotCx of loopSpotCxs) {
        //   if (spotCx.market.isAn) {
        //     spotCx.SaveStatusConfig();
        //   }
        // }
        setTimeout(() => {
          process.exit(2);
        }, 2000);
      }
    });
  });
  let lineLogHeader = `时间\tLineLog描述\ttblobckTime\tblobckNumber\tgasPrice`; //日志标题
  for (let ex of loopSpotCxs) {
    lineLogHeader =
      lineLogHeader +
      `\t${ex.market.symbol}-价格\t${ex.market.symbol}-bid\t${ex.market.symbol}-ask\t${ex.market.symbol}-bidAfterAllCost\t${ex.market.symbol}-askAfterAllCost\t${ex.market.symbol}-bid可成交额\t${ex.market.symbol}-ask可成交额\t${ex.market.symbol}-An`;
  }
  for (let ex of loopSpotDxs) {
    lineLogHeader =
      lineLogHeader +
      `\t${ex.market.symbol}-价格\t${ex.market.symbol}-bid\t${ex.market.symbol}-ask\t${ex.market.symbol}-bidAfterAllCost\t${ex.market.symbol}-askAfterAllCost\t${ex.market.symbol}-bid可成交额\t${ex.market.symbol}-ask可成交额\t${ex.market.symbol}-An`;
  }
  lineLogHeader =
    lineLogHeader +
    // `\t交易对\t操作\tThreshold\tLastThreshold\ttoken0头寸\ttoken1头寸\t头寸差额\t下单量\t利润比\t链上价格\t链下价格\t上次链下价格\t下单区块\t确认区块`;
    `\t交易对\t操作\t未确认建仓头寸\t未确认减仓头寸\t已确认建仓头寸\t已确认减仓头寸\t头寸差额\t当前头寸\t下单量\tOnchainOverOffchainSpread\tOffchainOverOnchainSpread\tOnchainBid\tOnchainAsk\tOffchainBid\tOffchainAsk\t实际成交价\ttoken0余额\ttoken1余额\t下单区块\t确认区块\t路径长度\t交易路径\tcommitTimes\tRealizedPNL\tUnrealizedPNL\tgasCost\tRealPosition\tActualPosition\tNewLevel\tPositionEntryLevel\tupdateTime\ttoken0Balance\token1Balance`;
  logger.debug(lineLogHeader);
  //有严格的顺序限制,必须把0买1配置在1买0前面,否则刷新会有不及时问题
  let tokenPairs = [
    [TokenInfoEnum.WMATIC, TokenInfoEnum.USDC],
    [TokenInfoEnum.USDC, TokenInfoEnum.WMATIC],
  ];
  let poolPaths = [
    ['UNIV3-WMATIC-USDC-500'],
    ['UNIV3-WMATIC-WETH-500', 'UNIV3-USDC-WETH-500'],
    ['UNIV3-WMATIC-USDC-3000'],
    ['QUICK-WMATIC-USDC-3000'], //
    ['SUSHI-WMATIC-USDC-3000'],
  ];
  for (let [startToken, endToken] of tokenPairs) {
    let exSide = 0;
    let spotCx = GetSpotExByKey('CX', startToken.key, endToken.key) as SpotCx;
    if (!spotCx) {
      spotCx = GetSpotExByKey('CX', endToken.key, startToken.key) as SpotCx;
      exSide = 1;
    }
    let tokenPath = new TokenPath(startToken, endToken, waitCommitMap, waitCommitPoolMap, MongoPoolMap);
    let filename = 'status/' + (spotCx.market.status || spotCx.market.symbol) + '.json';
    let config = LoadStatusConfig(filename);
    let init = false;
    if (!config) {
      init = true;
      config = {
        token0Balance: 0,
        token1Balance: 0,
        token0BalanceInit: 0,
        token1BalanceInit: 0,
        UnitNotional: 4000,
        pairId: 1,
        UnitNotionalTokenKey: 'WMATIC',
        OnchainBid: 0,
        OnchainAsk: 0,
        OffchainBid: 0,
        OffchainAsk: 0,
        OnchainOverOffchainSpread: 0,
        OffchainOverOnchainSpread: 0,
        OnOverOffPositivePosition: 0,
        OnOverOffNegativePosition: 0,
        OnOverOffPositivePositionConfirm: 0,
        OnOverOffNegativePositionConfirm: 0,
        commitTimes: 0,
        PositionEntryLevel: 0,
        ActualPosition: 0,
        TargetPosition: 0,
        TargetNotional: 0,
        DiffNotional: 0,
        NewLevel: 0,
        lastThreshold: 0,
        RealizedPNL: 0,
        UnrealizedPNL: 0,
        gasCost: 0,
        pause: false,
        checkReset: true,
        MaxNotional: 0,
        createTime: moment().format('YYYY-MM-DD HH:mm:ss'), //初始化时间
        updateTime: moment().format('YYYY-MM-DD HH:mm:ss'), //最后更新时间
      };
    }
    tokenPaths.push(tokenPath);
    let abiContract = new ethers.Contract(owner.address, TrendingABI);
    let abiInstance = abiContract.connect(owner.provider);
    let uniSwapV3QuoterAbi = new ethers.Contract(UNI_V3_QUOTER_ADDRESSES, UniSwapV3QuoterABI);
    let uniSwapQuoterV3 = uniSwapV3QuoterAbi.connect(owner.provider).attach(UNI_V3_QUOTER_ADDRESSES);
    let balancerVaultAbi = new ethers.Contract(CONTRACT_BALANCER_VAULT_ADDRESS, BalancerVaultABI);
    let balancerVault = balancerVaultAbi.connect(owner.provider);
    let instanceTrendingCall1 = TrendingCallContractFactory.connect(commiter).attach(
      CONTRACT_ARBITRAGE_ADDRESS,
    ) as TrendingCall;
    waitStartList.push(
      tokenPath.Start(
        logger,
        poolPaths,
        abiInstance,
        uniSwapQuoterV3,
        balancerVault,
        null,
        instanceTrendingCall1,
        spotCx,
        exSide,
        owner,
      ),
    );
    tokenPath.spotCx.gridConfig = config;
    tokenPath.spotCx.gridConfigFileName = filename;
    tokenPath.startTokenInstance = erc20ContractFactory.connect(commiter).attach(tokenPath.startTokenAddress) as WETH9;
    tokenPath.endTokenInstance = erc20ContractFactory.connect(commiter).attach(tokenPath.endTokenAddress) as WETH9;
    await tokenPath.UpdateStartEndTokenBalance();
    if (tokenPath.startToken.key == tokenPath.spotCx.market.token0.key) {
      tokenPath.spotCx.gridConfig.token0Balance =
        parseFloat(tokenPath.startTokenBalance.toString()) / tokenPath.spotCx.market.token0.one;
      tokenPath.spotCx.gridConfig.token1Balance =
        parseFloat(tokenPath.endTokenBalance.toString()) / tokenPath.spotCx.market.token1.one;
    } else {
      tokenPath.spotCx.gridConfig.token0Balance =
        parseFloat(tokenPath.endTokenBalance.toString()) / tokenPath.spotCx.market.token0.one;
      tokenPath.spotCx.gridConfig.token1Balance =
        parseFloat(tokenPath.startTokenBalance.toString()) / tokenPath.spotCx.market.token1.one;
    }
    if (init) {
      tokenPath.spotCx.gridConfig.token0BalanceInit = tokenPath.spotCx.gridConfig.token0Balance;
      tokenPath.spotCx.gridConfig.token1BalanceInit = tokenPath.spotCx.gridConfig.token1Balance;
    }
    SaveStatusConfig(config, filename);
  }
  const results = await Promise.all(
    waitStartList.map(async (poolPathList: PoolPathList[]) => {
      return poolPathList;
    }),
  );
  for (let result of results) {
    startupPathProfits = startupPathProfits.concat(result);
  }
  //初始化
  for (let value of Object.values(TokenInfoEnum)) {
    value.startBalance = value.balance;
    value.oneBig = BigNumber.from(10).pow(value.decimals);
    value.balanceMin = 0;
    // value.balanceMinBigNumber = BigNumber.from(10).pow(value.decimals);
    value.balanceMinBigNumber = BigNumber.from(0);
    value.priceUsd = 1;
  }
  for (let spotCx of loopSpotCxs) {
    for (let tokenPath of spotCx.tokenPaths) {
      if (tokenPath.startToken.key == tokenPath.spotCx.market.token0.key) {
        spotCx.startTokenPath = tokenPath;
      }
    }
    if (spotCx.market.marketSymbole0) {
      for (let spotNext of loopSpotCxs) {
        if (spotCx.market.marketSymbole0 == spotNext.market.symbol) {
          spotCx.market.market0 = spotNext.market;
          spotNext.market.parent = spotCx.market;
          break;
        }
      }
      for (let spotNext of loopSpotCxs) {
        if (spotCx.market.marketSymbole1 == spotNext.market.symbol) {
          spotCx.market.market1 = spotNext.market;
          spotNext.market.parent = spotCx.market;
        }
      }
    }
  }
  for (let spotDx of loopSpotDxs) {
    for (let tokenPath of spotDx.tokenPaths) {
      if (tokenPath.startToken.key == tokenPath.spotCx.market.token0.key) {
        spotDx.startTokenPath = tokenPath;
      }
    }
  }
  //要初始化完后才能计算价格
  for (let spotDx of loopSpotDxs) {
    await spotDx.getBlockConfirmPrice();
  }
  let lastOrderTime = 0;
  let isWaiting = false;

  let interval = setInterval(() => {
    let readnum = 0;
    for (let spotCx of loopSpotCxs) {
      if (spotCx.market.isAn && spotCx.market.priority == 0) {
        readnum++;
        break;
      }
    }
    for (let spotDx of loopSpotDxs) {
      if (spotDx.market.isAn) {
        readnum++;
        break;
      }
    }
    if (readnum == 2) {
      for (let spotCx of loopSpotCxs) {
        if (spotCx.market.isAn && spotCx.market.priority == 0) {
          if (spotCx.CalculateAn()) {
            PrintLineLog('');
          }
        }
      }
      for (let spotDx of loopSpotDxs) {
        if (spotDx.market.isAn) {
          spotDx.CalculateAn();
        }
      }
    }
  }, 200);
  let interval1 = setInterval(() => {
    for (let spotCx of loopSpotCxs) {
      if (spotCx.market.isAn) {
        spotCx.SaveAverage();
      }
    }
    for (let spotDx of loopSpotDxs) {
      if (spotDx.market.isAn) {
        spotDx.SaveAverage();
      }
    }
  }, 1000);
  {
    let testTimes = 0;

    {
      let logTime = 0;
      let startTime = Date.now();
      let loop = async () => {
        loopStartTime = Date.now();
        if (exitOnce) {
          return;
        }
        // if (isWaiting) {
        //   setTimeout(loop, 1);
        //   return;
        // }
        try {
          let now = Date.now();
          //启动前两秒先等收数据
          if (now - startTime < 10000) {
            setTimeout(loop, 1);
            return;
          }
          if (now - lastBlockTime > 60000) {
            isWaiting = true;
            if (lastBlockTime) {
              console.log('超过1分钟未同步区块,先等待区块同步:', now - lastBlockTime);
              sendBotMessage(`超过1分钟未同步区块,先等待区块同步:, ${now - lastBlockTime}`);
              try {
                for (let spotDx of loopSpotDxs) {
                  await spotDx.Init();
                }
                sendBotMessage(`重连节点成功`);
              } catch (e) {
                console.log('节点连接失败:', e);
                sendBotMessage(`节点连接失败:`);
              }
            } else {
              console.log('等待第一次区块同步');
            }
            setTimeout(loop, 1000);
            return;
          }
          for (let spotCx of loopSpotCxs) {
            if (now - spotCx.lastTickerMsec > 60000) {
              isWaiting = true;
              if (spotCx.lastTickerMsec) {
                console.log('超过1分钟未更新交易所价格,先等待更新交易所价格:', now - spotCx.lastTickerMsec);
                sendBotMessage(
                  `超过1分钟未更新交易所价格,先等待更新交易所价格:,${spotCx.market.symbol} ${now - lastBlockTime}`,
                );
                try {
                  if (spotCx.market.ex == 'binance') {
                    spotCx.initBinancePath();
                  } else if (spotCx.market.ex == 'ftx') {
                    spotCx.initFtxPath();
                  } else {
                  }
                  sendBotMessage(`重连交易所成功`);
                } catch (e) {
                  console.log('重连交易所成功:', e);
                  sendBotMessage(`重连交易所成功:`);
                }
              } else {
                console.log('等待第一次更新交易所价格');
              }
              setTimeout(loop, 1000);
              return;
            }
            if (now - spotCx.lastTickerMsec > 60000) {
              waitCommitMap.clear();
              setTimeout(loop, 1000);
              return;
            }
          }
          isWaiting = false;
          if (now - lastBlockTime > 60000) {
            waitCommitMap.clear();
            setTimeout(loop, 1000);
            return;
          }
          for (let [k, ret] of waitCommitMap) {
            if (ret.waitCommitTime == 0) {
              waitCommitMap.delete(k);
            }
          }
          // if (waitCommitMap.size == 0)
          {
            // let waitStartList = [];
            for (let tokenPath of tokenPaths) {
              await tokenPath.Loop('Confirm', lastBlockNumber);
              // waitStartList.push(tokenPath.Loop('Confirm', lastBlockNumber));
            }
            // const results = await Promise.all(
            //   waitStartList.map(async (poolPathList: PoolPathList[]) => {
            //     return poolPathList;
            //   }),
            // );
          }
          {
            for (let [k, ret] of waitCommitMap) {
              if (false && testTimes > 100) {
                console.log('ret:测试状态,先不下单:');
              } else {
                testTimes++;
                await commitTrending(
                  ret,
                  ret.indata.tokenPath.instanceTrendingCall,
                  null,
                  '自主扫描:' + ret.pathAddr.length + ':' + lastBlockNumber + ':' + path,
                  ret.indata.tokenPath.instanceTrendingCall,
                );
              }
              //只下一个单,其他等下次重新计数后再下,避免过期
              break;
            }
            waitCommitMap.clear();
          }
          if (now - logTime >= 200) {
            logTime = now;
            PrintLineLog('');
          }
          // spotCx1.Loop();
          setTimeout(loop, 1);
        } catch (e) {
          console.log('循环报错:', e);
          await sendBotMessage(`循环报错:${e}`);
          setTimeout(loop, 1);
        }
      };
      await loop();
    }
  }
};

export let PrintLineLog = (append: string) => {
  let desc = `${Date.now()}\tLineLog\t${lastBlockTime}\t${lastBlockNumber}\t${feeData.gasPrice?.toString()}`;
  for (let ex of loopSpotCxs) {
    //如果暂停了就不再分cpu
    if (!ex.recordedStatus?.pause) {
      // spotCx.Loop();
    }
    desc = desc + '\t' + ex.GetMarketLog();
  }
  for (let ex of loopSpotDxs) {
    desc = desc + '\t' + ex.GetMarketLog();
  }
  if (append != '') {
    desc = desc + '\t' + append;
  }
  logger.debug(desc);
};
