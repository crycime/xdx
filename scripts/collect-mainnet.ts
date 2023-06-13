import { exec } from 'child_process';
import { ethers, network, config, artifacts } from 'hardhat';
import { BigNumber, providers } from 'ethers';
import { TrendingCall } from '../typechain/TrendingCall';
import { getOwnerPrivateKey, CONTRACT_ARBITRAGE_ADDRESS } from '../.privatekey';
import { WETH_ADDRESS, WBTC_ADDRESS, METH_ADDRESS, USDT_ADDRESS, USDC_ADDRESS, ADDRESS_ZERO } from '../src/constants';
import { WETH9 } from '../typechain/WETH9';
import { configure, getLogger, Logger } from 'log4js';

let logger: Logger;
function initLogger() {
  configure({
    appenders: { COLLECT: { type: 'file', filename: 'collect.log' }, STDOUT: { type: 'stdout' } },
    categories: { default: { appenders: ['COLLECT', 'STDOUT'], level: 'debug' } },
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
  console.log('network:', network.name, (await userprovider.getNetwork()).chainId, config_network.commit_url);
  // if (GasPriceOracle.SafeGasPrice > 20e9) {
  //   console.log('gas price too big ,exit:', GasPriceOracle);
  //   return;
  // }
  let user;
  let owner = new ethers.Wallet(await getOwnerPrivateKey(network.name), userprovider);
  [, user] = await ethers.getSigners();

  let oldBalance = await owner.getBalance();
  console.log('deploy account:', owner.address, ethers.utils.formatEther(oldBalance).toString());

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
  console.log('instanceTrendingCall address:', instanceTrendingCall.address);
  let erc20ContractFactory = await ethers.getContractFactory('WETH9');
  let tokens = [
    WBTC_ADDRESS,
    WETH_ADDRESS,
    METH_ADDRESS,
    USDT_ADDRESS,
    USDC_ADDRESS,
    // UST_ADDRESS,
    // QUICK_ADDRESS,
  ];
  for (let addr of tokens) {
    let erc20 = erc20ContractFactory.connect(owner).attach(addr) as WETH9;
    let erc20Balance = await erc20.balanceOf(instanceTrendingCall.address);
    if (erc20Balance.gt(0)) {
      console.log('instanceTrendingCall address:', instanceTrendingCall.address, erc20Balance.toString());
      gasLimit = (await instanceTrendingCall.estimateGas.collect(erc20.address, erc20Balance)).mul(20);
      logger.debug(await erc20.symbol(), 'balance:', instanceTrendingCall.address, erc20Balance.toString());
      let ret1 = await instanceTrendingCall.collect(erc20.address, erc20Balance.sub(0), {
        // gasPrice: gasPrice,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxFeePerGas,
        gasLimit: gasLimit,
      });
      console.log(ret1);
      let ret2 = ret1.wait();
      console.log(ret2);
    } else {
      logger.debug(await erc20.symbol(), 'balance 为0:', instanceTrendingCall.address, erc20Balance.toString());
    }
  }
  let ethBalance = await owner.provider.getBalance(instanceTrendingCall.address);
  if (ethBalance.gt(0)) {
    gasLimit = (await instanceTrendingCall.estimateGas.collect(ADDRESS_ZERO, ethBalance)).mul(2);
    logger.debug('eth balance:', instanceTrendingCall.address, ethBalance.toString());
    let ret1 = await instanceTrendingCall.collect(ADDRESS_ZERO, ethBalance, {
      // gasPrice: gasPrice,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxFeePerGas,
      gasLimit: gasLimit,
    });
    console.log(ret1);
    let ret2 = ret1.wait();
    console.log(ret2);
  }
};

main();
