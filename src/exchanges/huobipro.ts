import ccxt from 'ccxt';
import Decimal from 'decimal.js';
import moment from 'moment';
import pako from 'pako';
import CryptoJS from 'crypto-js';
import * as R from 'ramda';
import url from 'url';

import { WsAccount } from '../ws-account';
import {
  BalanceUpdate,
  ExchangeCredentials,
  Order,
  OrderEventType,
  OrderExecutionType,
  OrderInput,
  OrderStatus,
  PositionUpdate,
  Trade,
  WalletType,
} from './exchange';

type HuobiProConstructorParams = {
  url: string;
  debug: boolean;
  credentials: ExchangeCredentials;
};

enum HuobiProSpotOrderExecutionType {
  NEW = 'NEW',
  CANCELED = 'CANCELED',
  REPLACED = 'REPLACED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  TRADE = 'TRADE',
}

enum HuobiProSpotOrderStatus {
  NEW = 'NEW',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELED = 'CANCELED',
  PENDING_CANCEL = 'PENDING_CANCEL',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

type HuobiProSpotMessage =
  | HuobiProSpotOrderMessage
  | HuobiProSpotTradeMessage
  | HuobiProSpotAccountInfoMessage
  | HuobiProSpotAccountPositionMessage;

type HuobiProSpotAccountPositionMessage = {
  e: 'outboundAccountPosition'; // Event type
  E: number; // Event time
  u?: number; // Time of last account update
  B?: {
    a: string; // Asset
    f: string; // Free amount
    l: string; // Locked amount
  }[];
};

type HuobiProSpotAccountInfoMessage = {
  e: 'outboundAccountInfo'; // Event type
  E: number; // Event time
  m?: number; // Maker commission rate (bips)
  t?: number; // Taker commission rate (bips)
  b?: number; // Buyer commission rate (bips)
  s?: number; // Seller commission rate (bips)
  T?: boolean; // Can trade?
  W?: boolean; // Can withdraw?
  D?: boolean; // Can deposit?
  u?: number; // Time of last account update
  B?: {
    a: string; // Asset
    f: string; // Free amount
    l: string; // Locked amount
  }[];
};

type HuobiProSpotTradeMessage = HuobiProSpotOrderMessage & { x: HuobiProSpotOrderExecutionType.TRADE };
type HuobiProSpotOrderMessage = {
  e: 'executionReport'; // Event type
  E: number; // Event time
  s: string; // Symbol
  c: string; // Client order ID
  S: 'BUY' | 'SELL'; // Side
  o: 'LIMIT'; // Order type
  f: 'GTC'; // Time in force
  q: string; // Order quantity
  p: string; // Order price
  P: string; // Stop price
  F: string; // Iceberg quantity
  g: number; // OrderListId
  C: string; // Original client order ID; This is the ID of the order being canceled
  x: HuobiProSpotOrderExecutionType; // Current execution type
  X: HuobiProSpotOrderStatus; // Current order status
  r: string; // Order reject reason; will be an error code.
  i: number; // Order ID
  l: string; // Last executed quantity
  z: string; // Cumulative filled quantity
  L: string; // Last executed price
  n: string; // Commission amount
  N: null; // Commission asset
  T: number; // Transaction time
  t: number; // Trade ID
  I: number; // Ignore
  w: boolean; // Is the order working? Stops will have
  m: boolean; // Is this trade the maker side?
  M: boolean; // Ignore
  O: number; // Order creation time
  Z: string; // Cumulative quote asset transacted quantity
  Y: string; // Last quote asset transacted quantity (i.e. lastPrice * lastQty)
};

enum HuobiProFutureOrderExecutionType {
  NEW = 'NEW',
  PARTIAL_FILL = 'PARTIAL_FILL',
  FILL = 'FILL',
  CANCELED = 'CANCELED',
  PENDING_CANCEL = 'PENDING_CANCEL',
  REJECTED = 'REJECTED',
  CALCULATED = 'CALCULATED', // Liquidation Execution
  EXPIRED = 'EXPIRED',
  TRADE = 'TRADE',
  RESTATED = 'RESTATED',
}

enum HuobiProFutureOrderStatus {
  NEW = 'NEW',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELED = 'CANCELED',
  PENDING_CANCEL = 'PENDING_CANCEL',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  REPLACED = 'REPLACED',
  STOPPED = 'STOPPED',
  NEW_INSURANCE = 'NEW_INSURANCE', // Liquidation with Insurance Fund
  NEW_ADL = 'NEW_ADL', // Counterparty Liquidation
}

type HuobiProFutureMessage = HuobiProFutureOrderMessage | HuobiProFutureTradeMessage | HuobiProFutureAccountInfoMessage;

type HuobiProFutureAccountInfoMessage = {
  e: 'ACCOUNT_UPDATE'; // Event type
  E: number; // Event time
  a: {
    B: HuobiProFutureBalanceMessage[];
    P: HuobiProFuturePositionMessage[];
  };
};

type HuobiProFutureBalanceMessage = {
  a: string; // Asset
  wb: string; // Wallet Balance
  cw: string; // Cross Wallet Balance
};

type HuobiProFuturePositionMessage = {
  s: string; // Symbol
  pa: string; // Position Amount
  ep: string; // Entry Price
  cr: string; // (Pre-fee) accumulated realized
  up: string; // Unrealized PnL
  mt: string; // Margin Type
  iw: string; // Isolated Wallet (if isolated position)
  ps: string; // Position Side
};

type HuobiProFutureTradeMessage = HuobiProFutureOrderMessage & {
  o: HuobiProFutureOrderObject & { x: HuobiProFutureOrderExecutionType.TRADE };
};
type HuobiProFutureOrderMessage = {
  e: 'ORDER_TRADE_UPDATE'; // Event type
  E: number; // Event time
  T: number; // Transaction Time
  o: HuobiProFutureOrderObject;
};
type HuobiProFutureOrderObject = {
  s: string; // Symbol
  c: string; // Client order ID
  S: 'BUY' | 'SELL'; // Side
  o: 'MARKET' | 'LIMIT' | 'STOP'; // Order type
  f: 'GTC'; // Time in force
  q: string; // Order quantity
  p: string; // Order price
  ap: string; // Average price
  sp: string; // Stop price
  ps: string; // Position side
  x: HuobiProFutureOrderExecutionType; // Current execution type
  X: HuobiProFutureOrderStatus; // Current order status
  i: number; // Order ID
  l: string; // Order Last Filled Quantity
  z: string; // Order Filled Accumulated Quantity
  L: string; // Last Filled Price
  N: string | null; // Commission Asset (Will not push if no commission)
  n: string | null; // Commission amount (Will not push if no commission)
  T: number; // Transaction time
  t: number; // Trade Id
  b: number; // Bids Notional
  a: number; // Ask Notional
  m: boolean; // Is this trade the maker side?
  R: boolean; // Is this reduce only
  wt: string; // stop price working type
  cp: boolean; // If Close-All, pushed with conditional order
  AP: string; // Activation Price, only puhed with TRAILING_STOP_MARKET order
  cr: string; // Callback Rate, only puhed with TRAILING_STOP_MARKET order
  ot: string; // Original type
};

const isHuobiProSpotOrderMessage = (message: HuobiProSpotMessage): message is HuobiProSpotOrderMessage => {
  return (
    (message as HuobiProSpotOrderMessage).e === 'executionReport' &&
    ((message as HuobiProSpotOrderMessage).x as string) !== 'TRADE'
  );
};

const isHuobiProSpotTradeMessage = (message: HuobiProSpotMessage): message is HuobiProSpotTradeMessage => {
  return (
    (message as HuobiProSpotTradeMessage).e === 'executionReport' && (message as HuobiProSpotTradeMessage).x === 'TRADE'
  );
};

const isHuobiProSpotAccountInfoMessage = (message: HuobiProSpotMessage): message is HuobiProSpotAccountInfoMessage => {
  return (message as HuobiProSpotAccountInfoMessage).e === 'outboundAccountInfo';
};

const isHuobiProSpotAccountPositionMessage = (
  message: HuobiProSpotMessage
): message is HuobiProSpotAccountPositionMessage => {
  return (message as HuobiProSpotAccountPositionMessage).e === 'outboundAccountPosition';
};

const isHuobiProFutureOrderMessage = (message: HuobiProFutureMessage): message is HuobiProFutureOrderMessage => {
  return (
    (message as HuobiProFutureOrderMessage).e === 'ORDER_TRADE_UPDATE' &&
    ((message as HuobiProFutureOrderMessage).o.x as string) !== 'TRADE'
  );
};

const isHuobiProFutureTradeMessage = (message: HuobiProFutureMessage): message is HuobiProFutureTradeMessage => {
  return (
    (message as HuobiProFutureTradeMessage).e === 'ORDER_TRADE_UPDATE' &&
    (message as HuobiProFutureTradeMessage).o.x === 'TRADE'
  );
};

const isHuobiProFutureAccountInfoMessage = (
  message: HuobiProFutureMessage
): message is HuobiProFutureAccountInfoMessage => {
  return (message as HuobiProFutureAccountInfoMessage).e === 'ACCOUNT_UPDATE';
};

export class HuobiProAccount extends WsAccount {
  private _publicCcxtInstance: ccxt.Exchange;
  private _keepAliveInterval?: NodeJS.Timeout;
  private _listenKey?: string;

