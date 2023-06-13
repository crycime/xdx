import * as fs from 'fs';
import * as path from 'path';

import { Logger } from 'log4js';
import * as ccxt from 'ccxt';
import { Update } from 'telegraf/src/core/types/typegram';
import { Context, Telegraf } from 'telegraf';
import moment from 'moment';
import { Db } from 'mongodb';
import { Market, BinanceClient, HuobiSwapsClient, HuobiClient, Ticker } from '../src/ccxws/src/index';
import { BasicClient } from '../src/ccxws/src/BasicClient';
import { sendBotMessage } from '../src/telegram-bot';
// import { sendBotMessage, TeleGramBotInit } from '../src/telegram-bot';

import { LoadAverage, SaveAverage, SaveStatusConfig } from '../src/status';
import { AverageConfig, ExchangeMarket, GridConfig } from './constants';
import { Wallet, BigNumber } from 'ethers';
import { TokenPath } from '../src/TokenPath';
import {
  lastConfirmOkPrice,
  lastConfirmOkPriceBid,
  lastConfirmOkPriceAsk,
  SetLastConfirmOkPriceBid,
  SetLastConfirmOkPriceAsk,
  SetLastCommitOkTimeBid,
  SetLastCommitOkTimeAsk,
  lastBlockNumber,
  lastConfirmMsec,
} from '../src/SpotDx';
import { SpotCx } from './SpotCx';

