import fetch, { Response } from 'node-fetch';
import { resolve } from 'path';
import https from 'https';
import request from 'sync-request';

//export function GetConfigAddressByGameFactoryAddress(name: string, addr: string): Promise<Response> {
export let GasPriceOracle = {
  SafeGasPrice: 10e9,
  ProposeGasPrice: 20e9,
  FastGasPrice: 30e9,
  FastGasPriceLast: 30e9,
};
let lastUpdateAt = 0;
export function GetGasPriceOracleSync() {
  try {
    let res = request(
      'GET',
      'https://api.bscscan.com/api?module=gastracker&action=gasoracle&apikey=RYSEVDET6GYVWJ9IUFWJCBC5KTI1IWPIMR'
    );
    let data = JSON.parse(res.getBody('utf8'));
    if (data.message == 'OK') {
      GasPriceOracle.SafeGasPrice = parseInt(data.result.SafeGasPrice) * 1e9;
      GasPriceOracle.ProposeGasPrice = parseInt(data.result.ProposeGasPrice) * 1e9;
      GasPriceOracle.FastGasPrice = parseInt(data.result.FastGasPrice) * 1e9;
      lastUpdateAt = Date.now();
      // console.log('GasPriceOracle init:', GasPriceOracle);
    } else {
      console.error('init gas price oracle err:', data, data.result, res.getBody('utf8'));
    }
  } catch (e) {}
}
export async function InitGasPriceOracle() {
  if (lastUpdateAt > 0) {
    console.log('InitGasPriceOracle 已经初始化过了');
    return;
  }
  let call = () => {
    if (Date.now() - lastUpdateAt < 3 * 1000) {
      return;
    }
    https
      .get(
        'https://api.polygonscan.com/api?module=gastracker&action=gasoracle&apikey=DTZYS3GV76MHF1FCA8XJWARBU3YAKWG28Y',
        (res) => {
          // console.log('headers:', res);
          res.on('data', (d) => {
            try {
              let data = JSON.parse(d);
              if (data.message == 'OK') {
                GasPriceOracle.SafeGasPrice = parseInt(data.result.SafeGasPrice) * 1e9;
                GasPriceOracle.ProposeGasPrice = parseInt(data.result.ProposeGasPrice) * 1e9;
                GasPriceOracle.FastGasPriceLast = GasPriceOracle.FastGasPrice;
                GasPriceOracle.FastGasPrice = parseInt(data.result.FastGasPrice) * 1e9;
              }
            } catch {}
          });
        }
      )
      .on('error', (e) => {
        console.error('gas price oracle err:', e);
      });
  };

  GetGasPriceOracleSync(); //先执行一次
  setInterval(call, 2 * 1000);
  // let isGzip: boolean = false;
  // let rawdata;
  // let encoding = response.headers.get('Content-Encoding');
  // switch (encoding) {
  //   case 'gzip':
  //     let body = response.body as zlib.Gunzip;
  //     body.on('data', (data) => {
  //       rawdata = data;
  //       // console.log(data);
  //     });
  //     // await body.read();
  //     // console.log('xxxxxx:', body.read());
  //     // zlib.unzip(await response.buffer(), (err, data) => {
  //     //   console.log('wwwwwwwwww:', err, data.toString());
  //     // });
  //     // response.body.pipe(zlib.createGunzip());
  //     // console.log('wwwwwwwww:', await response.buffer());
  //     // console.log('wwwwwwwww:', await response.json());
  //     // zlib.gunzip(await response.arrayBuffer(), (err, data) => {
  //     //   console.log('wwwwwwwwww:', err, data);
  //     // });
  //     // zlib.gzip(await response.buffer(), (err, data) => {
  //     //   console.log('wwwwwwwwww:', err, data.toString());
  //     // });

  //     break;

  //   default:
  //     rawdata = response.body.read();
  //     break;
  // }
  // if (rawdata == null) {
  //   if (num >= 0) {
  //     console.log('GetConfigAddressByGameFactoryAddress rawdata:null', addr, num);
  //     await new Promise((resolve) => {
  //       setTimeout(() => {
  //         console.info('waiting GetConfigAddressByGameFactoryAddress');
  //         resolve(null);
  //       }, 3000);
  //     });
  //     return GetConfigAddressByGameFactoryAddress(name, addr, --num);
  //   } else {
  //     return null;
  //   }
  // }
  // let data = JSON.parse(rawdata.toString()).data;
  // if (!data) {
  //   return null;
  // }
  // if (data.configAddresses) {
  //   if (num >= 0) {
  //     if (data.configAddresses.length == 0) {
  //       console.log('GetConfigAddressByGameFactoryAddress rrodata.configAddressesr:0', addr, num);
  //       await new Promise((resolve) => {
  //         setTimeout(() => {
  //           console.info('waiting GetConfigAddressByGameFactoryAddress');
  //           resolve(null);
  //         }, 2000);
  //       });
  //       return GetConfigAddressByGameFactoryAddress(name, addr, --num);
  //     }
  //     return data.configAddresses[0] as ConfigAddress;
  //   } else {
  //     return null;
  //   }
  // }
}

// InitGasPriceOracle();
