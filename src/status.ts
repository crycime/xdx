import moment from 'moment';
import * as fs from 'fs';
import { format } from 'path/posix';
import * as util from 'util';
import * as readline from 'readline';

import { AverageConfig, GridConfig } from './constants';

export let InitStatusConfig = (filename: string) => {};
export let LoadStatusConfig = (filename: string) => {
  // read JSON object from file
  let ret: GridConfig;
  try {
    let data = fs.readFileSync(filename, 'utf8');
    // parse JSON object
    ret = JSON.parse(data.toString()) as GridConfig;
    // print JSON object
    ret.OnOverOffPositivePositionPending = ret.OnOverOffPositivePositionConfirm;
    ret.OnOverOffNegativePositionPending = ret.OnOverOffNegativePositionConfirm;
    ret.TargetNotional = ret.OnOverOffPositivePosition - ret.OnOverOffNegativePosition;
    ret.DiffNotional = 0;
    return ret as GridConfig;
  } catch (e) {
    console.log('读取status失败,需要重新初始化');
    // return InitStatusConfig(filename);
  }
};

export let SaveStatusConfig = (status: GridConfig, filename: string) => {
  // convert JSON object to string
  status.updateTime = moment().format('YYYY-MM-DD HH:mm:ss');
  const data = JSON.stringify(status, null, 4);

  // write JSON string to a file
  try {
    fs.writeFileSync(filename, data);
    console.log('status data is saved.');
  } catch (e) {
    console.log('status data is saved err:', e);
  }
};

export let SaveAverage = (status: AverageConfig, filename: string) => {
  // convert JSON object to string
  if (!status.createTime) {
    status.createMsec = Date.now();
    status.updateTime = moment().format('YYYY-MM-DD HH:mm:ss');
  }
  status.updateMsec = Date.now();
  status.updateTime = moment().format('YYYY-MM-DD HH:mm:ss');
  const data = JSON.stringify(status, null, 4);

  // write JSON string to a file
  try {
    fs.writeFileSync(filename, data);
  } catch (e) {
    console.log('status data is saved err:', e);
  }
};

export let LoadAverage = (filename: string) => {
  // read JSON object from file
  let ret: AverageConfig;
  try {
    let data = fs.readFileSync(filename, 'utf8');
    // parse JSON object
    ret = JSON.parse(data.toString()) as AverageConfig;
    // print JSON object
    return ret as AverageConfig;
  } catch (e) {
    console.log('读取status失败,需要重新初始化');
    // return InitStatusConfig(filename);
  }
};