  constructor(params: HuobiProConstructorParams) {
    super({ ...params, name: 'huobipro' });
    this.subscriptionKeyMapping = {};
    this._publicCcxtInstance = new ccxt['huobipro']();
    this._walletType = this._walletType || 'spot';
  }

  protected onMessage = async (event: MessageEvent) => {
    let data = event.data;
    let messageText = '';
    if (typeof data === 'string') {
      messageText = data;
    } else if (data instanceof Buffer) {
      messageText = data.toString('utf8');
    } else if (data instanceof ArrayBuffer) {
      messageText = Buffer.from(data).toString('utf8');
    } else if (Array.isArray(data) && data?.[0] instanceof Buffer) {
      messageText = Buffer.concat(data).toString('utf8');
    }

    const msg: { action: string; data: { [prop: string]: unknown } | null; [prop: string]: unknown } =
      JSON.parse(messageText);

    if (msg.action == 'ping') {
      const pong = {
        action: 'pong',
        ts: msg?.data?.ts,
      };
      this.send(JSON.stringify(pong));
    } else if (msg.action == 'req' && msg.ch == 'auth') {
      // if (this._keepAliveInterval) {
      //   clearInterval(this._keepAliveInterval);
      // }
      // this._keepAliveInterval = setInterval(this._keepAlive, 1000 * 60 * 30);
      if (msg.code == 200) {
        this.debug(`auth success`);
        this._sub(`accounts.update`);
        this._sub(`orders#grtusdt`);
        // this._action(`req`, `topic`);
        //TODO subscribte
      } else {
        this.debug(`auth error:${msg}`);
      }
    } else {
      this.debug(`TODO:${messageText}`);
    }
  };