export class SpotEx {
  public gridConfigFileName: string; //网格交易数据配置文件名称
  public gridConfig: GridConfig; //网格交易数据
  public averageConfig: AverageConfig; //网格交易数据
  public market: ExchangeMarket;
  public lastBlockConfirmPrice: number;
  public thresholdBase: number;
  public priceConfirm?: number; //价格
  public askAfterAllCostConfirm?: number; //买方报价
  public bidAfterAllCostConfirm?: number; //卖方报价
  public MaxTicketSizeAskAfterAllCostConfirm?: number; //最大可卖出总量
  public MaxTicketSizeBidAfterAllCostConfirm?: number; //最大可买入总量
  public tokenPaths: TokenPath[];
  public startTokenPath: TokenPath;
  public lastUpdateTime: number;
  public timeoutHandle: NodeJS.Timeout;
  public trendingBid: number;
  public trendingAsk: number;
  public trendingTimes: number;
  public commiter: Wallet;
  public lastBlockConfirmPriceX96: BigNumber; //V3用
  public lastBlockConfirmPriceX18: BigNumber; //balancer用
  public lastCommitOffchainBid: number; //记录最后一次成交操作以判断方向
  public lastCommitOffchainAsk: number; //记录最后一次成交操作以判断方向
  public lastOp: string; //记录最后一次成交操作以判断方向
  public An: number; //移动平均价
  public AverageLength: number; //移动平均长度
  public Alpha: number; //移动平均长度
  public spotDx: SpotEx; //对应一个基准spotDx,用来计算移动平均值等
  constructor(_market: ExchangeMarket, tokenPaths: TokenPath[], _commiter: Wallet) {
    this.AverageLength = 36000; //14400;
    this.Alpha = 2 / (this.AverageLength + 1);
    this.An = 0;
    this.lastCommitOffchainBid = 0;
    this.lastCommitOffchainAsk = 0;
    this.lastUpdateTime = 0;
    this.trendingBid = 0;
    this.trendingAsk = 0;
    this.trendingTimes = 0;
    this.thresholdBase = 1;
    this.commiter = _commiter;
    this.market = _market;
    this.market.owner = this;
    this.tokenPaths = tokenPaths;
    this.market.token0PriceAfterAllCostBidOld = 0;
    this.market.token1PriceAfterAllCostBidOld = 0;
    this.market.token0PriceAfterAllCostAskOld = 0;
    this.market.token1PriceAfterAllCostAskOld = 0;
    this.market.token0PriceAfterAllCostBidRatio = 0;
    this.market.token1PriceAfterAllCostBidRatio = 0;
    this.market.token0PriceAfterAllCostAskRatio = 0;
    this.market.token1PriceAfterAllCostAskRatio = 0;
    this.market.token0PriceAfterAllCostBid = 0;
    this.market.token1PriceAfterAllCostBid = 0;
    this.market.token0PriceAfterAllCostAsk = 0;
    this.market.token1PriceAfterAllCostAsk = 0;
    this.market.lastToken0PriceAfterAllCost = 0;
    this.market.MaxTicketSizeAskAfterAllCost = 0;
    this.market.MaxTicketSizeBidAfterAllCost = 0;
    this.market.slippage0 = 1;
    this.market.slippage1 = 1;

    if (this.market.type == 'BRIDGE') {
      this.UpdateMarket(1, 1);
      console.log('xxxxxxxxx:init:', this.market);
    }
  }
  public CalculateAn = () => {
    let first = false;
    if (this.market.price) {
      if (!this.An) {
        first = true;
        //下面这个有兼容性问题,只能先这样
        let initPrice = 0;
        // let gridConfig = this.gridConfig ? this.gridConfig : this.market.owner?.gridConfig;
        // // 5分钟内有效
        // if (gridConfig?.AnTime && gridConfig.AnCx && gridConfig.AnDx && Date.now() - gridConfig.AnTime < 300 * 1000) {
        //   if (this.market.type == 'CX') {
        //     initPrice = this.market.type == 'CX' ? gridConfig.AnCx : gridConfig.AnDx;
        //   }
        // }
        if (initPrice) {
          this.An = initPrice;
        } else {
          if (this.market.type == 'CX' && this.market.side == 1) {
            this.An = 1 / this.market.price;
          } else {
            this.An = this.market.price;
          }
        }
      }
      //下面这个有兼容性问题,只能先这样
      if (this.market.type == 'CX' && this.market.side == 1) {
        this.An = this.An * (1 - this.Alpha) + (1 / this.market.price) * this.Alpha;
      } else {
        this.An = this.An * (1 - this.Alpha) + this.market.price * this.Alpha;
      }
    }
    return first;
    // console.log('平均移动调试:', this.market.symbol, this.Alpha, this.market.price, this.An);
  };
  public debug = (message: any, ...args: any[]) => {
    console.log(this.market.symbol, message, ...args);
  };
  public log = (message: any, ...args: any[]) => {
    console.log(this.market.symbol, message, ...args);
  };
  public SaveStatusConfig = () => {
    this.debug('status存档:', this.gridConfigFileName);
    if (this.market.isAn && this.spotDx && this.spotDx.market.isAn) {
      this.gridConfig.AnCx = this.An;
      this.gridConfig.AnDx = this.spotDx.An;
      this.gridConfig.AnTime = Date.now();
    }
    SaveStatusConfig(this.gridConfig, this.gridConfigFileName);
  };
  public SaveAverage = () => {
    if (!this.An || !this.market.price) {
      return;
    }
    let filename = '/tmp/' + (this.market.status || this.market.symbol) + '.json';
    this.averageConfig = this.averageConfig || {
      symbole: this.market.symbol,
      An: this.An,
      Alpha: this.Alpha,
      price: this.Alpha,
    };
    this.averageConfig.An = this.An;
    this.averageConfig.price = this.market.price;
    SaveAverage(this.averageConfig, filename);
  };
  public LoadAverage = () => {
    let filename = '/tmp/' + (this.market.status || this.market.symbol) + '.json';
    let averageConfig = LoadAverage(filename);
    //5分钟内可用
    if (averageConfig?.updateMsec && Date.now() - averageConfig.updateMsec < 300 * 1000) {
      this.averageConfig = averageConfig;
      this.An = this.averageConfig.An;
    }
  };
  public ResetMarketData = () => {
    if (this.market.type == 'BRIDGE') {
      this.UpdateMarket(1, 1);
      return;
    }
    this.market.ticker = null;
    this.market.price = 0;
    this.market.askAfterAllCost = 0;
    this.market.bidAfterAllCost = 0;
    this.market.MaxTicketSizeAskAfterAllCost = 0;
    this.market.MaxTicketSizeBidAfterAllCost = 0;
  };
  public UpdateBalance = async (msec: number) => {
    if (this.market.type == 'BRIDGE') {
      return;
    }
    //无需更新
    if (this.market.token0.updateAt == msec && this.market.token1.updateAt == msec) {
      return;
    }
    console.log('等待继承更新余额:', this.market.ex);
  };
  //这里因为是反向买回的价格,所以方向是反的
  public GetAskPriceAfterAllCostBySide = (side: number) => {
    if (this.market.market0) {
      if (side == 0) {
        let market0Price = this.market.market0.owner.GetAskPriceAfterAllCostBySide(this.market.market0.side);
        let market1Price = this.market.market1.owner.GetPriceAfterAllCostBySide(this.market.market1.side);
        if (!market0Price || !market1Price) {
          return 0;
        }
        return market0Price / market1Price;
      } else {
        let market0Price = this.market.market0.owner.GetPriceAfterAllCostBySide(this.market.market0.side);
        let market1Price = this.market.market1.owner.GetAskPriceAfterAllCostBySide(this.market.market1.side);
        if (!market0Price || !market1Price) {
          return 0;
        }
        return market1Price / market0Price;
      }
    }
    if (side == 0) {
      if (this.market.side == 0) {
        // return this.market.token0PriceAfterAllCostAsk;
        return this.market.token0PriceAfterAllCostAsk;
        // return 1 / this.market.token1PriceAfterAllCost;
      } else {
        // return this.market.token1PriceAfterAllCostAsk;
        return this.market.token1PriceAfterAllCostAsk;
        // return 1 / this.market.token0PriceAfterAllCost;
      }
    } else {
      if (this.market.side == 0) {
        // return this.market.token1PriceAfterAllCostAsk;
        return this.market.token1PriceAfterAllCostAsk;
        // return 1 / this.market.token0PriceAfterAllCost;
      } else {
        // return this.market.token0PriceAfterAllCostAsk;
        return this.market.token0PriceAfterAllCostAsk;
        // return 1 / this.market.token1PriceAfterAllCost;
      }
    }
  };
  public GetPriceAfterAllCostBySide = (side: number) => {
    if (this.market.market0) {
      if (side == 0) {
        let market0Price = this.market.market0.owner.GetPriceAfterAllCostBySide(this.market.market0.side);
        let market1Price = this.market.market1.owner.GetAskPriceAfterAllCostBySide(this.market.market1.side);
        if (!market0Price || !market1Price) {
          return 0;
        }
        return market0Price / market1Price;
      } else {
        let market0Price = this.market.market0.owner.GetAskPriceAfterAllCostBySide(this.market.market0.side);
        let market1Price = this.market.market1.owner.GetPriceAfterAllCostBySide(this.market.market1.side);
        if (!market0Price || !market1Price) {
          return 0;
        }
        return market1Price / market0Price;
      }
    }
    if (side == 0) {
      if (this.market.side == 0) {
        return this.market.token0PriceAfterAllCostBid;
        // return 1 / this.market.token1PriceAfterAllCost;
      } else {
        return this.market.token1PriceAfterAllCostBid;
        // return 1 / this.market.token0PriceAfterAllCost;
      }
    } else {
      if (this.market.side == 0) {
        return this.market.token1PriceAfterAllCostBid;
        // return 1 / this.market.token0PriceAfterAllCost;
      } else {
        return this.market.token0PriceAfterAllCostBid;
        // return 1 / this.market.token1PriceAfterAllCost;
      }
    }
  };
  public UpdateMarket = (bid: number, ask: number) => {
    let lastUpdateTime = this.lastUpdateTime;
    let trendingTimes = this.trendingTimes;
    let now = Date.now();
    if (this.market.type == 'BRIDGE') {
      bid = 1;
      ask = 1;
    } else if (this.market.ex == 'ftx') {
      if (this.timeoutHandle) {
        clearTimeout(this.timeoutHandle);
        this.timeoutHandle = null;
      }
      //如果小于50毫秒则等待
      let intervalMsec = 300 / (this.trendingTimes * 2 + 1);
      if (this.trendingTimes < 3 && (this.lastUpdateTime == 0 || now - this.lastUpdateTime < intervalMsec)) {
        if (this.lastUpdateTime == 0) {
          this.lastUpdateTime = now;
        }
        this.trendingTimes++;
        this.trendingBid = this.trendingBid || bid;
        this.trendingAsk = this.trendingAsk || ask;
        this.trendingBid = (this.trendingBid + bid) / 2;
        this.trendingAsk = (this.trendingAsk + ask) / 2;
        this.timeoutHandle = setTimeout(() => {
          clearTimeout(this.timeoutHandle);
          this.timeoutHandle = null;
          let tmpBid = this.trendingBid;
          let tmpAsk = this.trendingAsk;
          this.trendingBid = 0;
          this.trendingAsk = 0;
          this.UpdateMarket(tmpBid, tmpAsk);
        }, intervalMsec - (now - this.lastUpdateTime));
        return;
      }
      this.lastUpdateTime = 0;
    } else {
      this.lastUpdateTime = now;
    }
    this.trendingTimes = 0;
    if (!this.market.ticker) {
      this.market.ticker = new Ticker({ bid: bid.toString(), ask: ask.toString() });
    }
    this.market.ticker.bid = bid.toString();
    this.market.ticker.ask = ask.toString();
    this.market.price = (bid + ask) / 2;
    //先不启用,等数据分析后启用
    if (this.An && this.spotDx && this.spotDx.An) {
      if (this.market.side == 0) {
        bid = bid - this.An + this.spotDx.An;
        ask = ask - this.An + this.spotDx.An;
      } else {
        bid = bid - 1 / this.An + 1 / this.spotDx.An;
        ask = ask - 1 / this.An + 1 / this.spotDx.An;
      }
    }
    let gasCost = 0; //this.market.gas / this.market.MaxTicketSize;
    // this.market.allSlippage = (this.market.fee + this.market.slippage) / 1e6 + gasCost;
    this.market.bidAfterAllCost = bid * ((1e6 - this.market.fee - this.market.slippage0) / 1e6 - gasCost);
    this.market.askAfterAllCost = ask * ((1e6 + this.market.fee + this.market.slippage1) / 1e6 + gasCost);
    this.market.MaxTicketSizeBidAfterAllCost = this.market.MaxTicketSize / this.market.bidAfterAllCost;
    this.market.MaxTicketSizeAskAfterAllCost = this.market.MaxTicketSize / this.market.askAfterAllCost;

    this.market.token0PriceAfterAllCostBidOld = this.market.token0PriceAfterAllCostBid;
    this.market.token1PriceAfterAllCostBidOld = this.market.token1PriceAfterAllCostBid;
    this.market.token0PriceAfterAllCostAskOld = this.market.token0PriceAfterAllCostAsk;
    this.market.token1PriceAfterAllCostAskOld = this.market.token1PriceAfterAllCostAsk;

    this.market.token0PriceAfterAllCostBid = this.market.bidAfterAllCost;
    this.market.token1PriceAfterAllCostBid = 1 / this.market.askAfterAllCost;
    this.market.token0PriceAfterAllCostAsk = this.market.askAfterAllCost;
    this.market.token1PriceAfterAllCostAsk = 1 / this.market.bidAfterAllCost;
    if (this.market.type == 'BRIDGE' && this.market.token0.ex != this.market.token1.ex) {
      if (this.market.token0.balance < this.market.token0.minBalance) {
        this.market.token0PriceAfterAllCostBid = 0;
      }
      if (this.market.token1.balance < this.market.token1.minBalance) {
        this.market.token1PriceAfterAllCostBid = 0;
      }
    }
    let token0PriceAfterAllCostBidRatio = this.market.token0PriceAfterAllCostBidRatio;
    let token1PriceAfterAllCostBidRatio = this.market.token1PriceAfterAllCostBidRatio;
    let token0PriceAfterAllCostAskRatio = this.market.token0PriceAfterAllCostAskRatio;
    let token1PriceAfterAllCostAskRatio = this.market.token1PriceAfterAllCostAskRatio;

    // this.market.token0PriceAfterAllCostBidRatio = 0;
    // this.market.token1PriceAfterAllCostBidRatio = 0;
    // this.market.token0PriceAfterAllCostAskRatio = 0;
    // this.market.token1PriceAfterAllCostAskRatio = 0;
    this.market.spotPrice0WithFee = this.lastBlockConfirmPrice * (1 - this.market.fee / 1e6);
    this.market.spotPrice1WithFee = this.lastBlockConfirmPrice * (1 - this.market.fee / 1e6);
    if (this.market.token0PriceAfterAllCostBid != this.market.token0PriceAfterAllCostBidOld) {
      this.market.token0PriceAfterAllCostBidRatio =
        (this.market.token0PriceAfterAllCostBid - this.market.token0PriceAfterAllCostBidOld) /
        this.market.token0PriceAfterAllCostBidOld;
    }
    if (this.market.token1PriceAfterAllCostBid != this.market.token1PriceAfterAllCostBidOld) {
      this.market.token1PriceAfterAllCostBidRatio =
        (this.market.token1PriceAfterAllCostBid - this.market.token1PriceAfterAllCostBidOld) /
        this.market.token1PriceAfterAllCostBidOld;
    }
    if (this.market.token0PriceAfterAllCostAsk != this.market.token0PriceAfterAllCostAskOld) {
      this.market.token0PriceAfterAllCostAskRatio =
        (this.market.token0PriceAfterAllCostAsk - this.market.token0PriceAfterAllCostAskOld) /
        this.market.token0PriceAfterAllCostAskOld;
    }
    if (this.market.token1PriceAfterAllCostAsk != this.market.token1PriceAfterAllCostAskOld) {
      this.market.token1PriceAfterAllCostAskRatio =
        (this.market.token1PriceAfterAllCostAsk - this.market.token1PriceAfterAllCostAskOld) /
        this.market.token1PriceAfterAllCostAskOld;
    }
    this.thresholdBase = 1;
    if (this.market.type == 'CX') {
      //如果价格同向了说明趋势形成了,加快步伐
      // console.log(
      //   'UpdateMarket:0:0:',
      //   this.market.ex,
      //   token1PriceAfterAllCostAskRatio,
      //   this.market.token1PriceAfterAllCostAskRatio,
      //   this.thresholdBase,
      // );
      if (
        // token0PriceAfterAllCostBidRatio * this.market.token0PriceAfterAllCostBidRatio > 0 &&
        // token1PriceAfterAllCostBidRatio * this.market.token1PriceAfterAllCostBidRatio > 0 &&
        // token0PriceAfterAllCostAskRatio * this.market.token0PriceAfterAllCostAskRatio > 0 &&
        token1PriceAfterAllCostAskRatio * this.market.token1PriceAfterAllCostAskRatio >
        0
      ) {
        this.thresholdBase = 2;
      }
      // console.log(
      //   'UpdateMarket:0:1:',
      //   this.market.ex,
      //   token1PriceAfterAllCostAskRatio,
      //   this.market.token1PriceAfterAllCostAskRatio,
      //   this.thresholdBase,
      // );
    }
    let needUpdate = false;
    //下面这个只是简单记录下上次变化价格,如果价格没变就不做计算
    if (this.market.lastToken0PriceAfterAllCost != this.market.token0PriceAfterAllCostBid) {
      this.market.lastToken0PriceAfterAllCost = this.market.token0PriceAfterAllCostBid;
      console.log(
        'UpdateMarket:1:',
        now - lastUpdateTime,
        trendingTimes,
        this.market.ex,
        this.market.symbol,
        this.market.token0.symbol,
        this.market.token1.symbol,
        this.An,
        this.spotDx?.An,
        this.market.token0PriceAfterAllCostBid,
        this.market.token1PriceAfterAllCostBid,
        this.market.token0PriceAfterAllCostBidRatio,
        this.market.token1PriceAfterAllCostBidRatio,
        this.market.token0PriceAfterAllCostAskRatio,
        this.market.token1PriceAfterAllCostAskRatio,
        this.thresholdBase,
        (this.market.fee + this.market.slippage0) / 1e6 + gasCost,
      );
      needUpdate = true;
    }
    if (needUpdate && this.market.type == 'CX') {
      //如果区块已经确认超过1.5秒就等下一区块回来再更新,否则信息差可能不划算
      if (true || !lastConfirmMsec || Date.now() - lastConfirmMsec < 3000) {
        for (let tokenPath of this.tokenPaths) {
          if (tokenPath.spotCx == (this as unknown as SpotCx)) {
            // console.log('交易所刷新:', this.market.symbol);
            //刷新
            // tokenPath.UpdatePosition();
            //暂时屏蔽链下触发看是否有效果
            tokenPath.SetLoopFlag(true);
            tokenPath.chanceType = 0;
          }
        }
      } else {
        console.log('新区块马上出现,先等等:', Date.now() - lastConfirmMsec);
      }
    }
    if (this.market.parent) {
      let bidtmp = this.market.parent.owner.GetAskPriceAfterAllCostBySide(0);
      let asktmp = 1 / this.market.parent.owner.GetAskPriceAfterAllCostBySide(1);
      this.market.parent.owner.UpdateMarket(bidtmp, asktmp);
    }
  };
  public UpdateMarketConfirm = (bid: number, ask: number) => {
    if (this.market.type == 'CX' && this.market.side == 1) {
      bid = 1 / bid;
      ask = 1 / ask;
    }
    this.priceConfirm = (bid + ask) / 2;
    let gasCost = this.market.gas / this.market.MaxTicketSize;
    this.bidAfterAllCostConfirm = (bid * (1e6 + this.market.fee + this.market.slippage0)) / 1e6 + gasCost;
    this.askAfterAllCostConfirm = (ask * (1e6 - this.market.fee - this.market.slippage1)) / 1e6 - gasCost;
    this.market.MaxTicketSizeBidAfterAllCost = this.market.MaxTicketSize / this.market.bidAfterAllCost;
    this.market.MaxTicketSizeAskAfterAllCost = this.market.MaxTicketSize / this.market.askAfterAllCost;
  };
  public GetMarketLog = () => {
    let desc = `${this.market.price}\t${this.market.ticker?.bid}\t${this.market.ticker?.ask}\t${this.market.bidAfterAllCost}\t${this.market.askAfterAllCost}\t${this.market.MaxTicketSizeBidAfterAllCost}\t${this.market.MaxTicketSizeAskAfterAllCost}\t${this.An}`;
    // let desc = `${this.market.price}\t${this.market.bidAfterAllCost}\t${this.market.askAfterAllCost}\t${this.market.MaxTicketSizeBidAfterAllCost}\t${this.market.MaxTicketSizeAskAfterAllCost}`;
    return desc;
  };
  public isStartToken = (tokenKey: string) => {
    return this.market.priority == 0 && this.market.token0.key == tokenKey;
  };

