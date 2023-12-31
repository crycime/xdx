import AsyncLock from 'async-lock';
import ccxt from 'ccxt';
import domain from 'domain';
import { EventEmitter } from 'events';
import * as R from 'ramda';
import ReconnectingWebSocket from 'reconnecting-websocket';
import uniqueRandom from 'unique-random';
import WebSocket from 'ws';

import { WsClient } from './ws-client';
import { ExchangeName, ExchangeType } from './index';
import {
  BalanceEvent,
  Exchange,
  ExchangeConstructorOptionalParameters,
  ExchangeConstructorParameters,
  ExchangeCredentials,
  Order,
  OrderEvent,
  OrderInput,
  OrderListener,
  Trade,
  WalletType,
} from './exchanges/exchange';

let ccxtInstance: Record<string, ccxt.Exchange> = {};
const RECONNECT_DELAY = 2000;

export abstract class WsAccount extends WsClient implements Exchange {
  // Class interface to be implemented by specific exchanges
  public async createOrder?({ order }: { order: OrderInput }): Promise<void>;
  public async cancelOrder?({ id }: { id: string }): Promise<void>;
  public createClientId?(): string;

  protected abstract onMessage(event: MessageEvent): void;
  protected onOpen?(): void;
  protected onClose?(): void;

  protected _ws?: ReconnectingWebSocket;
  protected _credentials: ExchangeCredentials;
  protected _random: Function;
  protected _debug: boolean;
  protected _ccxtInstance: ccxt.Exchange;
  protected _subscribeFilter: string[];
  protected subscriptionKeyMapping: Record<string, string | string[]>;
  protected lock: AsyncLock;
  protected lockDomain: domain.Domain;
  protected preConnect?: () => void;
  protected _walletType?: WalletType;
  protected _accountId?: string;

  private _?: OrderListener;
  private _orders: Record<string, Order>;

  constructor(params: ExchangeConstructorParameters & ExchangeConstructorOptionalParameters) {
    super(params);
    this._credentials = params.credentials;
    this._random = uniqueRandom(0, Math.pow(2, 31));
    this._debug = params.debug ? true : false;

    const exchangeType = params.exchangeType || params.name;
    if (!ccxtInstance[exchangeType]) {
      ccxtInstance[exchangeType] = new { ...ccxt }[exchangeType]();
    }

    this._ccxtInstance = ccxtInstance[exchangeType];
    this._subscribeFilter = [];
    this.subscriptionKeyMapping = {};
    this._orders = {};
    this.lock = new AsyncLock({ domainReentrant: true });
    this.lockDomain = domain.create();
    this._walletType = this.getCredentials().walletType;
    this._accountId = this.getCredentials().accountId;

    if (params.reconnectIntervalEnabled !== undefined) {
      this._reconnectIntervalEnabled = params.reconnectIntervalEnabled;
    }
    if (params.reconnectIntervalMs !== undefined) {
      this._reconnectIntervalMs = params.reconnectIntervalMs;
    }
  }

  public setReconnectInterval = (setup?: { enabled?: boolean; intervalMs?: number }) => {
    if (this._reconnectInterval) {
      clearInterval(this._reconnectInterval);
      this._reconnectInterval = undefined;
    }

    if (setup && setup.intervalMs !== undefined) {
      this._reconnectIntervalMs = setup.intervalMs;
    }

    if (setup && setup.enabled !== undefined) {
      this._reconnectIntervalEnabled = setup.enabled;
    }

    if (this._reconnectIntervalEnabled) {
      this._reconnectInterval = setInterval(this.reconnect, this._reconnectIntervalMs);
    }
  };

  public subscribeOrders = () => {
    if (!this.subscriptionKeyMapping['orders']) {
      return;
    }

    const filters =
      typeof this.subscriptionKeyMapping['orders'] === 'string'
        ? [this.subscriptionKeyMapping['orders']]
        : this.subscriptionKeyMapping['orders'];

    this._subscribeFilter = R.uniq([...this._subscribeFilter, ...filters]);
    if (this._ws) {
      this._ws.reconnect();
    }
  };