  private onSpotMessages = async (event: MessageEvent) => {
    const data: HuobiProSpotMessage = JSON.parse(event.data);

    if (isHuobiProSpotOrderMessage(data)) {
      const orderId = this.getSpotOrderId(data);
      await this.lock.acquire(orderId, async () => {
        const type = this.getSpotOrderEventType(data);
        const order = await this.parseSpotOrder(data);
        await this.saveCachedOrder(order);
        await this.updateFeeFromTrades({ orderId });
        this.onOrder({ type, order: this.getCachedOrder(orderId) });
      });
    } else if (isHuobiProSpotTradeMessage(data)) {
      const orderId = this.getSpotOrderId(data);
      await this.lock.acquire(orderId, async () => {
        const type = this.getSpotOrderEventType(data);
        const order = await this.parseSpotOrder(data);
        await this.saveCachedOrder(order);
        const trade = await this.parseSpotTrade(data);
        await this.saveCachedTrade({ trade, orderId });
        await this.updateFeeFromTrades({ orderId });
        this.onOrder({ type, order: this.getCachedOrder(orderId) });
      });
    } else if (isHuobiProSpotAccountInfoMessage(data)) {
      const balance = this.parseSpotBalance(data);
      if (balance) {
        this.emit('fullBalance', { update: balance });
      }
    } else if (isHuobiProSpotAccountPositionMessage(data)) {
      const balance = this.parseSpotBalance(data);
      if (balance) {
        this.emit('balance', { update: balance });
      }
    }
  };

