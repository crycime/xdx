import { exec } from 'child_process';
import { ethers, network, config, artifacts } from 'hardhat';
import { BigNumber, providers } from 'ethers';
import { TrendingCall } from '../typechain/TrendingCall';
import { getOwnerPrivateKey, CONTRACT_ARBITRAGE_ADDRESS } from '../.privatekey';
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
  let user;
  let owner = new ethers.Wallet(await getOwnerPrivateKey(network.name), userprovider);
  [, user] = await ethers.getSigners();

  let oldBalance = await owner.getBalance();
  console.log('deploy account:', owner.address, ethers.utils.formatEther(oldBalance).toString());

  // let gasprice = (await owner.getGasPrice()).add(1);
  // let gasPrice = BigNumber.from((80 * 1e9).toString());
  let feeData = await ethers.provider.getFeeData();
  let gasPrice = feeData.gasPrice;
  console.log(
    'deploy feeData:',
    feeData.gasPrice.toString(),
    feeData.maxFeePerGas?.toString(),
    feeData.maxPriorityFeePerGas?.toString(),
  );
  if (feeData.maxFeePerGas.lt(50 * 1e9)) {
    feeData.maxFeePerGas = BigNumber.from(50 * 1e9);
    feeData.maxPriorityFeePerGas = feeData.maxFeePerGas;
  }
  let gasLimit = (await userprovider.getBlock('latest')).gasLimit.div(2);
  let blockNumber = await userprovider.getBlockNumber();
  console.log(
    'gasPrice:',
    blockNumber,
    await owner.getGasPrice(),
    gasPrice.toString(),
    ethers.utils.formatEther(gasPrice),
  );
  console.log('gasLimit:', blockNumber, gasLimit.toString(), ethers.utils.formatEther(gasLimit));

  let TrendingCallContractFactory = await ethers.getContractFactory('TrendingCall');
  const instanceTrendingCall = TrendingCallContractFactory.connect(owner).attach(
    CONTRACT_ARBITRAGE_ADDRESS,
  ) as TrendingCall;
  console.log('instanceTrendingCall address:', instanceTrendingCall.address);
  let erc20ContractFactory = await ethers.getContractFactory('WETH9');
  let erc20 = erc20ContractFactory.connect(owner).attach('0x0000000000004946c0e9F43F4Dee607b0eF1fA1c') as WETH9;
  let ret1 = await erc20.approve(CONTRACT_ARBITRAGE_ADDRESS, ethers.utils.parseEther('100'), {
    maxFeePerGas: await feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxFeePerGas,
  });
  console.log('ret1:', ret1);
  let ret2 = await ret1.wait();
  console.log('ret2:', ret2);
};

main();
