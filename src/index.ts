import 'source-map-support/register';

export { bitfinex } from './exchanges/bitfinex';
export { binance } from './exchanges/binance';
export { huobipro } from './exchanges/huobipro';
export { kraken } from './exchanges/kraken';
export { ftx } from './exchanges/ftx';
export * from './exchanges/exchange';
export declare type ExchangeName = 'huobipro' | 'ftx' | 'binance' | 'kraken' | 'bitfinex';
export declare type ExchangeType = 'huobipro' | 'ftx' | 'binance' | 'kraken' | 'bitfinex2';