  private onFutureMessages = async (event: MessageEvent) => {
    const { data }: any = JSON.parse(event.data);

    if (isHuobiProFutureOrderMessage(data) || isHuobiProFutureTradeMessage(data)) {
      const orderId = this.getFutureOrderId(data);
      await this.lock.acquire(orderId, async () => {
        const type = this.getFutureOrderEventType(data);
        const order = await this.parseFutureOrder(data);
        await this.saveCachedOrder(order);
        await this.updateFeeFromTrades({ orderId });
        this.onOrder({ type, order: this.getCachedOrder(orderId) });
      });
    } else if (isHuobiProFutureTradeMessage(data)) {
      const orderId = this.getFutureOrderId(data);
      await this.lock.acquire(orderId, async () => {
        const type = this.getFutureOrderEventType(data);
        const order = await this.parseFutureOrder(data);
        await this.saveCachedOrder(order);
        const trade = await this.parseFutureTrade(data);
        await this.saveCachedTrade({ trade, orderId });
        await this.updateFeeFromTrades({ orderId });
        this.onOrder({ type, order: this.getCachedOrder(orderId) });
      });
    } else if (isHuobiProFutureAccountInfoMessage(data)) {
      const positions = this.parseFuturePositions(data);
      if (positions.length) {
        this.emit('positions', { update: positions });
      }
    }
  };

  private _keepAlive = async () => {
    const ping = {
      action: 'ping',
      ts: Date.now(),
    };
    this.send(JSON.stringify(ping));
  };

  private _sub = async (ch: string) => {
    this._action('sub', ch);
  };

  private _action = async (action: string, ch: string) => {
    const data = {
      action: action,
      ch: ch,
    };
    this._ws?.send(JSON.stringify(data));
  };

  /**
   * 签名计算
   * @param method
   * @param host
   * @param path
   * @param data
   * @returns {*|string}
   */
  private _sign_sha = (method: string, host: string, path: string, data: any): any => {
    var pars = [];

    //将参数值 encode
    for (let item in data) {
      pars.push(item + '=' + encodeURIComponent('' + data[item]));
    }

    //排序 并加入&连接
    var p = pars.sort().join('&');

    // 在method, host, path 后加入\n
    var meta = [method, host, path, p].join('\n');

    //用HmacSHA256 进行加密
    var hash = CryptoJS.HmacSHA256(meta, this.getCredentials().secret!);
    // 按Base64 编码 字符串
    var Signature = CryptoJS.enc.Base64.stringify(hash);
    // console.log(p);
    return Signature;
  };
  private _doAuth = async () => {
    const timestamp = moment.utc().format('YYYY-MM-DDTHH:mm:ss');

    let signPayload: any = {
      accessKey: this.getCredentials().apiKey,
      signatureMethod: 'HmacSHA256',
      signatureVersion: '2.1',
      timestamp: timestamp,
    };

    const parsedUrl = url.parse(this._url);
    //计算签名
    let signature = this._sign_sha('GET', parsedUrl!.host!, parsedUrl!.path!, signPayload);
    const payload = {
      action: 'req',
      ch: 'auth',
      params: {
        authType: 'api',
        ...signPayload,
        signature,
      },
    };
    this.send(JSON.stringify(payload));
  };

  protected preConnect = async () => {};

  protected onOpen = async () => {
    console.log('open');
    await this._doAuth();
  };

  public createOrder = async ({ order }: { order: OrderInput }) => {
    const ccxtInstance = new ccxt['huobipro']({ ...this.getCredentials() });

    const options: any = {};
    if (order.clientId) {
      options['newClientOrderId'] = parseInt(order.clientId);
    }
    const result: Order = await ccxtInstance.createOrder(
      order.symbol,
      'limit',
      order.side,
      order.amount,
      order.price,
      options
    );
    await this.saveCachedOrder(result);
  };

  public cancelOrder = async ({ id }: { id: string }) => {
    const ccxtInstance = new ccxt['huobipro']({ ...this.getCredentials() });

    const order = this.getCachedOrder(id);
    await ccxtInstance.cancelOrder(id, order.symbol);
  };

  public createClientId = () => {
    return this._random().toString();
  };

  private getOrderType = (type: 'LIMIT' | 'MARKET' | 'STOP'): OrderExecutionType => {
    return type.toLocaleLowerCase();
  };

  private getSpotOrderId = (message: HuobiProSpotOrderMessage) => {
    const id = message.i.toString();

    if (!id) {
      throw new Error('Invalid order message from huobipro.');
    }

    return id;
  };

