import { exec } from 'child_process';
import { ethers, network, config, artifacts } from 'hardhat';
import { BigNumber, providers } from 'ethers';
import { TrendingCall } from '../typechain/TrendingCall';
import { getOwnerPrivateKey, CONTRACT_ARBITRAGE_ADDRESS, PLACEORDER_CONTRACT_ADDRESS } from '../.privatekey';
import { WETH_ADDRESS } from '../src/constants';
import { WETH9 } from '../typechain/WETH9';
import { configure, getLogger, Logger } from 'log4js';

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

  let TrendingCallContractFactory = await ethers.getContractFactory('TrendingCall');
  const instanceTrendingCall = TrendingCallContractFactory.connect(owner).attach(
    CONTRACT_ARBITRAGE_ADDRESS,
  ) as TrendingCall;
  let erc20ContractFactory = await ethers.getContractFactory('WETH9');
  let erc20 = erc20ContractFactory.connect(owner).attach(WETH_ADDRESS) as WETH9;
  let balance = await erc20.balanceOf(owner.address);
  let wethBalance = await erc20.balanceOf(instanceTrendingCall.address);
  logger.debug(await erc20.symbol(), 'balance:', instanceTrendingCall.address, wethBalance.toString());
  let ethBalance = await owner.provider.getBalance(instanceTrendingCall.address);
  let address = PLACEORDER_CONTRACT_ADDRESS;
  gasLimit = (await instanceTrendingCall.estimateGas.setPlaceOrder(address)).mul(2);
  logger.debug('eth balance:', instanceTrendingCall.address, ethBalance.toString());
  let ret1 = await instanceTrendingCall.setPlaceOrder(address, {
    // gasPrice: gasPrice,
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxFeePerGas,
    gasLimit: gasLimit,
  });
  logger.debug(ret1);
  let ret2 = await ret1.wait();
  logger.debug(ret2);
};

main();
