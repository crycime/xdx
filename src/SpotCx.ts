import * as fs from 'fs';
import * as path from 'path';

import { Logger } from 'log4js';
import * as ccxt from 'ccxt';
import { Update } from 'telegraf/src/core/types/typegram';
import { Context, Telegraf } from 'telegraf';
import moment from 'moment';
import { Db } from 'mongodb';
import { Wallet, BigNumber } from 'ethers';
import {
  Market,
  FtxClient,
  BinanceClient,
  BinanceFuturesUsdtmClient,
  HuobiSwapsClient,
  HuobiFuturesClient,
  HuobiClient,
  Ticker,
} from '../src/ccxws/src/index';
import { BasicClient } from '../src/ccxws/src/BasicClient';
import { sendBotMessage } from '../src/telegram-bot';
// import { sendBotMessage, TeleGramBotInit } from '../src/telegram-bot';
import { SpotDx } from '../src/SpotDx';
import { SpotEx } from './SpotEx';
import { TokenPath } from '../src/TokenPath';

import {
  LogLineData,
  CxContract,
  RecordedCxContract,
  OrderInfo,
  EPSILON,
  MarketPrice,
  HedgeContract,
  StatusLog,
  ExchangeMarket,
  TokenInfoEnum,
} from './constants';
// import { CounterCx } from './CounterCx';
import { appendFile } from 'fs';
export class SpotCx extends SpotEx {
  private static _ws_ftx: FtxClient;
  private static _ws_ftx_time: number;
  private static _ws_binance: BinanceClient;
  private static _ws_binance_time: number;
  private static _ws_binance_future: BinanceFuturesUsdtmClient;
  private static _ws_binance_future_time: number;
  private static _ws_huobi: HuobiClient;
  private static _ws_huobi_time: number;
  private _ccxt_huobipro: ccxt.huobipro;
  private _ccxt_huobipro_markets: ccxt.Dictionary<ccxt.Market>;
  // private _ccxt_binance: ccxt.binance;
  // private _ccxt_binance_markets: ccxt.Dictionary<ccxt.Market>;
  private _ccxt_ftx: ccxt.ftx;
  // private _ccxt_ftx_markets: ccxt.Dictionary<ccxt.Market>;
  private _ccxt_okex: ccxt.okex;
  private _ccxt_okex_markets: ccxt.Dictionary<ccxt.Market>;
  // public xTokenNumber: number;
  // public yTokenNumber: number;
  public id: string;
  public name: string;
  public open: number;
  public trending: number;
  public lastask: number;
  public lastbid: number;
  public lastPrice: number;
  public ExpAvg: number;
  public OldSpotIndex: number;
  public ExpDiff: number;
  public mmdb: Db;
  public logger: Logger;
  public orderInfoMap: Map<number, OrderInfo>;
  public waitingOrderInfoMap: Map<number, OrderInfo>;
  public filledOrderInfos: OrderInfo[];
  public TrendingStarted: boolean;
  public recordedStatus: StatusLog;
  // public counterCx: CounterCx;
  public marketDataLog: LogLineData[];
  public contractDataLog: LogLineData[];
  public allDataLog: LogLineData[];
  public positionInfoDataLog: LogLineData[];
  public positionPnlDataLog: LogLineData[];
  public lineLog: string; //日志重复过滤
  public lineLogHeader: string; //日志重复过滤
  public lineLogNull: string; //日志重复过滤
  public lineLogDatas: LogLineData[];
  public lastLineLogData?: string; //日志重复过滤
  public lastRecordMarketData?: string; //日志重复过滤
  public lastRecordContractData?: string; //日志重复过滤
  private _oldNodeTime: number;
  private _lastOrderTime: number;
  private _statusConfigFileName: string;
  private _updateTime?: number; //价格更新时间,Date.now(),msec
  public lastTickerMsec: number; //最后一次tick确认时间
  public botDNotional: number; //手动调仓