  private parseSpotOrder = (message: HuobiProSpotOrderMessage): Order => {
    const statuses: Record<HuobiProSpotOrderStatus, OrderStatus> = {
      NEW: 'open',
      PARTIALLY_FILLED: 'open',
      FILLED: 'closed',
      CANCELED: 'canceled',
      PENDING_CANCEL: 'open', // currently unused
      REJECTED: 'failed',
      EXPIRED: 'canceled',
    };

    const id = this.getSpotOrderId(message);
    const originalOrder = this.getCachedOrder(id);

    const cost = parseFloat(message.Z);
    const filled = parseFloat(message.z);
    const amount = parseFloat(message.q);
    const order: Order = {
      amount,
      cost,
      datetime: moment(message.T).toISOString(),
      timestamp: message.T,
      filled: parseFloat(message.z),
      info: message,
      price: cost && filled ? cost / filled : parseFloat(message.p),
      remaining: amount - filled,
      side: message.S === 'BUY' ? 'buy' : 'sell',
      status: statuses[message.X],
      symbol: this._publicCcxtInstance.markets_by_id[message.s]
        ? this._publicCcxtInstance.markets_by_id[message.s].symbol
        : message.s,
      trades: [],
      type: this.getOrderType(message.o),
      clientId: message.c ? message.c : undefined,
      id,
    };

    const mergedOrder = R.mergeDeepWith((left, right) => (right === undefined ? left : right), originalOrder, order);

    return mergedOrder;
  };

  private parseSpotTrade = (message: HuobiProSpotTradeMessage): Trade => {
    const price = parseFloat(message.L);
    const amount = parseFloat(message.l);
    return {
      info: message,
      timestamp: message.T,
      datetime: moment(message.T).toISOString(),
      symbol: this._publicCcxtInstance.markets_by_id[message.s]
        ? this._publicCcxtInstance.markets_by_id[message.s].symbol
        : message.s,
      id: message.t.toString(),
      order: message.c,
      type: this.getOrderType(message.o),
      takerOrMaker: message.m ? 'maker' : 'taker',
      side: message.S === 'BUY' ? 'buy' : 'sell',
      price,
      amount,
      cost: price * amount,
      fee: {
        cost: parseFloat(message.n),
        currency: this._publicCcxtInstance.safeCurrencyCode(message.N),
      },
    };
  };

  private getSpotOrderEventType = (message: HuobiProSpotOrderMessage) => {
    const id = Object.keys(message)[0];

    if (!id) {
      throw new Error('Invalid order message from huobipro.');
    }

    const newStatus = message.X;
    const originalOrder = this.getCachedOrder(id);

    if (!newStatus) {
      return OrderEventType.ORDER_UPDATED;
    }

    if (!originalOrder) {
      return OrderEventType.ORDER_CREATED;
    }

    if (newStatus === 'FILLED' && originalOrder.status !== 'closed') {
      return OrderEventType.ORDER_CLOSED;
    } else if (newStatus === 'CANCELED' && originalOrder.status !== 'canceled') {
      return OrderEventType.ORDER_CANCELED;
    } else if (newStatus === 'REJECTED' && originalOrder.status !== 'failed') {
      return OrderEventType.ORDER_FAILED;
    }

    return OrderEventType.ORDER_UPDATED;
  };

  private parseSpotBalance = (
    message: HuobiProSpotAccountInfoMessage | HuobiProSpotAccountPositionMessage
  ): BalanceUpdate | undefined => {
    const update: BalanceUpdate = { info: message as any };

    if (!message.B) {
      return undefined;
    }

    for (const updateMessage of message.B) {
      const free = parseFloat(updateMessage.f);
      const used = parseFloat(updateMessage.l);
      const code = this._ccxtInstance['safeCurrencyCode'](updateMessage.a);
      update[code] = {
        free,
        used,
        total: free + used,
      };
    }

    return this._ccxtInstance['parseBalance'](update);
  };

  private getFutureOrderId = (message: HuobiProFutureOrderMessage) => {
    const id = message.o.i.toString();

    if (!id) {
      throw new Error('Invalid order message from huobipro.');
    }

    return id;
  };

  private getFutureOrderEventType = (message: HuobiProFutureOrderMessage) => {
    const id = message.o && message.o.i ? message.o.i : undefined;

    if (!id) {
      throw new Error('Invalid order message from huobipro.');
    }

    const newStatus = message.o.X;
    const originalOrder = this.getCachedOrder(id);

    if (!newStatus) {
      return OrderEventType.ORDER_UPDATED;
    }

    if (!originalOrder) {
      return OrderEventType.ORDER_CREATED;
    }

    if (newStatus === 'FILLED' && originalOrder.status !== 'closed') {
      return OrderEventType.ORDER_CLOSED;
    } else if (newStatus === 'CANCELED' && originalOrder.status !== 'canceled') {
      return OrderEventType.ORDER_CANCELED;
    } else if (newStatus === 'REJECTED' && originalOrder.status !== 'failed') {
      return OrderEventType.ORDER_FAILED;
    }

    return OrderEventType.ORDER_UPDATED;
  };

