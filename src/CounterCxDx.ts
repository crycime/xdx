import { Logger } from 'log4js';
import moment from 'moment';
import * as ccxt from 'ccxt';

import { Sleep } from './utils';
import { OrderInfo, CxContract } from './constants';
import { SpotEx } from './SpotEx';
import { BinanceAccountListenWs } from '../src/BinanceAccountListenWs';
import { sendBotMessage } from '../src/telegram-bot';
import { BADQUERY } from 'dns';

type LocalTimeOrder = ccxt.Order & {
  localTimestamp: number;
};
//柜台程序
export class CounterCxDx {
  public logger: Logger;
  public futureOrderMap: Map<string, Map<string, ccxt.Order>>; //contractname->order.id->order,
  public waitingOrderMap: Map<string, LocalTimeOrder>; //等待成交的单子
  public waitingCxOrderInfoMap: Map<string, OrderInfo>; //
  public openOrderMap: Map<string, ccxt.Order>; //已经成交完成的单子
  public marketMap: Map<string, ccxt.Market>; //保存当前的市场信息
  public createOrderInfos: OrderInfo[];
  public cxContractMap: Map<string, CxContract>;
  public cxContracts: CxContract[];
  private _botNotifyed: boolean; //是否已经通知过,避免下反复通知
  private _orderTimes: number; //测试状态下控制下单次数,得睡觉了
  constructor(_cxContracts: CxContract[], _logger: Logger) {
    this.cxContracts = _cxContracts;
    this.logger = _logger;
    this.futureOrderMap = new Map<string, Map<string, ccxt.Order>>();
    this.waitingOrderMap = new Map<string, LocalTimeOrder>();
    this.waitingCxOrderInfoMap = new Map<string, OrderInfo>();
    this.openOrderMap = new Map<string, ccxt.Order>();
    this.marketMap = new Map<string, ccxt.Market>();
    this.createOrderInfos = [];
    this.cxContractMap = new Map<string, CxContract>();
    this._orderTimes = 0;
    this._botNotifyed = false;
    for (let contract of _cxContracts) {
      this.futureOrderMap.set(contract.ContractName, new Map<string, ccxt.Order>());
      this.cxContractMap.set(contract.ContractName, contract);
    }
  }
  public AddContract = (contract: CxContract) => {
    if (!this.futureOrderMap.has(contract.ContractName)) {
      this.futureOrderMap.set(contract.ContractName, new Map<string, ccxt.Order>());
      console.log('新增对冲合约:', contract.ContractName);
    } else {
      console.log('忽略新增对冲合约已经存在:', contract.ContractName);
    }
    this.cxContractMap.set(contract.ContractName, contract);
  };
  public Init = async () => {
    return true;
    // this.RecordOpenFutrue();
  };
}
