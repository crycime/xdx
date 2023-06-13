/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { wait } from './ccxws/src/Util';

export class SmartWss extends EventEmitter {
  private _retryTimeoutMs: number;
  private _retryConnecting: boolean;
  private waitingPong: boolean;
  private _connected: boolean;
  private _wss: any;

  constructor(readonly wssPath: string) {
    super();
    this._retryTimeoutMs = 1000;
    this._connected = false;
  }

  /**
   * Gets if the socket is currently connected
   */
  public get isConnected() {
    return this._connected;
  }

  /**
   * Attempts to connect
   */
  public async connect(): Promise<void> {
    await this._attemptConnect();
  }

  /**
   * Closes the connection
   */
  public close(): void {
    console.log('close:', this.wssPath);
    this.emit('closing');
    if (this._wss) {
      this._wss.removeAllListeners();
      this._wss.on('close', () => this.emit('closed'));
      this._wss.on('error', err => {
        if (err.message !== 'WebSocket was closed before the connection was established') return;
        this.emit('error', err);
      });
      this._wss.close();
      this._wss = undefined;
    }
    this.removeAllListeners();
  }

  /**
   * Sends the data if the socket is currently connected.
   * Otherwise the consumer needs to retry to send the information
   * when the socket is connected.
   */
  public send(data: string) {
    if (this._connected) {
      try {
        this._wss.send(data);
      } catch (e) {
        this.emit('error', e);
      }
    }
  }

  public ping(data?: any, mask?: any, cb?: any) {
    if (this._wss && this._wss.readyState === WebSocket.OPEN) {
      this._wss.send(data, mask, cb);
      this.waitingPong = true;
    } else {
      this._closeCallback();
    }
  }
  public ActivePong() {
    this.waitingPong = false;
  }

  public pong(data?: any, mask?: any, cb?: any) {
    this._wss.pong(data, mask, cb);
  }

  /////////////////////////

  /**
   * Attempts a connection and will either fail or timeout otherwise.
   */
  private _attemptConnect(): Promise<void> {
    return new Promise(resolve => {
      if (this._wss) {
        this._wss.removeAllListeners();
        this._wss.on('close', () => this.emit('closed'));
        this._wss.on('error', err => {
          if (err.message !== 'WebSocket was closed before the connection was established') return;
          this.emit('error', err);
        });
        this._wss.close();
        this._wss = undefined;
      }
      const wssPath = this.wssPath;
      this.emit('connecting');
      let authheaders = {
        auth: '085da4b6a041efcef1ef681e5c9c',
      };
      this._wss = new WebSocket(wssPath, {
        perMessageDeflate: false,
        handshakeTimeout: 5000,
        headers: authheaders,
      });
      this._wss.on('open', () => {
        this._connected = true;
        this.emit('open'); // deprecated
        this.emit('connected');
        resolve();
      });
      this._wss.on('pong', () => {
        console.log('receieved pong from server');
        this.emit('pong');
      });
      this._wss.on('ping', () => {
        console.log('==========receieved ping from server');
        this.emit('ping');
        this._wss.pong();
      });
      this._wss.on('close', () => this._closeCallback());
      this._wss.on('error', err => {
        console.log('err:', err);
        resolve();
      });
      this._wss.on('message', msg => this.emit('message', msg));
    });
  }

  /**
   * Handles the closing event by reconnecting
   */
  private _closeCallback(): void {
    if (this._retryConnecting) {
      return; //已经在重连了
    }
    this._connected = false;
    this._wss = null;
    this.emit('disconnected');
    void this._retryConnect();
  }

  /**
   * Perform reconnection after the timeout period
   * and will loop on hard failures
   */
  private async _retryConnect(): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    if (this._retryConnecting) {
      return; //已经在重连了
    }
    while (true) {
      try {
        console.log('_retryConnecting:begin:', this.wssPath);
        this._retryConnecting = true;
        await wait(this._retryTimeoutMs);
        await this._attemptConnect();
        console.log('_retryConnecting:end:', this.wssPath);
        this._retryConnecting = false;
        return;
      } catch (ex) {
        this._retryConnecting = false;
        console.log('_retryConnecting:err:', this.wssPath, ex);
        this.emit('error', ex);
      }
    }
  }
}