  private parseFutureOrder = (message: HuobiProFutureOrderMessage): ccxt.Order => {
    const statuses: Record<HuobiProFutureOrderStatus, OrderStatus> = {
      NEW: 'open',
      PARTIALLY_FILLED: 'open',
      FILLED: 'closed',
      CANCELED: 'canceled',
      PENDING_CANCEL: 'open',
      REJECTED: 'failed',
      EXPIRED: 'canceled',
      REPLACED: 'open',
      STOPPED: 'canceled',
      NEW_INSURANCE: 'open', // Liquidation with Insurance Fund
      NEW_ADL: 'open', // Counterparty Liquidation
    };

    const rawOrder = message.o;

    const id = this.getFutureOrderId(message);
    const originalOrder = this.getCachedOrder(id);
    const average = parseFloat(rawOrder.ap);
    const amount = parseFloat(rawOrder.q);

    const originalPrice = parseFloat(rawOrder.p);
    const lastFilledPrice = parseFloat(rawOrder.L);
    const filled = parseFloat(rawOrder.l);
    const cost = lastFilledPrice * amount;

    const order: Order = {
      info: message,
      symbol: this._publicCcxtInstance.markets_by_id[rawOrder.s]
        ? this._publicCcxtInstance.markets_by_id[rawOrder.s].symbol
        : rawOrder.s,
      status: statuses[rawOrder.X],
      price: cost && filled ? cost / filled : originalPrice,
      average,
      amount,
      remaining: amount - filled,
      cost,
      datetime: moment(message.T).toISOString(),
      timestamp: message.T,
      filled,
      side: rawOrder.S === 'BUY' ? 'buy' : 'sell',
      trades: [],
      type: this.getOrderType(rawOrder.o),
      clientId: rawOrder.c ? rawOrder.c : undefined,
      id,
    };

    const mergedOrder = R.mergeDeepWith((left, right) => (right === undefined ? left : right), originalOrder, order);

    return mergedOrder;
  };

  private parseFutureTrade = (message: HuobiProFutureOrderMessage): Trade => {
    const rawTrade = message.o;
    const price = parseFloat(rawTrade.L);
    const amount = parseFloat(rawTrade.l);
    return {
      info: message,
      timestamp: message.T,
      datetime: moment(message.T).toISOString(),
      symbol: this._publicCcxtInstance.markets_by_id[rawTrade.s]
        ? this._publicCcxtInstance.markets_by_id[rawTrade.s].symbol
        : rawTrade.s,
      id: rawTrade.t.toString(),
      order: rawTrade.i.toString(),
      type: this.getOrderType(rawTrade.o),
      takerOrMaker: rawTrade.m ? 'maker' : 'taker',
      side: rawTrade.S === 'BUY' ? 'buy' : 'sell',
      price,
      amount,
      cost: price * amount,
      fee: {
        cost: rawTrade.n ? parseFloat(rawTrade.n) : 0,
        currency: this._publicCcxtInstance.safeCurrencyCode(rawTrade.N),
      },
    };
  };

  private parseFuturePositions = (message: HuobiProFutureAccountInfoMessage): PositionUpdate => {
    const update: PositionUpdate = [];

    for (const rawPosition of message.a.P) {
      const amount = parseFloat(rawPosition.pa);
      const unrealizedPnL = parseFloat(rawPosition.up);
      const entryPrice = parseFloat(rawPosition.ep);
      const side = rawPosition.ps.toLowerCase();
      const symbol = this._publicCcxtInstance.markets_by_id[rawPosition.s]
        ? this._publicCcxtInstance.markets_by_id[rawPosition.s].symbol
        : rawPosition.s;

      const markPrice =
        amount !== 0 ? new Decimal(entryPrice).plus(new Decimal(unrealizedPnL).div(amount).toString()).toNumber() : 0;

      update.push({
        info: rawPosition,
        symbol,
        amount,
        entryPrice,
        markPrice,
        side,
      });
    }

    return update;
  };
}