  constructor(
    _market: ExchangeMarket,
    tokenPaths: TokenPath[],
    // _counterCx: CounterCx,
    _mmdb: Db,
    _logger: Logger,
    _commiter: Wallet,
  ) {
    super(_market, tokenPaths, _commiter);
    this.lastask = 0;
    this.lastbid = 0;
    this.allDataLog = [];
    this.lineLogDatas = [];
    this.marketDataLog = [];
    this.contractDataLog = [];
    this.positionInfoDataLog = [];
    this.positionPnlDataLog = [];
    // this.counterCx = _counterCx;
    this.mmdb = _mmdb;
    this.logger = _logger;
    this.ExpAvg = 0;
    this.ExpDiff = 0;
    this.OldSpotIndex = 0;
    this._oldNodeTime = 0;
    this._lastOrderTime = 0;
    this.orderInfoMap = new Map<number, OrderInfo>();
    this.waitingOrderInfoMap = new Map<number, OrderInfo>();
    this.filledOrderInfos = []; //目前只是用来输出日志
    this.TrendingStarted = false;
    this.lineLog = '';
    this.lineLogHeader = '';
    this.lineLogNull = '';
  }

  public SetPause = async (set: boolean) => {
    if (this.recordedStatus.pause == set) {
      console.log('状态没有发生变化,忽略:', this.recordedStatus.pause, set);
      return false;
    }
    this.recordedStatus.pause = set;
    this.SaveStatusConfig();
    if (set == true) {
      this.ResetMarketData();
      this.lastPrice = 0;
      this.ExpAvg = 0;
      this.TrendingStarted = false;
      //这里有没有关闭得观察下
      // if (this._ws_huobi) {
      //   this._ws_huobi.close();
      // }
      // if (this._ws_binance) {
      //   this._ws_binance.close();
      // }
      return true;
    } else {
      return await this.Init();
    }
  };
  public UpdateBalance = async (msec: number) => {
    if (this.market.token0.updateAt != msec) {
      this.market.token0.updateAt = msec;
    }
    if (this.market.token1.updateAt != msec) {
      this.market.token1.updateAt = msec;
    }
    console.log('更新余额:', this.market.ex, this.market.token0.address, this.market.token1.address);
  };
  //重新生成配置文件,主要用来调整流动性变化
  //方法就是删除json文件,重置TrendingStarted后就会再次生成
  public ResetConfig = () => {
    this.ResetMarketData();
    this.lastPrice = 0;
    this.ExpAvg = 0;
    this.TrendingStarted = false;
    fs.rm(this._statusConfigFileName, () => {});
    console.log('删除配置文件,准备重新生成:', this._statusConfigFileName);
  };
  public Loop = () => {
    //下面这句有点重复,不过不影响逻辑,gm指令修改配置的时候会起作用
    if (this.recordedStatus?.pause) {
      return;
    }
    let now = Date.now();
    //这个循环只是为了判断断线重连
    //如果1分钟没有报价就重连
    if (!this._updateTime || now - this._updateTime < 60 * 1000) {
      //NOTHING OK
    } else {
      let market = this.market;
      this._updateTime = 0;
      this.log('长时间没有收到数据,重连:', market.ex);
      this.market.price = 0;
      if (market.ex == 'huobi') {
        this.initHuoBiPath();
      } else if (market.ex == 'binance_future') {
        this.initBinanceFuturePath();
      } else if (market.ex == 'binance') {
        this.initBinancePath();
      } else if (market.ex == 'okex') {
        console.log('TODO,还不支持的交易:', market.ex);
        this.initOkExPath();
      } else if (market.ex == 'ftx') {
        this.initFtxPath();
      } else {
        console.log('TODO,还不支持的交易:', market.ex);
      }
    }
    // this.OnMarketData();
    // for (let [Order, order] of this.waitingOrderInfoMap) {
    //   this.OnOrderMatch(
    //     order,
    //     (Math.abs(order.OrderAmountWithDirection) - order.FilledAmount) / 1, //
    //     // (Math.abs(order.OrderAmountWithDirection) - order.FilledAmount) / (Math.round(Math.random() * 3) + 1), //随机下成交量
    //     // (order.PriceReference * (Math.round(Math.random() * 3) + 1)) / 10 //随机下价格
    //     order.PriceReference
    //   );
    // }
    if (this.allDataLog.length > 10000) {
      this.allDataLog.splice(0, this.allDataLog.length - 10000);
    }
    if (this.lineLogDatas.length > 10000) {
      this.lineLogDatas.splice(0, this.lineLogDatas.length - 10000);
    }
  };
  public debug = (message: any, ...args: any[]) => {
    this.logger.debug(this.id, message, ...args);
  };
  public log = (message: any, ...args: any[]) => {
    console.log(this.id, message, ...args);
  };
  public Init = async () => {
    this._statusConfigFileName = `status/${this.market.status || this.market.symbol}.json`;
    this.id = this.market.symbol;
    this.name = this.market.symbol;
    //确保唯一进程,避免冲突
    // try {
    //   const SingleInstance = require('single-instance');
    //   const locker = new SingleInstance(this.name);
    //   await locker.lock();
    // } catch (e) {
    //   console.log('请确定程序策略是否被重复执行:', e);
    // console.log('程序已经运行,请先关闭:', e);
    // return false;
    // }
    this.lineLogHeader = '时间\tLineLog描述\t交易对\t';
    // for (let token of market.tokens) {
    this.lineLogHeader += `${this.market.ex}-${this.market.symbol}-bid\t${this.market.ex}-${this.market.symbol}-ask\t`;
    this.lineLogHeader += `交易所均价`;
    // for (let contract of this.hedgeContract.contracts) {
    //   this.lineLogHeader += `${contract.Symbol}-contractV3头寸\t${contract.Symbol}-交易所头寸\t${contract.Symbol}-对冲量\t${contract.Symbol}-下单比例\t`;
    // }
    // // for (let contract of this.hedgeContract.contracts) {
    // //   this.lineLogHeader += `${contract.Symbol}-决策价格\t`;
    // // }
    // for (let contract of this.hedgeContract.contracts) {
    //   this.lineLogHeader += `${contract.Symbol}-OrderID\t下单量\t${contract.Symbol}-决策价格\t`;
    // }
    // for (let index = 0; index < this.lineLogHeader.split('\t').length - 2; index++) {
    //   this.lineLogNull += `null\t`;
    // }
    // this.lineLogHeader += `币种\t订单号\t交易所订单号\t下单量\t成交量\t平均成交价\t下单价\t现货参考下单价\t方向`;
    // this.logger.debug(this.lineLogHeader);
    let market = this.market;
    market.price = 0;
    if (market.ex == 'huobi') {
      this._ccxt_huobipro = new ccxt.huobipro({
        version: 'v1',
        apiKey: process.env.HUOBI_APIKEY,
        secret: process.env.HUOBI_SECRET,
        enableRateLimit: true,
        // options: { type: 'future', defaultType: 'future' },
      });
      this._ccxt_huobipro_markets = await this._ccxt_huobipro.loadMarkets();
      if (!this.initHuoBiPath()) {
        console.log('初始化火币失败:', market.ex);
        return false;
      }
    } else if (market.ex == 'binance_future') {
      if (!this.initBinanceFuturePath()) {
        console.log('初始化币安Future失败:', market.ex);
        return false;
      }
    } else if (market.ex == 'binance') {
      // this._ccxt_binance = new ccxt.binance({
      //   version: 'v1',
      //   apiKey: process.env.BINANCE_APIKEY,
      //   secret: process.env.BINANCE_SECRET,
      //   enableRateLimit: true,
      //   //下面这里用现货市场, 因为价格取现货的
      //   // options: { type: 'future', defaultType: 'future' },
      // });
      // this._ccxt_binance_markets = await this._ccxt_binance.loadMarkets();
      if (!this.initBinancePath()) {
        console.log('初始化币安失败:', market.ex);
        return false;
      }
    } else if (market.ex == 'okex') {
      console.log('TODO,还不支持的交易:', market.ex);
      if (!this.initOkExPath()) {
        return false;
      }
      return false;
    } else if (market.ex == 'ftx') {
      // this._ccxt_ftx = new ccxt.ftx({
      //   version: 'v1',
      //   apiKey: process.env.BINANCE_APIKEY,
      //   secret: process.env.BINANCE_SECRET,
      //   enableRateLimit: true,
      //   //下面这里用现货市场, 因为价格取现货的
      //   // options: { type: 'future', defaultType: 'future' },
      // });
      // this._ccxt_ftx_markets = await this._ccxt_ftx.loadMarkets();
      if (!this.initFtxPath()) {
        console.log('初始化FTX失败:', market.ex);
        return false;
      }
    } else {
      console.log('TODO,还不支持的交易:', market.ex);
      return false;
    }
    return true;
  };
  private initCxMarket = (client: BasicClient) => {
    let cxmarket = this.market;
    this.lastTickerMsec = Date.now();
    client.on('ticker', (ticker: Ticker, market: Market) => {
      this.lastTickerMsec = Date.now();
      if (!this._updateTime) {
        this.log('第一次收到行情数据:', cxmarket.ex, market.id, this.market.symbol);
      }
      this._updateTime = Date.now();
      // console.log(ticker);
      if (market.id == this.market.id || market.id == this.market.symbol) {
        this.market.ticker = ticker;
        let bid = parseFloat(ticker.bid);
        let ask = parseFloat(ticker.ask);
        // if (Math.abs(ask - this.lastask) / ask > 0.00001 || Math.abs(bid - this.lastbid) / bid > 0.00001) {
        if (ask != this.lastask || bid != this.lastbid || this.trendingTimes >= 3) {
          //加个趋势倾向
          if (ticker.open) {
            this.open = parseFloat(ticker.open);
            this.trending = ((bid + ask) / 2 - this.open) / this.open;
            // ask = ask - this.trending * 0.001; //每变化1%,增加十万分之一的倾向
            // bid = bid - this.trending * 0.001; //每变化1%,增加十万分之一的倾向
          }
          if (this.lastbid) {
            if (ask < this.lastbid) {
              console.log(
                '加速下跌:',
                this.market.symbol,
                ask / this.lastbid - 1,
                this.lastbid,
                this.lastask,
                bid,
                ask,
              );
            } else if (bid > this.lastask) {
              console.log(
                '加速上涨:',
                this.market.symbol,
                bid / this.lastask - 1,
                this.lastbid,
                this.lastask,
                bid,
                ask,
              );
            }
          }
          this.lastask = ask;
          this.lastbid = bid;
          this.UpdateMarket(bid, ask);
        } else {
          this.trendingTimes++;
        }
      }
    });
    client.on('error', err => {
      console.log('initCxMarket error:', cxmarket.ex, err);
    });
  };
  private initHuoBiPath = () => {
    let cxmarket = this.market;
    //因为有断线重连,所以需要每次重置
    cxmarket.price = 0;
    if (SpotCx._ws_huobi && Date.now() - SpotCx._ws_huobi_time > 60 * 1000) {
      SpotCx._ws_huobi.close();
      SpotCx._ws_huobi = null;
    }
    // let client = new HuobiSwapsClient();
    if (!SpotCx._ws_huobi) {
      SpotCx._ws_huobi_time = Date.now();
      SpotCx._ws_huobi = new HuobiClient({ wssPath: 'wss://api-aws.huobi.pro/ws' });
      SpotCx._ws_huobi.reconnect();
      SpotCx._ws_huobi.setMaxListeners(20);
    }
    const token0 = this.market.token0.symbol;
    const token1 = this.market.token1.symbol;
    let side = 0;
    let market = this._ccxt_huobipro_markets[token0 + '/' + token1];
    if (!market) {
      market = this._ccxt_huobipro_markets[token1 + '/' + token0];
      side = 1;
    }
    if (!market) {
      sendBotMessage(`\`找不到交易路径: ${cxmarket.ex}, ${token0}, ${token1}\``);
      return false;
    }
    let path: MarketPrice = {
      // id: market.base + '-' + market.quote, //火币专用,行业不统一折磨程序员
      // id: (market.base + '' + market.quote).toLowerCase(), //火币专用,行业不统一折磨程序员
      id: this.market.id || this.market.symbol, //币安专用,行业不统一折磨程序员
      base: market.base,
      quote: market.quote,
      type: market.type,
      side: side,
      price: 0,
    };
    if (!SpotCx._ws_huobi.subscribeTicker(path)) {
      path = SpotCx._ws_huobi.getscribeTicker(path.id);
    }
    if (!path) {
      sendBotMessage(`\`行情订阅失败: ${cxmarket.ex}, ${token0}, ${token1}, ${path.id}\``);
      return false;
    }
    this.debug('事件订阅:', market.id, SpotCx._ws_huobi.getMaxListeners());
    this.initCxMarket(SpotCx._ws_huobi);
    return true;
  };
  //这个函数可重入,支持断线重连
  public initFtxPath = () => {
    let cxmarket = this.market;
    //因为有断线重连,所以需要每次重置
    cxmarket.price = 0;
    //这里多防止网络有问题的时候被多个交易对同时调用初始化
    if (SpotCx._ws_ftx && Date.now() - SpotCx._ws_ftx_time > 60 * 1000) {
      SpotCx._ws_ftx.close();
      SpotCx._ws_ftx = null;
    }
    if (!SpotCx._ws_ftx) {
      SpotCx._ws_ftx = new FtxClient();
      SpotCx._ws_ftx_time = Date.now();
      SpotCx._ws_ftx.reconnect();
      SpotCx._ws_ftx.setMaxListeners(20);
    }
    const token0 = this.market.token0.symbol;
    const token1 = this.market.token1.symbol;
    // let side = 0;
    // let market = this._ccxt_ftx_markets[token0 + '/' + token1];
    // if (!market) {
    //   market = this._ccxt_ftx_markets[token1 + '/' + token0];
    //   side = 1;
    // }
    // if (!market) {
    //   console.log('initFtxPath找不到交易对:', token0, token1);
    //   return false;
    // }
    let path: Market = {
      // id: this.market.token0.key + '/' + this.market.token1.key, //币安专用,行业不统一折磨程序员
      id: this.market.id || this.market.symbol, //币安专用,行业不统一折磨程序员
      base: this.market.token0.key,
      quote: this.market.token0.key,
      type: 'spot',
    };
    // if (this.market.side == 1) {
    //   path.id = this.market.token1.key + '/' + this.market.token0.key;
    // }
    // SpotCx._ws_ftx.subscribeTicker(path);
    if (!SpotCx._ws_ftx.subscribeTicker(path)) {
      path = SpotCx._ws_ftx.getscribeTicker(path.id);
    }
    if (!path) {
      sendBotMessage(`\`行情订阅失败: ${cxmarket.ex}, ${token0}, ${token1}, ${path.id}\``);
      return false;
    }
    this.debug('事件订阅:', cxmarket.ex, path.id, SpotCx._ws_ftx.getMaxListeners());
    this.initCxMarket(SpotCx._ws_ftx);
    return true;
  };
  //这个函数可重入,支持断线重连
  public initBinanceFuturePath = () => {
    let cxmarket = this.market;
    //因为有断线重连,所以需要每次重置
    cxmarket.price = 0;
    //这里多防止网络有问题的时候被多个交易对同时调用初始化
    if (SpotCx._ws_binance_future && Date.now() - SpotCx._ws_binance_future_time > 60 * 1000) {
      SpotCx._ws_binance_future.close();
      SpotCx._ws_binance_future = null;
    }
    if (!SpotCx._ws_binance_future) {
      SpotCx._ws_binance_future = new BinanceFuturesUsdtmClient({ bookTicker: true });
      SpotCx._ws_binance_future_time = Date.now();
      SpotCx._ws_binance_future.reconnect();
      SpotCx._ws_binance_future.setMaxListeners(20);
    }
    const token0 = this.market.token0.symbol;
    const token1 = this.market.token1.symbol;
    let path: Market = {
      // id: this.market.token0.symbol + this.market.token1.symbol, //币安专用,行业不统一折磨程序员
      id: this.market.id || this.market.symbol, //币安专用,行业不统一折磨程序员
      base: this.market.token0.symbol,
      quote: this.market.token1.symbol,
      type: 'future',
    };
    if (!SpotCx._ws_binance_future.subscribeTicker(path)) {
      path = SpotCx._ws_binance_future.getscribeTicker(path.id);
    }
    if (!path) {
      console.log(`\`行情订阅失败: ${cxmarket.ex}, ${token0}, ${token1}, ${path.id}\``);
      return false;
    }
    this.debug('事件订阅:', this.market.ex, this.market.symbol, path.id, SpotCx._ws_binance_future.getMaxListeners());
    this.initCxMarket(SpotCx._ws_binance_future);
    return true;
  };
  //这个函数可重入,支持断线重连
  public initBinancePath = () => {
    let cxmarket = this.market;
    //因为有断线重连,所以需要每次重置
    cxmarket.price = 0;
    //这里多防止网络有问题的时候被多个交易对同时调用初始化
    if (SpotCx._ws_binance && Date.now() - SpotCx._ws_binance_time > 60 * 1000) {
      SpotCx._ws_binance.close();
      SpotCx._ws_binance = null;
    }
    if (!SpotCx._ws_binance) {
      SpotCx._ws_binance = new BinanceClient();
      SpotCx._ws_binance_time = Date.now();
      SpotCx._ws_binance.reconnect();
      SpotCx._ws_binance.setMaxListeners(20);
    }
    const token0 = this.market.token0.symbol;
    const token1 = this.market.token1.symbol;
    let path: Market = {
      // id: this.market.token0.symbol + this.market.token1.symbol, //币安专用,行业不统一折磨程序员
      id: this.market.id || this.market.symbol, //币安专用,行业不统一折磨程序员
      base: this.market.token0.symbol,
      quote: this.market.token1.symbol,
      type: 'spot',
    };
    if (!SpotCx._ws_binance.subscribeTicker(path)) {
      path = SpotCx._ws_binance.getscribeTicker(path.id);
    }
    if (!path) {
      sendBotMessage(`\`行情订阅失败: ${cxmarket.ex}, ${token0}, ${token1}, ${path.id}\``);
      return false;
    }
    this.debug('事件订阅:', this.market.ex, this.market.symbol, path.id, SpotCx._ws_binance.getMaxListeners());
    this.initCxMarket(SpotCx._ws_binance);
    return true;
  };
  private initOkExPath = () => {
    let cxmarket = this.market;
    //因为有断线重连,所以需要每次重置
    cxmarket.price = 0;
    return false;
  };
  public GetReferencePrice = (contract: RecordedCxContract) => {
    if (contract.PositionToTake > 0) {
      return contract.UniswapAsk;
    } else {
      return contract.UniswapBid;
    }
  };
  private insertOrder = (contract: CxContract, OrderNotionalWithDirection: number, OrderLevel: number) => {
    let OrderDirection = OrderNotionalWithDirection > 0 ? 1 : -1;
    let order: OrderInfo = {
      OrderID: this.recordedStatus.InsertOrderId++,
      ContractName: contract.ContractName,
      Symbol: contract.Symbol,
      OrderAmountWithDirection: OrderNotionalWithDirection, //这里有点疑问
      OrderLevel: OrderLevel,
      FilledAmount: 0,
      FilledLevel: 0,
      PriceReference: 0,
      FilledSlippage: 0,
      owner: this,
      simulate: this.recordedStatus.simulate != false ? true : false, //如果不指定默认是模拟执行,避免手抖
    };
    // if (this.counterCx.CreateOrder(order)) {
    //   return order;
    // }
    return null;
  };
  //Assume local OrderID is an increasing integer
  public PlaceOrder = (
    contract: CxContract,
    OrderNotionalWithDirection: number,
    OrderLevel: number,
    PriceReference: number,
  ) => {
    // let OrderAmount = Math.abs(OrderNotionalWithDirection);
    let order = this.insertOrder(contract, OrderNotionalWithDirection, OrderLevel);
    if (order) {
      // if (order.OrderAmountWithDirection > 0) {
      order.PriceReference = PriceReference;
      order.PriceReferenceSpot = PriceReference;
      // } else {
      //   //TODO这里是否需要把反向价格记录下来
      // }

      return order;
    }
  };

