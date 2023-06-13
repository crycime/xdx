/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventEmitter } from 'events';
import { SmartWss } from './RoyWebsocket';

/**
 * Single websocket connection client with
 * subscribe and unsubscribe methods. It is also an EventEmitter
 * and broadcasts 'trade' events.
 *
 * Anytime the WSS client connects (such as a reconnect)
 * it run the _onConnected method and will resubscribe.
 */
export class RoyClient extends EventEmitter {
  public _wss: SmartWss;

  constructor(readonly wssPath: string, readonly name: string) {
    super();
    this._wss = undefined;
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

  public reconnect() {
    console.log('reconnecting:', this.wssPath);
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
   * Idempotent method for creating and initializing
   * a long standing web socket client. This method
   * is only called in the subscribe method. Multiple calls
   * have no effect.
   */
  protected _connect() {
    if (!this._wss) {
      this._wss = new SmartWss(this.wssPath);
      this._wss.on('error', this._onError.bind(this));
      this._wss.on('connecting', this._onConnecting.bind(this));
      this._wss.on('connected', this._onConnected.bind(this));
      this._wss.on('disconnected', this._onDisconnected.bind(this));
      this._wss.on('closing', this._onClosing.bind(this));
      this._wss.on('closed', this._onClosed.bind(this));
      this._wss.on('message', (msg: string) => {
        try {
          this._onMessage(msg);
        } catch (ex) {
          this._onError(ex);
        }
      });
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
    this.emit('error', err);
  }

  /**
   * Handles the connecting event. This is fired any time the
   * underlying websocket begins a connection.
   */
  protected _onConnecting() {
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
    this.emit('connected');
    this.onConnected();
    console.log('_onConnected:', this.wssPath);
  }
  public onConnected() {}

  /**
   * Handles a disconnection event
   */
  protected _onDisconnected() {
    this.emit('disconnected');
  }

  /**
   * Handles the closing event
   */
  protected _onClosing() {
    this.emit('closing');
  }

  /**
   * Fires before connect
   */
  protected _beforeConnect() {
    //
  }

  /**
   * Fires before close
   */
  protected _beforeClose() {
    //
  }

  /**
   * Handles the closed event
   */
  protected _onClosed() {
    this.emit('closed');
  }

  ////////////////////////////////////////////
  // ABSTRACT

  protected _onMessage(msg: any) {
    // console.log('_onMessage:', msg);
  }
}