  public UpdateActualPosition = async (tokenPath: TokenPath) => {
    this.gridConfig.pairId = this.gridConfig.pairId || 0;
    let nonceData = (await tokenPath.instanceTrendingCall.getPairList())[this.gridConfig.pairId];
    console.log('nonceData:', nonceData);
    this.gridConfig.ActualPosition = parseFloat(nonceData.position0.toString()) / tokenPath.startToken.one;
  };
  public ResetActualPositionConfirm = async (tokenPath: TokenPath) => {
    await this.UpdateActualPosition(tokenPath);
    this.gridConfig.TargetNotional = Math.round(
      (this.gridConfig.ActualPosition + this.gridConfig.ActualPositionOffset) / this.gridConfig.UnitNotional,
    );
    let TargetNotional = this.gridConfig.TargetNotional;
    if (TargetNotional == 0) {
      console.log(
        'ResetActualPositionConfirm:0:',
        TargetNotional,
        this.gridConfig.OnOverOffPositivePosition,
        this.gridConfig.OnOverOffPositivePositionConfirm,
        this.gridConfig.OnOverOffNegativePosition,
        this.gridConfig.OnOverOffNegativePositionConfirm,
      );
      this.gridConfig.OnOverOffPositivePosition = 0;
      this.gridConfig.OnOverOffPositivePositionPending = 0;
      this.gridConfig.OnOverOffPositivePositionConfirm = 0;
      this.gridConfig.OnOverOffNegativePosition = 0;
      this.gridConfig.OnOverOffNegativePositionPending = 0;
      this.gridConfig.OnOverOffNegativePositionConfirm = 0;
    } else if (TargetNotional > 0) {
      console.log(
        'ResetActualPositionConfirm:1:',
        TargetNotional,
        this.gridConfig.OnOverOffPositivePosition,
        this.gridConfig.OnOverOffPositivePositionConfirm,
        this.gridConfig.OnOverOffNegativePosition,
        this.gridConfig.OnOverOffNegativePositionConfirm,
      );
      this.gridConfig.OnOverOffPositivePosition = TargetNotional;
      this.gridConfig.OnOverOffPositivePositionPending = TargetNotional;
      this.gridConfig.OnOverOffPositivePositionConfirm = TargetNotional;
      this.gridConfig.OnOverOffNegativePosition = 0;
      this.gridConfig.OnOverOffNegativePositionPending = 0;
      this.gridConfig.OnOverOffNegativePositionConfirm = 0;
    } else if (TargetNotional < 0) {
      console.log(
        'ResetActualPositionConfirm:1:',
        TargetNotional,
        this.gridConfig.OnOverOffPositivePosition,
        this.gridConfig.OnOverOffPositivePositionConfirm,
        this.gridConfig.OnOverOffNegativePosition,
        this.gridConfig.OnOverOffNegativePositionConfirm,
      );
      this.gridConfig.OnOverOffPositivePosition = 0;
      this.gridConfig.OnOverOffPositivePositionPending = 0;
      this.gridConfig.OnOverOffPositivePositionConfirm = 0;
      this.gridConfig.OnOverOffNegativePosition = -TargetNotional;
      this.gridConfig.OnOverOffNegativePositionPending = -TargetNotional;
      this.gridConfig.OnOverOffNegativePositionConfirm = -TargetNotional;
    }
    this.SaveStatusConfig();
  };
}
//
