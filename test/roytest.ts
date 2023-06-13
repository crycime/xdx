import { exec } from 'child_process';
import { ethers, network, config, artifacts } from 'hardhat';
import { BigNumber, Wallet, providers } from 'ethers';
import { getOwnerPrivateKey, CONTRACT_ARBITRAGE_ADDRESS } from '../.privatekey';
import { WETH_ADDRESS } from '../src/constants';
import { CancelPendingTransactoinAll } from '../src/transactions';
import { RoyClient } from '../src/RoyClient';
import { configure, getLogger, Logger } from 'log4js';

let logger: Logger;
function initLogger() {
  configure({
    appenders: { CANCEL: { type: 'file', filename: 'cancel-pending.log' }, STDOUT: { type: 'stdout' } },
    categories: { default: { appenders: ['CANCEL', 'STDOUT'], level: 'debug' } },
  });
  logger = getLogger();
  return logger;
}
initLogger();
let myprovider: providers.WebSocketProvider | providers.JsonRpcProvider | providers.BaseProvider = ethers.provider;
let userprovider: providers.WebSocketProvider | providers.JsonRpcProvider | providers.BaseProvider = ethers.provider;
let config_network = config.networks[network.name] as any;
if (config_network && config_network.ws) {
  myprovider = ethers.getDefaultProvider(config_network.ws);
}
if (config_network && config_network.commit_url) {
  userprovider = ethers.getDefaultProvider(config_network.commit_url);
}

let main = async () => {
  logger.debug('network:', network.name, (await userprovider.getNetwork()).chainId, config_network.commit_url);
  // if (GasPriceOracle.SafeGasPrice > 20e9) {
  //   logger.debug('gas price too big ,exit:', GasPriceOracle);
  //   return;
  // }
  let owner = new ethers.Wallet(await getOwnerPrivateKey(network.name), userprovider);

  let feeData = await owner.provider.getFeeData();
  console.log(
    'deploy feeData:',
    feeData.gasPrice.toString(),
    feeData.maxFeePerGas?.toString(),
    feeData.maxPriorityFeePerGas?.toString(),
  );
  if (feeData.maxFeePerGas.lt(50 * 1e9)) {
    feeData.maxFeePerGas = BigNumber.from(51 * 1e9);
    feeData.maxPriorityFeePerGas = feeData.maxFeePerGas;
  }
  let gasPrice = BigNumber.from(feeData.gasPrice);
  let newtx = {
    gasLimit: 21000,
    gasPrice: feeData.gasPrice,
    to: owner.address,
    value: 0,
  };
  // let ws = new RoyClient('ws://172.31.81.143:51314', 'test');
  let ws = new RoyClient('ws://3.115.190.43:51314', 'test');
  ws.reconnect();
  //Sync事件
  {
    ws.onConnected = () => {
      let sendMsg = JSON.stringify({ m: 'subscribe' });
      ws._wss.send(sendMsg);
    };
    ws._wss.on('message', async (raw: string) => {
      console.log('message:', raw);
      const msg = JSON.parse(raw);
    });
  }
  //发交易测试
  if (false) {
    let tx = await owner.populateTransaction(newtx);
    let signedTx = await owner.signTransaction(tx);
    console.log('signedTx:', signedTx);
    let sendMsg = JSON.stringify({ m: 'sendtx', p: signedTx.substring(2) });
    console.log('Roy sendMsg:', sendMsg);
    ws._wss.send(sendMsg);

    ws._wss.on('message', async (raw: string) => {
      console.log('message:', raw);
      const msg = JSON.parse(raw);
      // let txhash = msg.msg.split(':');
      //  {"result":0,"msg":"TX Sent:0xf5e3dc9802dbfaee488434bfa31e1fd0829377baa75a3760af879d01f10ee0ba"}
      // let ret = await owner.provider.waitForTransaction(txhash[1]);
      let ret = await owner.provider.waitForTransaction(msg);
      console.log('xxxxx:ret:', ret);
    });
  }
};

main();
