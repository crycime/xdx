import { configure, getLogger, Logger } from 'log4js';

import { Db } from 'mongodb';

import { ConfigPair, Start } from '../src/Start';
import { env } from '../env';
import { exit } from 'process';
//这一行不能少,否则不会加载
env;

let logger: Logger;
function initLogger() {
  configure({
    appenders: { CXDX: { type: 'file', filename: 'cxdx.log' }, STDOUT: { type: 'stdout' } },
    categories: { default: { appenders: ['CXDX', 'STDOUT'], level: 'debug' } },
  });
  logger = getLogger();
  return logger;
}
initLogger();
let mmdb: Db;
let main = async () => {
  //确保唯一进程,避免冲突
  // try {
  //   const SingleInstance = require('single-instance');
  //   const locker = new SingleInstance('DeFiMM.ts');
  //   await locker.lock();
  // } catch (e) {
  //   console.log('程序已经运行,请先关闭:', e);
  //   return;
  // }
  await Start(logger);
};

main();
