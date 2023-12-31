import AsyncLock from 'async-lock';
import ccxt from 'ccxt';
import domain from 'domain';
import { EventEmitter } from 'events';
import * as R from 'ramda';
import ReconnectingWebSocket from 'reconnecting-websocket';
import WebSocket from 'ws';

import { ExchangeName, ExchangeType } from './index';
import {
  ExchangeConstructorOptionalParameters,
  ExchangeConstructorParameters,
  ExchangeCredentials,
} from './exchanges/exchange';

let ccxtInstance: Record<string, ccxt.Exchange> = {};
const RECONNECT_DELAY = 2000;

export abstract class WsClient extends EventEmitter {
  protected abstract onMessage(event: MessageEvent): void;
  protected onOpen?(): void;
  protected onClose?(): void;

  protected _ws?: ReconnectingWebSocket;
  protected _credentials: ExchangeCredentials;
  protected _debug: boolean;
  protected _ccxtInstance: ccxt.Exchange;
  protected _subscribeFilter: string[];
  protected subscriptionKeyMapping: Record<string, string | string[]>;
  protected lock: AsyncLock;
  protected lockDomain: domain.Domain;
  protected preConnect?: () => void;
  protected _url: string;
  protected readonly _name: ExchangeName;
  protected _connected?: Promise<boolean>;

  protected _resolveConnect?: Function;
  protected _reconnectIntervalEnabled: boolean = false;
  protected _reconnectIntervalMs: number = 1000 * 60 * 60; // 1 hour by default
  protected _reconnectInterval?: any;

  constructor(params: ExchangeConstructorParameters & ExchangeConstructorOptionalParameters) {
    super();
    this._name = params.name;
    this._url = params.url;
    this._credentials = params.credentials;
    this._debug = params.debug ? true : false;

    const exchangeType = params.exchangeType || params.name;
    if (!ccxtInstance[exchangeType]) {
      ccxtInstance[exchangeType] = new { ...ccxt }[exchangeType]();
    }

    this._ccxtInstance = ccxtInstance[exchangeType];
    this._subscribeFilter = [];
    this.subscriptionKeyMapping = {};
    this.lock = new AsyncLock({ domainReentrant: true });
    this.lockDomain = domain.create();

    if (params.reconnectIntervalEnabled !== undefined) {
      this._reconnectIntervalEnabled = params.reconnectIntervalEnabled;
    }
    if (params.reconnectIntervalMs !== undefined) {
      this._reconnectIntervalMs = params.reconnectIntervalMs;
    }
  }

  public connect = async () => {
    if (this.preConnect) {
      await this.preConnect();
    }

    if (this._ws) {
      this._ws.close();
    }

    if (!this._url) {
      throw new Error('Websocket url missing.');
    }
    this._ws = new ReconnectingWebSocket(this._url, [], { WebSocket, startClosed: true });

    await this._ccxtInstance.loadMarkets();

    this._connected = new Promise((resolve, reject) => {
      if (!this._ws) {
        throw new Error('Websocket not connected.');
      }
      this._resolveConnect = resolve;
      this._ws.addEventListener('open', this._onOpen);
      this._ws.addEventListener('close', this._onClose);
      this._ws.addEventListener('error', this._onError);
      this._ws.reconnect();

      this.setReconnectInterval();
    });
    this._ws.addEventListener('message', this._onMessage);

    await this.assertConnected();
  };

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

  public reconnect = async (code?: number, reason?: string) => {
    if (this._ws) {
      this.debug(`Reconnecting to ${this._name}.`);
      await this.disconnect();
      setTimeout(() => this.connect(), RECONNECT_DELAY);
    } else {
      this.debug(`Cannot reconnect to ${this._name}.`);
    }
  };

  public disconnect = async () => {
    this._connected = undefined;

    if (this._reconnectInterval) {
      clearInterval(this._reconnectInterval);
      this._reconnectInterval = undefined;
    }

    if (!this._ws) {
      throw new Error('Websocket not connected.');
    }

    this._ws.close();
    this._ws.removeEventListener('message', this._onMessage);
    this._ws.removeEventListener('open', this._onOpen);
    this._ws.removeEventListener('close', this._onClose);
    this._ws.removeEventListener('error', this._onError);
  };

  public getName = () => {
    return this._name;
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

  protected debug = (message: string) => {
    if (this._debug) {
      console.log('DEBUG:', message);
    }
  };

  protected setUrl = (url: string) => {
    this._url = url;
  };

  private _onMessage = (event: MessageEvent) => {
    this.debug(`Event on ${this.getName()}: ${event.data}`);
    domain.create().run(() => {
      try {
        this.onMessage(event);
      } catch (e) {
        console.log('Domain error', e);
      }
    });
  };

  private _onOpen = () => {
    if (this._resolveConnect) {
      this._resolveConnect(true);
    }

    this.debug(`Connection to ${this._name} established at ${this._url}.`);
    if (this.onOpen) {
      this.onOpen();
    }
  };

  private _onClose = () => {
    if (this._resolveConnect) {
      this._resolveConnect(false);
    }

    this.debug(`Connection to ${this._name} closed.`);
    if (this.onClose) {
      this.onClose();
    }
  };

  private _onError = () => {
    if (this._resolveConnect) {
      this._resolveConnect(false);
    }
  };
}
