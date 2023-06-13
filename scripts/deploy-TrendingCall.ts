import { exec } from 'child_process';
import { ethers, network, config, artifacts } from 'hardhat';
import { BigNumber, providers } from 'ethers';
import { TrendingCall } from '../typechain/TrendingCall';
import { PLACEORDER_CONTRACT_ADDRESS, ASSETS_MANAGER_ADDRESS, getOwnerPrivateKey } from '../.privatekey';

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

  let TrendingCallContractFactory = await ethers.getContractFactory('TrendingCall');
  gasLimit = (
    await userprovider.estimateGas(
      TrendingCallContractFactory.getDeployTransaction(ASSETS_MANAGER_ADDRESS, PLACEORDER_CONTRACT_ADDRESS),
    )
  )
    .mul(120)
    .div(100);
  console.log('deploy TrendingCall ready:', TrendingCallContractFactory.bytecode.length, gasLimit.toString());
  let gasPrice = BigNumber.from(feeData.gasPrice);
  console.log('deploy gasPrice:', gasPrice.toString());
  console.log('gasPrice:', blockNumber, gasPrice.toString(), ethers.utils.formatEther(gasPrice));
  const instanceTrendingCall = (await TrendingCallContractFactory.connect(owner).deploy(
    ASSETS_MANAGER_ADDRESS,
    PLACEORDER_CONTRACT_ADDRESS,
    {
      // gasPrice: gasPrice,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxFeePerGas,
      gasLimit: gasLimit,
    },
  )) as TrendingCall;
  oldBalance = await owner.getBalance();
  console.log(
    'new TrendingCall address:',
    instanceTrendingCall.address,
    ethers.utils.formatEther(oldBalance.sub(await owner.getBalance())),
  );
};

main();
