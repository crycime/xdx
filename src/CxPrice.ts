import * as ccxt from 'ccxt';

//获取中心化交易所得价格,方便预判
export let GetQoutEthPrice = async (symbol0: string) => {
  if (!exchange_huobi) {
    exchange_huobi = new ccxt.huobi({ version: 'v1', enableRateLimit: true });
    // await exchange_huobi.loadMarkets();
  }
  if (!exchange_binance) {
    exchange_binance = new ccxt.binance({ version: 'v1', enableRateLimit: true });
    // await exchange_binance.loadMarkets();
  }
  if (symbol0 == 'ETH') {
    return 1;
  }
  let price = await tryGetQoutEthPrice('ETH', symbol0);
  if (!price) {
    price = await tryGetQoutEthPrice('USDT', symbol0);
    if (price) {
      price = price * (await tryGetQoutEthPrice('ETH', 'USDT'));
    }
  }
  console.log('获取中心化交易所报价:', symbol0, price);
  return price;
};
let tryGetQoutEthPrice = async (symobol0: string, symobol1: string) => {
  let id = symobol0 + '/' + symobol1;
  let side = 0;
  let ticker: ccxt.Ticker;
  try {
    ticker = await exchange_huobi.fetchTicker(id);
  } catch {}
  if (!ticker) {
    side = 1;
    try {
      ticker = await exchange_binance.fetchTicker(id);
    } catch {}
  }
  if (!ticker) {
    id = symobol1 + '/' + symobol0;
    try {
      ticker = await exchange_huobi.fetchTicker(id);
    } catch {}
    if (!ticker) {
      try {
        ticker = await exchange_binance.fetchTicker(id);
      } catch {}
    }
  }
  if (ticker) {
    let price = (ticker.bid + ticker.ask) / 2;
    if (price && side == 1) {
      price = 1 / price;
    }
    return price;
  }
  return 0;
};

let exchange_huobi: ccxt.Exchange;
let exchange_binance: ccxt.Exchange;

// const main = async () => {
//   let ret = await GetQoutEthPrice('SHIB');
//   console.log(ret);
// };
// main();
