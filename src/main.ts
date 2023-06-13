import * as ccxt from 'ccxt';
import log from 'ololog';

const symbol = 'BTC/USD';
const exchanges = ['coinbasepro', 'gemini', 'kraken'];

const fetchTickers = async (symbol: string) => {
  const result = await Promise.all(
    exchanges.map(async (id: string): Promise<ccxt.Exchange> => {
      const CCXT = ccxt as any; // Hack!
      const exchange = new CCXT[id]({ enableRateLimit: true }) as ccxt.Exchange;
      exchange.loa;
      const ticker = await exchange.fetchTicker(symbol);
      const exchangeExtended = exchange.extend({ exchange: id }, ticker) as ccxt.Exchange;
      return exchangeExtended;
    })
  );
  log(result);
};

fetchTickers(symbol);

console.log(ccxt.exchanges);