  public subscribeBalances = () => {
    if (!this.subscriptionKeyMapping['balance']) {
      return;
    }

    const filters =
      typeof this.subscriptionKeyMapping['balance'] === 'string'
        ? [this.subscriptionKeyMapping['balance']]
        : this.subscriptionKeyMapping['balance'];

    this._subscribeFilter = R.uniq([...this._subscribeFilter, ...filters]);

    if (this._ws) {
      this._ws.reconnect();
    }
  };

  public subscribePositions = () => {
    if (!this.subscriptionKeyMapping['positions']) {
      return;
    }

    const filters =
      typeof this.subscriptionKeyMapping['positions'] === 'string'
        ? [this.subscriptionKeyMapping['positions']]
        : this.subscriptionKeyMapping['positions'];

    this._subscribeFilter = R.uniq([...this._subscribeFilter, ...filters]);

    if (this._ws) {
      this._ws.reconnect();
    }
  };

  protected send = (message: string) => {
    this.debug(`Sending message to ${this.getName()}: ${message}`);
    if (this._ws) {
      this._ws.send(message);
    } else {
      throw new Error('Websocket not connected.');
    }
  };

  protected getCredentials = () => {
    if (typeof this._credentials === 'function') {
      return this._credentials();
    } else {
      return this._credentials;
    }
  };

  protected assertConnected = async () => {
    if (!(await this._connected)) {
      throw new Error(`${this._name} not connected.`);
    }
  };

  protected onOrder = (event: OrderEvent) => {
    this.emit('order', event);
  };

  protected debug = (message: string) => {
    if (this._debug) {
      console.log('DEBUG:', message);
    }
  };

  protected getCachedOrder = (id: string | number) => {
    return this._orders[id];
  };

  protected saveCachedOrder = async (order: Order) => {
    await this.lock.acquire(order.id.toString(), () => {
      if (!this._orders[order.id]) {
        this._orders[order.id] = order;
      } else {
        this._orders[order.id] = {
          ...order,
          trades: this._orders[order.id].trades,
        };
      }
    });
  };

  protected saveCachedTrade = async ({ trade, orderId }: { trade: Trade; orderId: string }) => {
    return await this.lock.acquire(orderId, () => {
      if (!this._orders[orderId]) {
        this._orders[orderId] = {
          id: orderId,
          amount: 0,
          cost: 0,
          datetime: '',
          filled: 0,
          price: 0,
          remaining: 0,
          side: 'buy',
          status: 'unknown',
          symbol: '',
          timestamp: 0,
          type: undefined,
        };
      }

      const order = this._orders[orderId];

      if (!order.trades) {
        order.trades = [trade];
      } else {
        const originalTradeIndex = R.findIndex((t) => t.id === trade.id, order.trades);
        if (originalTradeIndex === -1) {
          order.trades.push(trade);
        } else {
          order.trades[originalTradeIndex] = trade;
        }
      }

      return order;
    });
  };

  protected updateFeeFromTrades = async ({ orderId }: { orderId: string | number }) => {
    if (!this.getCachedOrder(orderId)) {
      throw new Error('Order does not exist.');
    }

    let fee = undefined;
    const order = this.getCachedOrder(orderId);
    const trades = order.trades;
    if (trades) {
      for (const trade of trades) {
        if (trade.fee) {
          if (!fee || !fee.currency) {
            fee = {
              currency: trade.fee.currency,
              cost: trade.fee.cost,
            };
          } else {
            if (fee.currency !== trade.fee.currency) {
              throw new Error('Mixed currency fees not supported.');
            }
            fee.cost += trade.fee.cost;
          }
        }
      }
    }
    await this.saveCachedOrder({ ...order, fee });
  };
}
