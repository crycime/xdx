import { BigNumber, providers, Contract } from 'ethers';
import { ethers } from 'hardhat';
import { TrendingEvent } from './TrendingEvent';
import { PANCAKE_V2_FACTORY_ADDRESS, WBNB_ADDRESS } from './constants';
import { Erc20ABI, UniSwapFactoryABI, TrendingABI } from '../src/TrendingABI';

export type UniSwapPoolData = {
  key: string;
  factoryAddress: string;
  blockNumber: number;
};
export let getPoolActiveMap = async (provider: providers.WebSocketProvider | providers.JsonRpcProvider) => {
  //12370624 v3第一单
  //12603435 2021-06-10 00:00
  //12680684 2021-06-22 00:00
  // let block = await ethers.provider.getBlock(12370624 + 1000);
  let block = await provider.getBlock('latest');
  let step = 100;
  let beginBlockNumber = block.number - 100000; //差不多1个月
  let latestBlockNumber = block.number;
  let lastblockNumber = 0;
  let nextblock = block;
  block = await provider.getBlock(lastblockNumber);
  // let erc20ActiveMap = new Map<string, number>();
  // let poolActiveMap = new Map<string, providers.Log>();
  let poolActiveMap = new Map<string, UniSwapPoolData>();
  let uniSwapFactoryAbi = new ethers.Contract(PANCAKE_V2_FACTORY_ADDRESS, UniSwapFactoryABI);
  let uniSwapFactory = uniSwapFactoryAbi.connect(provider);
  let factoryMap = new Map<string, number>();
  for (let i = beginBlockNumber; i < latestBlockNumber; i = i + step) {
    let filter = {
      address: null,
      fromBlock: i,
      toBlock: i + step,
      // toBlock: 'latest',
      // topics: [TrendingEvent.TOPIC_ERC20_TRANSFER],
      topics: [[TrendingEvent.TOPIC_UNISWAP_SWAP_V2]],
    };
    let logs = await provider.getLogs(filter);
    console.log('PancakeSwap正在扫描区块:', i, '-', i + step, latestBlockNumber, logs.length);
    for (let log of logs) {
      let address = log.address.toLowerCase();
      let poolData = poolActiveMap.get(address);
      if (!poolData) {
        poolData = {
          key: address,
          factoryAddress: '',
          blockNumber: log.blockNumber,
        };
        let pool = uniSwapFactory.attach(log.address);
        let num = 0;
        try {
          poolData.factoryAddress = await pool.factory();
          num = factoryMap.get(poolData.factoryAddress);
          if (!num) {
            console.log('新增Factory:', poolData.factoryAddress);
            num = 1;
            factoryMap.set(poolData.factoryAddress, num);
          } else {
            num += 1;
            factoryMap.set(poolData.factoryAddress, num);
          }
        } catch {
          console.log('非uniswap系列:', log);
        }
        console.log('新增池子:', pool.address, poolData?.factoryAddress, num);
      }
      poolData.blockNumber = log.blockNumber;
      poolActiveMap.set(address, poolData);
      // if (log.topics[1]) {
      // let from = '0x' + log.topics[1].substr(26).toLowerCase();
      // } else {
      //   console.log(log);
      // }
      // console.log(from, log.address, log.blockNumber);
    }
  }
  console.log('poolActiveMap:', poolActiveMap.size);
  return poolActiveMap;
  // for (let [pool, log] of poolActiveMap) {
  //   let from = '0x' + log.topics[1].substr(26).toLowerCase();
  //   erc20ActiveMap.set(from + pool, log.blockNumber);
  // }
  // console.log('erc20ActiveMap:', erc20ActiveMap.size);
  // return erc20ActiveMap;
};
export type CommonPoolData = {
  key: string;
  token0: string;
  token1: string;
  address: string;
  dxType: number;
  factoryAddress: string;
  balance0: BigNumber;
  balance1: BigNumber;
  blockNumber: number;
};
export let parseLogSync = async (log: providers.Log) => {
  let topic0 = log.topics[0];
  let index = 2;
  let _reserve0 = parseInt(log.data.substr(index, 64), 16); //卖//buyid/butnum/baultid/baultnum
  index = index + 64;
  let _reserve1 = parseInt(log.data.substr(index, 64), 16); //买
  if (_reserve0 == 0 && _reserve1 == 0) {
    console.log('错误的池子事件:parseLogSync:', log.address, log.topics);
    return null;
  }
  return {
    address: log.address,
    _reserve0: BigNumber.from('0x' + _reserve0.toString(16)),
    _reserve1: BigNumber.from('0x' + _reserve1.toString(16)),
  };
};

export let parseLogByTopic0 = async (
  log: providers.Log,
  provider: providers.WebSocketProvider | providers.JsonRpcProvider,
) => {
  let topic0 = log.topics[0];
  let index = 2;
  let amount0In = parseInt(log.data.substr(index, 64), 16); //卖//buyid/butnum/baultid/baultnum
  index = index + 128;
  let amount1In = parseInt(log.data.substr(index, 64), 16); //买
  index = index + 128;
  let amount0Out = parseInt(log.data.substr(index, 64), 16); //卖//buyid/butnum/baultid/baultnum
  index = index + 128;
  let amount1Out = parseInt(log.data.substr(index, 64), 16); //买
  if (amount0Out == 0 && amount1Out == 0) {
    return null;
  }
  return {
    key: log.address,
    token0: '',
    token1: '',
    address: '',
    dxType: 0,
    factoryAddress: '',
    balance0: null,
    balance1: null,
    blockNumber: 0,
  };
};
