import { exec } from 'child_process';
import { ethers, network, config, artifacts } from 'hardhat';
import { BigNumber, Wallet, providers } from 'ethers';
import { getOwnerPrivateKey, CONTRACT_ARBITRAGE_ADDRESS } from '../.privatekey';
import { WETH_ADDRESS } from '../src/constants';
import { CancelPendingTransactoinAll } from '../src/transactions';
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
  let oldBalance = await owner.getBalance();
  console.log('deploy account:', owner.address, ethers.utils.formatEther(oldBalance).toString());
  let pendingNonce = await owner.provider.getTransactionCount(owner.address, 'pending');
  console.log('pending nonce:', pendingNonce);
  let nownonce = await owner.getTransactionCount();
  console.log('now nonce:', nownonce);
  let ret = await CancelPendingTransactoinAll(owner, nownonce);
  if (ret) {
    console.log('cancel all pending transaction ok:', owner.address, pendingNonce);
  } else {
    console.log('cancel all pending transaction err:', owner.address, pendingNonce);
  }
};

main();