  public getRecordedContractByName = (contractName: string) => {
    for (let contract of this.recordedStatus.hedgeContract.contracts) {
      if (contract.ContractName == contractName) {
        return contract;
      }
    }
    console.log('找不到订单合约:', contractName);
  };
  //Assume MatchedVolume is the total traded volume, MatchedPrice is the total average of executed part in this order.
  //成交通知触发,但是需要先排队后处理,否则会有多线程问题

  //定时触发
  public RecordExecutedTradeInfo = () => {
    for (let order of this.filledOrderInfos) {
      let desc = `RecordExecutedTradeInfo:${this.id} ${order.OrderID} ${order.ContractName} ${order.FilledAmount} ${order.FilledLevel} ${order.FilledSlippage}`;
      if (order.lastRecordExecutedTradeInfo != desc) {
        this.logger.debug(desc);
        order.lastRecordExecutedTradeInfo = desc;
      }
    }
    this.filledOrderInfos = [];
  };

  public CheckResetTargetNotional = async (tokenPath: TokenPath, force: boolean = false) => {
    // sendBotMessage(`此功能已关闭`);
    return false;
    if (!force && !this.gridConfig.checkReset) {
      sendBotMessage(`自动矫正功能已暂停`);
      return false;
    }
    if (!this.isStartToken(tokenPath.startToken.key)) {
      sendBotMessage(`起始币数据对不上:${this.market.token0.key},${tokenPath.startToken.key}`);
      return false;
    }
    if (this != tokenPath.spotCx) {
      sendBotMessage(`交易所数据对不上:${this.market.symbol},${tokenPath.spotCx.market.symbol}`);
      return;
    }
    // let startTokenBalance = parseFloat(tokenPath.startTokenBalance.toString()) / tokenPath.startToken.one;
    //如果差别太大,就认为是notional被分叉不正确了
    // let diffBalance =
    //   this.gridConfig.token0Balance -
    //   this.gridConfig.TargetNotional * this.gridConfig.UnitNotional -
    //   this.gridConfig.token0BalanceInit;
    // await tokenPath.UpdateStartEndTokenBalance();
    // let token0Balance = parseFloat(tokenPath.startTokenBalance.toString()) / this.market.token0.one;
    let token0Balance = this.gridConfig.token0Balance;
    let diffBalance = token0Balance - this.gridConfig.token0BalanceInit;
    let TargetNotional = Math.round(diffBalance / this.gridConfig.UnitNotional);
    //如果数据对不上先刷新下余额,这一步目前应该是冗余和补漏行为
    if (
      TargetNotional != this.gridConfig.TargetNotional ||
      Math.abs(this.gridConfig.ActualPosition - this.gridConfig.TargetPosition) > this.gridConfig.UnitNotional / 2
    ) {
      this.gridConfig.token0Balance = parseFloat(tokenPath.startTokenBalance.toString()) / this.market.token0.one;
      this.gridConfig.token1Balance = parseFloat(tokenPath.endTokenBalance.toString()) / this.market.token1.one;
      diffBalance = this.gridConfig.token0Balance - this.gridConfig.token0BalanceInit;
      TargetNotional = Math.round(diffBalance / this.gridConfig.UnitNotional);
    }
    // let DiffNotional = 0;
    // if (Math.abs(diffBalance) - this.gridConfig.UnitNotional * 0.8 > 0) {
    if (TargetNotional != this.gridConfig.TargetNotional) {
      console.log(
        '头寸偏差修正:',
        TargetNotional,
        Math.floor(Math.abs(diffBalance) / this.gridConfig.UnitNotional),
        diffBalance,
      );
      let oldTargetNotional = 0;
      oldTargetNotional = this.gridConfig.TargetNotional;
      if (Math.abs(TargetNotional - this.gridConfig.TargetNotional) <= 1) {
        console.log('误差在1个Notional范围内不纠正:', TargetNotional, this.gridConfig.TargetNotional);
        return;
      } else {
        if (TargetNotional == 0) {
          this.gridConfig.OnOverOffPositivePosition = 0;
          this.gridConfig.OnOverOffPositivePositionConfirm = 0;
          this.gridConfig.OnOverOffNegativePosition = 0;
          this.gridConfig.OnOverOffNegativePositionConfirm = 0;
        } else if (TargetNotional > 0) {
          this.gridConfig.OnOverOffPositivePosition = TargetNotional;
          this.gridConfig.OnOverOffPositivePositionConfirm = TargetNotional;
          this.gridConfig.OnOverOffNegativePosition = 0;
          this.gridConfig.OnOverOffNegativePositionConfirm = 0;
        } else if (TargetNotional < 0) {
          this.gridConfig.OnOverOffPositivePosition = 0;
          this.gridConfig.OnOverOffPositivePositionConfirm = 0;
          this.gridConfig.OnOverOffNegativePosition = TargetNotional;
          this.gridConfig.OnOverOffNegativePositionConfirm = TargetNotional;
        }
      }
      //屏蔽这样操作是为了让所有目标向this.gridConfig.TargetNotional看齐
      // TargetNotional = this.gridConfig.TargetNotional;
      this.gridConfig.TargetNotional = TargetNotional;
      this.gridConfig.TargetPosition = this.gridConfig.UnitNotional * TargetNotional;
      this.gridConfig.ActualPosition = diffBalance;
      tokenPath.loopFlag = true;
      this.SaveStatusConfig();
      sendBotMessage(`修正ReferenceBalance成功:${this.gridConfig.TargetNotional},${oldTargetNotional}`);
      return true;
    }
    return false;
    //
  };
  public ChangeNotional = (DiffNotional: number) => {
    if (Math.abs(DiffNotional) > 3) {
      sendBotMessage(`防止手抖调整DiffNotional数量不能大于`);
      return;
    }
    let oldTargetNotional = 0;
    oldTargetNotional = this.gridConfig.TargetNotional;
    let TargetNotional = this.gridConfig.TargetNotional - DiffNotional;
    this.gridConfig.TargetNotional = TargetNotional;
    this.gridConfig.TargetPosition = this.gridConfig.UnitNotional * TargetNotional;
    this.gridConfig.ActualPosition = this.gridConfig.TargetPosition;
    for (let tokenPath of this.tokenPaths) {
      tokenPath.loopFlag = true;
    }
    this.SaveStatusConfig();
    sendBotMessage(`调整DiffNotional成功:${oldTargetNotional},${TargetNotional}`);
    //只需要处理的一个,剩下的都一样
  };
}
