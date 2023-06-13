import { exec } from 'child_process';
import { ethers, network, config, artifacts } from 'hardhat';
import { BigNumber, providers } from 'ethers';
import { TrendingCall } from '../typechain/TrendingCall';
import { getOwnerPrivateKey, CONTRACT_ARBITRAGE_ADDRESS } from '../.privatekey';
import { WMATIC_ADDRESS } from '../src/constants';
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
  let user;
  let owner = new ethers.Wallet(await getOwnerPrivateKey(network.name), userprovider);
  [, user] = await ethers.getSigners();

  let oldBalance = await owner.getBalance();
  logger.debug('deploy account:', owner.address, ethers.utils.formatEther(oldBalance).toString());

  // let gasprice = (await owner.getGasPrice()).add(1);
  // let gasPrice = BigNumber.from((80 * 1e9).toString());
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
  let value = BigNumber.from((5 * 1e17).toString()); //0.5eth
  let erc20ContractFactory = await ethers.getContractFactory('WETH9');
  let erc20 = erc20ContractFactory.connect(owner).attach(WMATIC_ADDRESS) as WETH9;
  let wethBalance = await erc20.balanceOf(instanceTrendingCall.address);
  logger.debug(await erc20.symbol(), 'balance:', instanceTrendingCall.address, wethBalance.toString());
  let ethBalance = await owner.provider.getBalance(instanceTrendingCall.address);
  if (ethBalance.gt(0)) {
    gasLimit = (await instanceTrendingCall.estimateGas.deposit({ value: ethBalance })).mul(2);
    logger.debug('eth balance:', instanceTrendingCall.address, ethBalance.toString());
    let ret1 = await instanceTrendingCall.deposit({
      // gasPrice: gasPrice,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxFeePerGas,
      gasLimit: gasLimit,
    });
    logger.debug(ret1);
    let ret2 = ret1.wait();
    logger.debug(ret2);
  } else {
    // let value = BigNumber.from((5 * 1e17).toString()); //0.5eth
    let value = BigNumber.from(ethers.utils.parseEther('100')); //0.5eth
    if (value.gt(0)) {
      gasLimit = (await instanceTrendingCall.estimateGas.deposit({ value: value })).mul(2);
      logger.debug('eth balance transfer:', instanceTrendingCall.address, value.toString());
      let ret1 = await instanceTrendingCall.deposit({
        value: value,
        // gasPrice: gasPrice,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxFeePerGas,
        gasLimit: gasLimit,
      });
      logger.debug(ret1);
      let ret2 = ret1.wait();
      logger.debug(ret2);
    } else {
      logger.debug('请指定金额:value:');
    }
  }
};

main();
