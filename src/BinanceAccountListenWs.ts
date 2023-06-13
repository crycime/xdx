/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventEmitter } from 'events';
import { IClient } from '../src/ccxws/src/IClient';
import { SmartWss } from '../src/ccxws/src/SmartWss';
import { Watcher } from '../src/ccxws/src/Watcher';

export type WssFactoryFn = (path: string) => SmartWss;

/**
 * Single websocket connection client with
 * subscribe and unsubscribe methods. It is also an EventEmitter
 * and broadcasts 'trade' events.
 *
 * Anytime the WSS client connects (such as a reconnect)
 * it run the _onConnected method and will resubscribe.
 */
export class BinanceAccountListenWs extends EventEmitter {
  public hasTickers: boolean;
  public hasTrades: boolean;
  public hasCandles: boolean;
  public hasLevel2Snapshots: boolean;
  public hasLevel2Updates: boolean;
  public hasLevel3Snapshots: boolean;
  public hasLevel3Updates: boolean;
  public pong_time: number;

  protected _wssFactory: WssFactoryFn;
  public _wss: SmartWss;

  constructor(readonly wssPath: string, readonly name: string, wssFactory?: WssFactoryFn) {
    super();
    this._wss = undefined;

    this.hasTickers = false;
    this.hasTrades = true;
    this.hasCandles = false;
    this.hasLevel2Snapshots = false;
    this.hasLevel2Updates = false;
    this.hasLevel3Snapshots = false;
    this.hasLevel3Updates = false;
    this.pong_time = Date.now();
    this._wssFactory = wssFactory || ((path) => new SmartWss(path));
  }

  //////////////////////////////////////////////

  public close() {
    if (this._beforeClose) {
      this._beforeClose();
    }
    if (this._wss) {
      this._wss.close();
      this._wss = undefined;
    }
  }

  public ping() {
    this._wss.ping();
  }
  public reconnect() {
    this.emit('reconnecting');
    if (this._wss) {
      this._wss.once('closed', () => this._connect());
      this.close();
    } else {
      this._connect();
    }
  }

  ////////////////////////////////////////////
  // PROTECTED

  /**
   * Helper function for performing a subscription operation
   * where a subscription map is maintained and the message
   * send operation is performed
   * @param {Market} market
   * @param {Map}} map
   * @param {String} msg
   * @param {Function} sendFn
   * @returns {Boolean} returns true when a new subscription event occurs
   */
  /**
   * Helper function for performing an unsubscription operation
   * where a subscription map is maintained and the message
   * send operation is performed
   */
  /**
   * Idempotent method for creating and initializing
   * a long standing web socket client. This method
   * is only called in the subscribe method. Multiple calls
   * have no effect.
   */
  protected _connect() {
    if (!this._wss) {
      this._wss = this._wssFactory(this.wssPath);
      this._wss.on('error', this._onError.bind(this));
      this._wss.on('connecting', this._onConnecting.bind(this));
      this._wss.on('connected', this._onConnected.bind(this));
      this._wss.on('disconnected', this._onDisconnected.bind(this));
      this._wss.on('closing', this._onClosing.bind(this));
      this._wss.on('closed', this._onClosed.bind(this));
      this._wss.on('pong', this._pong.bind(this));
      this._wss.on('message', this._onMessage.bind(this));
      this._beforeConnect();

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this._wss.connect();
    }
  }

  /**
   * Handles the error event
   * @param {Error} err
   */
  protected _onError(err) {
    console.log('_onError:', err);
    this.emit('error', err);
  }

  /**
   * Handles the connecting event. This is fired any time the
   * underlying websocket begins a connection.
   */
  protected _onConnecting() {
    console.log('_onConnecting:', this.wssPath);
    this.emit('connecting');
  }

  /**
   * This method is fired anytime the socket is opened, whether
   * the first time, or any subsequent reconnects. This allows
   * the socket to immediate trigger resubscription to relevent
   * feeds
   */
  protected _onConnected() {
    if (!this._wss) {
      console.log('_onConnected ignore:');
      return;
    }
    console.log('_onConnected:');
    this.emit('connected');
  }

  /**
   * Handles a disconnection event
   */
  protected _onDisconnected() {
    console.log('_onDisconnected:');
    this.emit('disconnected');
  }

  /**
   * Handles the closing event
   */
  protected _onClosing() {
    console.log('_onClosing:');
    this.emit('closing');
  }

  /**
   * Fires before connect
   */
  protected _beforeConnect() {
    console.log('_beforeConnect:');
    //
  }

  /**
   * Fires before close
   */
  protected _beforeClose() {
    console.log('_beforeClose:');
    //
  }

  /**
   * Handles the closed event
   */
  protected _onClosed() {
    console.log('_onClosed:');
    this.emit('closed');
  }
  protected _pong() {
    this.pong_time = Date.now();
  }
  protected _onMessage(msg: any) {
    console.log('BinanceAccountListenWs._onMessage:', msg);
    this.emit('message', msg);
    // try {
    //   if (typeof msg == 'string') {
    //     msg = JSON.parse(msg);
    //   }
    // } catch (ex) {
    //   this._onError(ex);
    // }
  }

  ////////////////////////////////////////////
  // ABSTRACT
}
