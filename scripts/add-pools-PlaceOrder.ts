import { exec } from 'child_process';
import { ethers, network, config, artifacts } from 'hardhat';
import { BigNumber, providers } from 'ethers';
import { PlaceOrder, PoolBaseDataStruct } from '../typechain/PlaceOrder';
import { getOwnerPrivateKey, PLACEORDER_CONTRACT_ADDRESS } from '../.privatekey';
import { ExchangeMarkets } from '../HedgeSettings';
import { WETH_ADDRESS } from '../src/constants';
import { WETH9 } from '../typechain/WETH9';
import { configure, getLogger, Logger } from 'log4js';
import { pathToFileURL } from 'url';

let logger: Logger;
function initLogger() {
  configure({
    appenders: { DEPOSIT: { type: 'file', filename: 'deposit.log' }, STDOUT: { type: 'stdout' } },
    categories: { default: { appenders: ['DEPOSIT', 'STDOUT'], level: 'debug' } },
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
const WETH_ABI = [
  'function deposit() payable',
  'function withdraw(uint wad)',
  'function balanceOf(address) view returns (uint)',
];

let main = async () => {
  logger.debug('network:', network.name, (await userprovider.getNetwork()).chainId, config_network.commit_url);
  // if (GasPriceOracle.SafeGasPrice > 20e9) {
  //   logger.debug('gas price too big ,exit:', GasPriceOracle);
  //   return;
  // }
  let user;
  let owner = new ethers.Wallet(await getOwnerPrivateKey(network.name), userprovider);
  [, user] = await ethers.getSigners();

  let oldBalance = await owner.getBalance();
  logger.debug('deploy account:', owner.address, ethers.utils.formatEther(oldBalance).toString());

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
  let gasLimit = (await userprovider.getBlock('latest')).gasLimit.div(2);
  let baseFeePerGas = (await userprovider.getBlock('latest')).baseFeePerGas;
  let blockNumber = await userprovider.getBlockNumber();
  console.log(
    'gasLimit:',
    blockNumber,
    gasLimit.toString(),
    ethers.utils.formatEther(gasLimit),
    baseFeePerGas?.toString(),
  );

  logger.debug(
    'gasPrice:',
    blockNumber,
    await owner.getGasPrice(),
    gasPrice.toString(),
    ethers.utils.formatEther(gasPrice),
  );
  logger.debug('gasLimit:', blockNumber, gasLimit.toString(), ethers.utils.formatEther(gasLimit));

  let PlaceOrderContractFactory = await ethers.getContractFactory('PlaceOrder');
  const instancePlaceOrder = PlaceOrderContractFactory.connect(owner).attach(PLACEORDER_CONTRACT_ADDRESS) as PlaceOrder;
  console.log('getPoolList:', await instancePlaceOrder.getPoolList());
  let poolList: PoolBaseDataStruct[] = [];
  let index = 0;
  for (let market of ExchangeMarkets) {
    if (market.type == 'DX') {
      poolList.push({
        poolId: index++,
        dxType: market.dxType,
        fee: market.fee,
        addr: market.address,
        token0: market.token0.address,
        token1: market.token1.address,
        // symbol: market.symbol,
      });
    }
  }
  // gasLimit = await instancePlaceOrder.estimateGas.updatePoolData(poolList[0]);
  gasLimit = (await instancePlaceOrder.estimateGas.addPoolList(poolList)).mul(2);
  let ret1 = await instancePlaceOrder.addPoolList(poolList, {
    // gasPrice: gasPrice,
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxFeePerGas,
    gasLimit: gasLimit,
  });
  logger.debug(ret1);
  let ret2 = await ret1.wait();
  logger.debug(ret2);
  console.log('getPoolList:', await instancePlaceOrder.getPoolList());
};

main();
