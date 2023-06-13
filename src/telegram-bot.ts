import moment from 'moment';
import { exec } from 'child_process';
import * as xlsx from 'node-xlsx';
import * as fs from 'fs';

import { Markup, Telegraf, Context } from 'telegraf';
import '../env';
import { getOwnerPrivateKey, CONTRACT_ARBITRAGE_ADDRESS } from '../.privatekey';
import { Notional, LatticeTable, GridConfig } from '../src/constants';
import { SetStartRealizedPNL, lastBlockNumber, pendingAddressGasMap, pendingprovider } from '../src/SpotDx';
import { exchangeMarketAddressMap, loopSpotCxs } from '../src/Start';
import {
  SetFeeDatamaxFeePerGasMax,
  SetFeeDatamaxFeePerGasBase,
  feeDatamaxFeePerGasMax,
  feeDatamaxFeePerGasBase,
  commitWaitingMap,
} from '../src/SpotDx';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { TokenPath } from './TokenPath';

// // 二傻
export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
export const bot_control = bot;

let commands = `
help: available commands,
get: 查询当前运行数据
lattice: 当前配置
reset: 重置检查数据一致性
pending: from= to=
pause: 开关
gas: base=300 max=2000
set: 设置调整参数
    	UnitNotional=100
    	DiffNotional=0
    	RealizedPNL=0
    	ReferenceBalance=0
    	checkReset=false
    	LatticeTable=[]
`;
let checkPermission = (ctx: any) => {
  // console.log('xxxx:', ctx, ctx.message, ctx.update);
  console.log('bot:checkPermission:', ctx.message);
  if (
    ctx.message.chat.id != process.env.TELEGRAM_CHAT_ID &&
    ctx.message.chat.id != process.env.TELEGRAM_CHAT_ID_CONTROL
  ) {
    ctx.reply(`权限不够,限制操作:${ctx.message.chat.id}`);
    return false;
  }
  if (ctx.message.date < startTime) {
    ctx.reply(`忽略过期指令`);
    return false;
  }
  return true;
};
bot.command('control', async ctx => {
  if (!checkPermission(ctx)) {
    return;
  }
  var options = {
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [{ text: 'Some button text 1', callback_data: '1' }],
        [{ text: 'Some button text 2', callback_data: '2' }],
        [{ text: 'Some button text 3', callback_data: '3' }],
      ],
    }),
  };
  // bot.(msg.chat.id, 'answer.', options);
  await bot_control.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID_CONTROL, 'control', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: `pause`,
            callback_data: 'callbackData',
            // url: `https://example.com`,
          },
          {
            text: `collect`,
            callback_data: 'callbackData',
            // url: `https://example.com`,
          },
        ],
      ],
    },
  });
  // await ctx.reply(commands, options);

  // ctx.dow
});

bot.on('callback_query', function onCallbackQuery(callbackQuery) {
  console.log('xxxx:callback_query:', callbackQuery);
  // const action = callbackQuery.data;
  // const action = callbackQuery.data;
  // const msg = callbackQuery.message;
  // const opts = {
  //   chat_id: msg.chat.id,
  //   message_id: msg.message_id,
  // };
  // let text;

  // if (action === '1') {
  //   text = 'You hit button 1';
  // }

  // bot.editMessageText(text, opts);
});
bot.command('help', async ctx => {
  if (!checkPermission(ctx)) {
    return;
  }
  console.log('ctx.update:', ctx.update);
  await ctx.reply(commands);
  // ctx.dow
});

export let GetNotionalThresholdTable = async (id?: string) => {
  let desc = '当前合约配置:\n\n';
  let symbols: string[] = [];
  for (let notional of LatticeTable) {
    desc = desc + `Threshold:${notional.Threshold}\n`;
    desc = desc + `PositionBuild:${notional.PositionBuild}\n`;
    desc = desc + `PositionReduce:${notional.PositionReduce}\n`;
    desc = desc + `-------------------------------\n`;
  }
  return desc;
};
bot.command('get', async ctx => {
  if (!checkPermission(ctx)) {
    return;
  }
  let desc = await GetGridConfig(null, ctx);
  // await sendBotMessage(desc);
});
export let GetGridConfig = async (id?: string, ctx?: any) => {
  for (let cx of loopSpotCxs) {
    if (id && id != cx.market.symbol) {
      continue;
    } else if (cx.gridConfig) {
      let OnchainBidOld = cx.gridConfig.OnchainBid;
      let OnchainAskOld = cx.gridConfig.OnchainAsk;
      let OffchainBidOld = cx.gridConfig.OffchainBid;
      let OffchainAskOld = cx.gridConfig.OffchainAsk;
      let gasdesc = ``;
      let uniqAddress = new Set<string>();
      let tokenPathStart: TokenPath;
      for (let tokenPath of cx.tokenPaths) {
        if (cx.isStartToken(tokenPath.startToken.key)) {
          tokenPathStart = tokenPath;
          let poolPathBest = tokenPath.poolPathBest;
          if (poolPathBest) {
            cx.gridConfig.OnchainBid = poolPathBest.tokenInfo.GetPathPriceBid();
            cx.gridConfig.OnchainAsk = poolPathBest.tokenInfo.GetPathPriceAsk();
            cx.gridConfig.OffchainBid = poolPathBest.tokenPath.spotCx.GetPriceAfterAllCostBySide(
              poolPathBest.tokenPath.exSide,
            );
            cx.gridConfig.OffchainAsk = poolPathBest.tokenPath.spotCx.GetAskPriceAfterAllCostBySide(
              poolPathBest.tokenPath.exSide,
            );
          }
        }
        if (
          (cx.market.side == 0 && cx.market.token0.key == tokenPath.startToken.key) ||
          (cx.market.side == 1 && cx.market.token1.key == tokenPath.startToken.key)
        ) {
          if (tokenPath.spotCx.commiter && !uniqAddress.has(tokenPath.spotCx.commiter.address)) {
            let gasBalance = ethers.utils.formatEther(await tokenPath.spotCx.commiter.getBalance());
            if (parseFloat(gasBalance) < 30) {
              gasBalance = `\`${gasBalance}\``;
            }
            uniqAddress.add(tokenPath.spotCx.commiter.address);
            gasdesc = gasdesc + `gas余额:\t\t${gasBalance}\n`;
            gasdesc = gasdesc + `gas地址:\t${tokenPath.spotCx.commiter.address}\n`;
            gasdesc = gasdesc + `合约地址:\t${CONTRACT_ARBITRAGE_ADDRESS}\n`;
            let startTokenBalanceInit = cx.gridConfig.token0BalanceInit;
            let endTokenBalanceInit = cx.gridConfig.token1BalanceInit;
            if (cx.market.side == 1) {
              startTokenBalanceInit = cx.gridConfig.token1BalanceInit;
              endTokenBalanceInit = cx.gridConfig.token0BalanceInit;
            }
            let startTokenBalance = await tokenPath.startTokenInstance.balanceOf(CONTRACT_ARBITRAGE_ADDRESS);
            let endTokenBalance = await tokenPath.endTokenInstance.balanceOf(CONTRACT_ARBITRAGE_ADDRESS);
            gasdesc =
              gasdesc +
              `${tokenPath.startToken.symbol}余额:\t${
                parseFloat(startTokenBalance.toString()) / tokenPath.startToken.one
              }/${startTokenBalanceInit}\n`;
            gasdesc =
              gasdesc +
              `${tokenPath.endToken.symbol}余额:\t${
                parseFloat(endTokenBalance.toString()) / tokenPath.endToken.one
              }/${endTokenBalanceInit}\n`;
          }
        }
      }
      let desc = `当前状态:${cx.market.symbol}\n\n`;
      desc = desc + `RealizedPNL:\t${cx.gridConfig.RealizedPNL}\n`;
      desc = desc + `UnrealizedPNL:\t${cx.gridConfig.UnrealizedPNL}\n`;
      desc = desc + `TargetNotional:\t${cx.gridConfig.TargetNotional}\n`;
      await cx.UpdateActualPosition(tokenPathStart);
      cx.gridConfig.ActualPositionOffset = cx.gridConfig.ActualPositionOffset || 0;
      desc = desc + `ActualPosition:\t${cx.gridConfig.ActualPosition}/${cx.gridConfig.ActualPositionOffset}\n`;
      let OnchainBid = cx.gridConfig.OnchainBid;
      let OnchainAsk = cx.gridConfig.OnchainAsk;
      let OffchainBid = cx.gridConfig.OffchainBid;
      let OffchainAsk = cx.gridConfig.OffchainAsk;
      for (let poolPath of tokenPathStart.poolPathInfos) {
        let pathDesc = '';
        for (let poolBaseData of poolPath.poolBaseDataPath) {
          let market = exchangeMarketAddressMap.get(poolBaseData.addr);
          pathDesc += market.symbol + ',';
        }
        let OnchainBid = poolPath.GetPathPriceBid();
        let OnchainAsk = poolPath.GetPathPriceAsk();
        desc =
          desc +
          `链上价格:${OnchainBid.toFixed(8)}/${OnchainAsk.toFixed(8)}(${(OnchainBid / OnchainAsk).toFixed(4)})\n`;
      }
      desc =
        desc +
        `链下价格:${OffchainBid.toFixed(8)}/${OffchainAsk.toFixed(8)}(${(OffchainBid / OffchainAsk).toFixed(4)})\n`;
      let AnAskDiff = 0;
      let AnBidDiff = 0;
      if (cx.An && cx.spotDx && cx.spotDx.An) {
        AnBidDiff = (-cx.An + cx.spotDx.An) / cx.An;
        AnAskDiff = (-cx.An + cx.spotDx.An) / cx.An;
      }
      if (cx.An && cx.spotDx?.An) {
        desc =
          desc + `平均移动:${cx.An.toFixed(8)}/${cx.spotDx?.An.toFixed(8)}/${(-cx.An + cx.spotDx?.An).toFixed(8)}\n`;
      }
      desc =
        desc +
        `OnOverOffPositive:${cx.gridConfig.OnOverOffPositivePosition}/${cx.gridConfig.OnOverOffPositivePositionConfirm}\n`;
      desc =
        desc +
        `OnOverOffNegative:${cx.gridConfig.OnOverOffNegativePosition}/${cx.gridConfig.OnOverOffNegativePositionConfirm}\n`;
      desc =
        desc +
        `OnOverOffSpread:${cx.gridConfig.OnchainOverOffchainSpread.toFixed(
          8,
        )}/${cx.gridConfig.OffchainOverOnchainSpread.toFixed(8)}\n`;
      desc = desc + `gasCost:\t\t${cx.gridConfig.gasCost}\n`;
      desc = desc + `gas底价:\t\t${feeDatamaxFeePerGasBase.div(1e9).toString()}\n`;
      desc = desc + `gas天价:\t\t${feeDatamaxFeePerGasMax.div(1e9).toString()}\n`;
      desc = desc + gasdesc;
      desc = desc + `commitTimes:\t${cx.gridConfig.commitTimes}\n`;
      desc = desc + `UnitNotional:\t${cx.gridConfig.UnitNotional}\n`;
      // desc = desc + `OnOverOffPositivePosition:${cx.gridConfig.OnOverOffPositivePosition}\n`;
      // desc = desc + `OnOverOffNegativePosition:${cx.gridConfig.OnOverOffNegativePosition}\n`;
      desc = desc + `OnOverOffPositivePositionConfirm:${cx.gridConfig.OnOverOffPositivePositionConfirm}\n`;
      desc = desc + `OnOverOffNegativePositionConfirm:${cx.gridConfig.OnOverOffNegativePositionConfirm}\n`;
      let signal = cx.gridConfig.Signal;
      if (!signal) {
        signal = cx.market.ex;
      }
      desc = desc + `信号:${signal}\n`;
      if (cx.gridConfig.pauseEndTime) {
        desc = desc + `运行状态:暂停倒计时${Math.floor((cx.gridConfig.pauseEndTime - Date.now()) / 1000)}\n`;
      } else {
        desc = desc + `运行状态:${cx.gridConfig.pause ? '暂停' : '运行'}\n`;
      }
      desc = desc + `更新时间:${cx.gridConfig.updateTime}\n`;
      desc = desc + `创建时间:${cx.gridConfig.createTime}\n`;
      desc = desc + `-------------------------------\n`;
      if (ctx) {
        let pause = cx.gridConfig.pause ? '暂停' : '运行';
        let reply_keyboard = [
          ['买入', '卖出', '查看'],
          ['减仓', '加仓', pause],
        ];
        // let markup = { ...Markup.removeKeyboard(), ...Markup.keyboard(reply_keyboard) };
        // let delmessage = await ctx.reply(desc, {
        //   reply_markup: { resize_keyboard: true, ...Markup.keyboard(reply_keyboard) },
        // });
        // await ctx.deleteMessage(delmessage.message_id);
        // let reply = await ctx.reply(desc, Markup.keyboard(reply_keyboard).oneTime());
        cx.gridConfig.OnchainBid = OnchainBidOld;
        cx.gridConfig.OnchainAsk = OnchainAskOld;
        cx.gridConfig.OffchainBid = OffchainBidOld;
        cx.gridConfig.OffchainAsk = OffchainAskOld;
        let reply = await ctx.reply(desc, Markup.keyboard(reply_keyboard));
      } else {
        await sendBotMessage(desc);
      }
      cx.SaveStatusConfig();
    }
  }
};
export let grid_pause = (gridConfig: GridConfig) => {
  let desc = '';
  let oneHour = 3600 * 1000;
  if (!gridConfig.pause) {
    if (!gridConfig.pauseEndTime) {
      gridConfig.pauseEndTime = Date.now() + oneHour;
      desc = `暂停倒计时:${Math.floor((gridConfig.pauseEndTime - Date.now()) / 1000)}`;
    } else if (gridConfig.pauseEndTime - Date.now() > 3 * oneHour) {
      gridConfig.pauseEndTime = null;
      gridConfig.pause = true;
      desc = '永久暂停';
    } else {
      gridConfig.pauseEndTime += oneHour;
      desc = `暂停倒计时:${Math.floor((gridConfig.pauseEndTime - Date.now()) / 1000)}`;
    }
  } else {
    gridConfig.pause = false;
    desc = '运行';
  }
  return desc;
};
let command_pause = (ctx: any) => {
  if (!checkPermission(ctx)) {
    return;
  }
  // ctx.reply(commands);
  let params = getParams(ctx, 0);
  let id = params.get('id');
  let desc = '';
  for (let cx of loopSpotCxs) {
    if (id) {
      if (cx.gridConfig) {
        cx.gridConfig.pause = cx.gridConfig.pause ? false : true;
        cx.SaveStatusConfig();
      }
      break;
    } else if (cx.gridConfig) {
      desc = grid_pause(cx.gridConfig);
      cx.SaveStatusConfig();
    }
  }
  ctx.reply(`操作成功:${desc}`);
};
bot.command('pause', command_pause);
bot.command('grid', async ctx => {
  if (!checkPermission(ctx)) {
    return;
  }
  let desc = await GetGridConfig(null, ctx);
});
bot.command('lattice', async ctx => {
  if (!checkPermission(ctx)) {
    return;
  }
  let params = getParams(ctx, 0);
  let id = params.get('id');
  for (let cx of loopSpotCxs) {
    if (id && id != cx.market.symbol) {
      continue;
    } else if (cx.gridConfig) {
      let desc = JSON.stringify(cx.gridConfig.latticeTable || LatticeTable, null, 4);
      ctx.reply(`LatticeTable:${desc}`);
      //只需要处理的一个,剩下的都一样
      break;
    }
  }
});
bot.command('set', async ctx => {
  if (!checkPermission(ctx)) {
    return;
  }
  // console.log('set:', ctx);
  let params = getParams(ctx, 1);
  if (params.size == 0) {
    ctx.reply('缺少参数');
    return;
  }
  if (commitWaitingMap.size > 0) {
    ctx.reply('正在提交交易,请稍后再试');
    return;
  }
  console.log('set:', ctx.message.text);
  console.log('set:', params);
  let id = params.get('id');
  {
    let TargetNotional = parseFloat(params.get('TargetNotional'));
    if (TargetNotional) {
      for (let cx of loopSpotCxs) {
        let oldTargetNotional = 0;
        if (id && id != cx.market.symbol) {
          continue;
        } else if (cx.gridConfig) {
          oldTargetNotional = cx.gridConfig.TargetNotional;
          cx.gridConfig.TargetNotional = TargetNotional;
          cx.gridConfig.TargetPosition = cx.gridConfig.UnitNotional * TargetNotional;
          cx.gridConfig.ActualPosition = cx.gridConfig.TargetPosition;
          cx.SaveStatusConfig();
          ctx.reply(`设置TargetNotional成功:${oldTargetNotional},${TargetNotional}`);
          //只需要处理的一个,剩下的都一样
          break;
        }
      }
    }
  }
  {
    let DiffNotional = parseFloat(params.get('DiffNotional'));
    if (DiffNotional) {
      for (let cx of loopSpotCxs) {
        let oldTargetNotional = 0;
        if (id && id != cx.market.symbol) {
          continue;
        } else if (cx.gridConfig) {
          cx.ChangeNotional(DiffNotional);
          ctx.reply(`设置DiffNotional成功:${oldTargetNotional},${cx.gridConfig.TargetNotional}`);
          //只需要处理的一个,剩下的都一样
          break;
        }
      }
    }
  }
  {
    let UnitNotional = parseFloat(params.get('UnitNotional'));
    if (UnitNotional) {
      for (let cx of loopSpotCxs) {
        let oldUnitNotional = 0;
        if (id && id != cx.market.symbol) {
          continue;
        } else if (cx.gridConfig) {
          // if (tokenPath.spotCx.gridConfig.TargetNotional > 0) {
          //   ctx.reply('只有在TargetNotional为0时才能改变UnitNotional');
          //   return;
          // }
          oldUnitNotional = cx.gridConfig.UnitNotional;
          cx.gridConfig.UnitNotional = UnitNotional;

          let TargetNotional = cx.gridConfig.TargetNotional;
          cx.gridConfig.TargetPosition = cx.gridConfig.UnitNotional * TargetNotional;
          //这里不改变,让系统来平衡
          //cx.gridConfig.ActualPosition = cx.gridConfig.TargetPosition;
          cx.SaveStatusConfig();
          ctx.reply(`设置UnitNotional成功:${oldUnitNotional},${UnitNotional}`);
          //只需要处理的一个,剩下的都一样
          break;
        }
      }
    }
  }
  {
    let ActualPosition = parseFloat(params.get('ActualPosition'));
    if (ActualPosition) {
      for (let cx of loopSpotCxs) {
        let oldActualPosition = 0;
        if (id && id != cx.market.symbol) {
          continue;
        } else if (cx.gridConfig) {
          for (let tokenPath of cx.tokenPaths) {
            if (cx.isStartToken(tokenPath.startToken.key)) {
              await cx.UpdateActualPosition(tokenPath);
              oldActualPosition = cx.gridConfig.ActualPosition;
              cx.gridConfig.ActualPositionOffset = ActualPosition - cx.gridConfig.ActualPosition;
              break;
            }
          }
          //这里不改变,让系统来平衡
          //cx.gridConfig.ActualPosition = cx.gridConfig.TargetPosition;
          cx.SaveStatusConfig();
          ctx.reply(`设置ActualPosition成功:${oldActualPosition},${ActualPosition}`);
          //只需要处理的一个,剩下的都一样
          break;
        }
      }
    }
  }
  {
    let Signal = params.get('Signal');
    if (Signal) {
      for (let cx of loopSpotCxs) {
        let oldSignal = 0;
        if (id && id != cx.market.symbol) {
          continue;
        } else if (cx.gridConfig) {
          if (Signal == 'NONE') {
            cx.gridConfig.Signal = null;
          } else {
            cx.gridConfig.Signal = Signal;
          }
          cx.SaveStatusConfig();
          ctx.reply(`设置Signal成功:${oldSignal},${Signal}`);
          //只需要处理的一个,剩下的都一样
          break;
        }
      }
    }
  }
  {
    let ReferenceBalance = parseFloat(params.get('ReferenceBalance'));
    let symbol = params.get('symbol');
    if (ReferenceBalance && symbol) {
      for (let cx of loopSpotCxs) {
        let oldUnitNotional = 0;
        if (id && id != cx.market.symbol) {
          continue;
        } else if (cx.gridConfig) {
          for (let tokenPath of cx.tokenPaths) {
            if (cx.market.side == 0) {
              if (symbol == tokenPath.startToken.symbol) {
                cx.gridConfig.token0BalanceInit = ReferenceBalance;
              } else if (symbol == tokenPath.endToken.symbol) {
                cx.gridConfig.token1BalanceInit = ReferenceBalance;
              } else {
                ctx.reply(`找不到要操作的币:${symbol}`);
              }
            } else {
              if (symbol == tokenPath.startToken.symbol) {
                cx.gridConfig.token1BalanceInit = ReferenceBalance;
              } else if (symbol == tokenPath.endToken.symbol) {
                cx.gridConfig.token0BalanceInit = ReferenceBalance;
              } else {
                ctx.reply(`找不到要操作的币:${symbol}`);
              }
            }
            //这里不改变,让系统来平衡
            //cx.gridConfig.ActualPosition = cx.gridConfig.TargetPosition;
            await cx.UpdateActualPosition(tokenPath);
            cx.SaveStatusConfig();
            ctx.reply(`设置ReferenceBalance成功:${symbol},${ReferenceBalance}`);
            break;
          }
          break;
        }
      }
    }
  }
  {
    let checkReset = params.get('checkReset');
    if (checkReset == 'true' || checkReset == 'false') {
      for (let cx of loopSpotCxs) {
        let oldRealizedPNL = 0;
        if (id && id != cx.market.symbol) {
          continue;
        } else if (cx.gridConfig) {
          // if (tokenPath.spotCx.gridConfig.TargetNotional > 0) {
          //   ctx.reply('只有在TargetNotional为0时才能改变UnitNotional');
          //   return;
          // }
          let oldcheckReset = cx.gridConfig.checkReset;
          cx.gridConfig.checkReset = checkReset == 'true' ? true : false;

          //这里不改变,让系统来平衡
          //cx.gridConfig.ActualPosition = cx.gridConfig.TargetPosition;
          cx.SaveStatusConfig();
          ctx.reply(`设置checkReset成功:${oldcheckReset},${cx.gridConfig.checkReset}`);
          //只需要处理的一个,剩下的都一样
          break;
        }
      }
    }
  }
  {
    let RealizedPNL = parseFloat(params.get('RealizedPNL'));
    if (RealizedPNL || RealizedPNL == 0) {
      for (let cx of loopSpotCxs) {
        let oldRealizedPNL = 0;
        if (id && id != cx.market.symbol) {
          continue;
        } else if (cx.gridConfig) {
          // if (tokenPath.spotCx.gridConfig.TargetNotional > 0) {
          //   ctx.reply('只有在TargetNotional为0时才能改变UnitNotional');
          //   return;
          // }
          oldRealizedPNL = cx.gridConfig.RealizedPNL;
          cx.gridConfig.RealizedPNL = RealizedPNL;
          SetStartRealizedPNL(cx.gridConfig.RealizedPNL);

          //这里不改变,让系统来平衡
          //cx.gridConfig.ActualPosition = cx.gridConfig.TargetPosition;
          cx.SaveStatusConfig();
          ctx.reply(`设置RealizedPNL成功:${oldRealizedPNL},${RealizedPNL}`);
          //只需要处理的一个,剩下的都一样
          break;
        }
      }
    }
  }
  let latticestr = params.get('LatticeTable');
  if (latticestr && latticestr != '') {
    try {
      let latticeTable = JSON.parse(latticestr) as Notional[];
      if (latticeTable.length < 3 || !latticeTable[1].Threshold) {
        ctx.reply(`配置格式不正确:$${latticeTable}`);
        return;
      }
      for (let cx of loopSpotCxs) {
        let oldlattice = null;
        if (id && id != cx.market.symbol) {
          continue;
        } else if (cx.gridConfig) {
          oldlattice = cx.gridConfig.latticeTable;
          cx.gridConfig.latticeTable = latticeTable;
        }
        cx.SaveStatusConfig();
        ctx.reply(`设置lattice成功:${oldlattice},${latticeTable}`);
        break;
      }
    } catch (e) {
      ctx.reply(`JSON解析失败:${e}`);
    }
  }
});
bot.command('reset', async ctx => {
  if (!checkPermission(ctx)) {
    return;
  }
  // console.log('set:', ctx);
  let params = getParams(ctx, 0);

  if (commitWaitingMap.size > 0) {
    ctx.reply('正在提交交易,请稍后再试');
    return;
  }
  let id = params.get('id');
  for (let cx of loopSpotCxs) {
    if (id && id != cx.market.symbol) {
      continue;
    } else if (cx.gridConfig) {
      for (let tokenPath of cx.tokenPaths) {
        if (cx.isStartToken(tokenPath.startToken.key)) {
          await tokenPath.UpdateStartEndTokenBalance(true);
          let ret = await cx.CheckResetTargetNotional(tokenPath, true);
          await cx.ResetActualPositionConfirm(tokenPath);
          if (ret) {
            ctx.reply(`重置ReferenceBalance成功:${cx.gridConfig.ActualPosition}`);
          } else {
            ctx.reply(`重置ReferenceBalance成功,没有差异`);
          }
          break;
        }
      }
      //只需要处理的一个,剩下的都一样
      break;
    }
  }
});
bot.command('gas', async ctx => {
  if (!checkPermission(ctx)) {
    return;
  }
  // console.log('set:', ctx);
  let params = getParams(ctx, 2);
  if (params.size == 0) {
    ctx.reply('缺少参数');
    return;
  }
  console.log('set:', ctx.message.text);
  console.log('set:', params);
  let base = parseFloat(params.get('base'));
  if (base) {
    if (base > 5000) {
      ctx.reply(`基础费用不能超过5000,当前:${feeDatamaxFeePerGasBase},传入:${base}`);
      return;
    }
    SetFeeDatamaxFeePerGasBase(base * 1e9);
    ctx.reply(`设置基础费用成:${feeDatamaxFeePerGasBase}`);
  }
  let max = parseFloat(params.get('max'));
  if (max) {
    if (max > 20000) {
      ctx.reply(`天价费用不能超过20000,当前:${feeDatamaxFeePerGasMax},传入:${max}`);
      return;
    }
    SetFeeDatamaxFeePerGasMax(max * 1e9);
    ctx.reply(`设置天价费用成:${feeDatamaxFeePerGasMax}`);
  }
});
bot.command('pending', async ctx => {
  if (!checkPermission(ctx)) {
    return;
  }
  // console.log('set:', ctx);
  let params = getParams(ctx, 2);
  if (params.size == 0) {
    ctx.reply('缺少参数');
    return;
  }
  console.log('pending:', ctx.message.text);
  console.log('pending:', params);
  let op = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; //山寨操作
  if (params.get('del')) {
    op = '0xdddddddddddddddddddddddddddddddddddddddd'; //山寨操作
  }
  let sep = 'cccccccccccccccccccccccccccccccccccccc'; //山寨分隔符
  let fakeTo = '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa'; //山寨假合约
  let from = ''; //用户地址
  if (params.get('from')) {
    from = ethers.utils.getAddress(params.get('from'));
  }
  let to = ''; //合约地址
  if (params.get('to')) {
    to = ethers.utils.getAddress(params.get('to'));
  }
  let toAll = params.get('toall');
  if (from == '' && to == '') {
    ctx.reply('缺少参数,from,to');
  }
  let transaction = {
    to: fakeTo,
    data: `${op}`,
  };
  if (from != '') {
    transaction.data = `${transaction.data}${sep}${ethers.utils.getAddress(from).substring(2)}`;
  }
  if (to != '') {
    transaction.data = `${transaction.data}${sep}${ethers.utils.getAddress(to).substring(2)}`;
  }
  // if (!pendingAddressGasMap.get(from.toLowerCase()))
  pendingAddressGasMap.set(from.toLowerCase(), {
    hash: from.toLowerCase(),
    from: from.toLowerCase(),
    to: to,
    input: '',
    gasPrice: '0',
    gasTipCap: '0',
    gasFeeCap: '0',
    gasPriceBig: BigNumber.from(0),
    gasTipCapBig: BigNumber.from(0),
    gasFeeCapBig: BigNumber.from(0),
    createAt: 0,
    blockNumber: lastBlockNumber,
  });
  if (toAll == 'true') {
    pendingAddressGasMap.set(to.toLowerCase(), {
      hash: from.toLowerCase(),
      from: from.toLowerCase(),
      to: to,
      input: '',
      gasPrice: '0',
      gasTipCap: '0',
      gasFeeCap: '0',
      gasPriceBig: BigNumber.from(0),
      gasTipCapBig: BigNumber.from(0),
      gasFeeCapBig: BigNumber.from(0),
      createAt: 0,
      blockNumber: lastBlockNumber,
    });
  }
  if (from == to) {
    pendingAddressGasMap.delete(from.toLowerCase());
  }
  try {
    await pendingprovider.call(transaction);
  } catch (e) {
    if (e.response) {
      let data = JSON.parse(e.response);
      if (data.error.message != 'control params,山寨参数控制,无视报错') {
        ctx.reply('设置失败:');
        console.log('xxx:', data.error.message);
      } else {
        ctx.reply('设置成功');
      }
    } else {
      ctx.reply(`设置失败:${e}`);
    }
  }
});
// bot.command('act', async (ctx) => {
//   if (!checkPermission(ctx)) {
//     return;
//   }
//   let desc = await counterCx.GetStatusForBot();
//   ctx.reply(desc);
//   // ctx.reply(ctx.message.text);
// });
let getParams = (ctx: any, minkv: number = 0) => {
  let paramMap = new Map<string, string>();
  let text = ctx.message.text;
  text = text.replace('\n', '');
  text = text.replace('\t', ' ');
  text = text.replace('    ', ' ');
  text = text.replace('  ', ' ');
  let data = text.substring(text.search(' ') + 1) as string;
  for (let kvs of data.split(' ')) {
    let kv = kvs.split('=');
    if (kv.length != 2) {
      if (paramMap.size < minkv) {
        ctx.reply(`\`参数个数不正确${data},参考 /set pause=true\``);
      }
      return paramMap;
    }
    paramMap.set(kv[0], kv[1]);
  }
  return paramMap;
};
// bot.command('market', async (ctx) => {
//   if (!checkPermission(ctx)) {
//     return;
//   }
//   let params = getParams(ctx);
//   let id = params.get('id');
//   let desc = await GetMarketStatusForBot(id);
//   ctx.reply(desc);
//   // ctx.reply(ctx.message.text);
// });
// bot.command('pnl', async (ctx) => {
//   if (!checkPermission(ctx)) {
//     return;
//   }
//   let params = getParams(ctx);
//   let id = params.get('id');
//   let desc = await GetPnlStatusForBot(id);
//   ctx.reply(desc);
//   // ctx.reply(ctx.message.text);
// });
// bot.command('excel', async (ctx) => {
//   if (!checkPermission(ctx)) {
//     return;
//   }
//   let params = getParams(ctx, 0);
//   if (params.size == 0) {
//     ctx.reply('缺少参数');
//     return;
//   }
//   let id = params.get('id');
//   let spotCxs = loopSpotCxs.filter((v: SpotCx) => {
//     return v.id == id;
//   });
//   if (spotCxs.length == 0) {
//     ctx.reply(`找不到交易对:${id}`);
//     return false;
//   }
//   let spotCx = spotCxs[0];
//   ctx.reply('正在处理,请稍等...');
//   exec(`${process.cwd()}/reports`, function (err, stdout, stderr) {});

//   {
//     let logs = [
//       {
//         name: 'sheet1',
//         data: [],
//       },
//     ];
//     let tmps = spotCx.lineLogHeader.split('\t');
//     logs[0].data.push(tmps);
//     for (let line of spotCx.lineLogDatas) {
//       let tmps = line.data.split('\t');
//       logs[0].data.push([moment(line.msec).format('YYYY-MM-DD HH:mm:ss'), ...tmps]);
//     }
//     // for (let line of spotCx.allDataLog) {
//     //   let tmps = line.data.split(' ');
//     //   logs[0].data.push([moment(line.msec).format('YYYY-MM-DD HH:mm:ss'), ...tmps]);
//     // }
//     let filename = `./reports/report_${spotCx.id}_${moment().format('YYYY-MM-DD')}.xlsx`;
//     let buffer = xlsx.build(logs);
//     fs.writeFileSync(filename, buffer as any);
//     // 	fs.openSync
//     // 	ReadableStream;
//     // fs.createReadStream(filename)
//     bot.telegram.sendDocument(process.env.TELEGRAM_CHAT_ID, { filename: filename, source: fs.readFileSync(filename) });
//     return;
//   }
//   /*
//   let logs = [
//     {
//       name: 'sheet1',
//       data: [['time', 'id', 'cx', 'bid', 'ask']],
//     },
//   ];
//   for (let line of spotCx.marketDataLog) {
//     let tmps = line.data.split(' ');
//     logs[0].data.push([moment(line.msec).format('YYYY-MM-DD HH:mm:ss'), ...tmps]);
//   }
//   let filename = `./reports/RecordMarketData_${moment().format('YYYY-MM-DD')}.xlsx`;
//   let buffer = xlsx.build(logs);
//   fs.writeFileSync(filename, buffer as any);
//   // 	fs.openSync
//   // 	ReadableStream;
//   // fs.createReadStream(filename)
//   bot.telegram.sendDocument(process.env.TELEGRAM_CHAT_ID, { filename: filename, source: fs.readFileSync(filename) });
//   {
//     logs = [
//       {
//         name: 'sheet1',
//         data: [['time', 'id', 'ContractName', 'UniswapBid', 'UniswapAsk']],
//       },
//     ];
//     for (let line of spotCx.contractDataLog) {
//       let tmps = line.data.split(' ');
//       logs[0].data.push([moment(line.msec).format('YYYY-MM-DD HH:mm:ss'), ...tmps]);
//     }
//     filename = `${process.cwd()}/reports/RecordContractData_${moment().format('YYYY-MM-DD')}.xlsx`;
//     buffer = xlsx.build(logs);
//     fs.writeFileSync(filename, buffer as any);
//     bot.telegram.sendDocument(process.env.TELEGRAM_CHAT_ID, { filename: filename, source: fs.readFileSync(filename) });
//   }
//   {
//     logs = [
//       {
//         name: 'sheet1',
//         data: [['time', 'id', 'ContractName', 'ActualPosition', 'PositionEntryLevel']],
//       },
//     ];
//     for (let line of spotCx.positionInfoDataLog) {
//       let tmps = line.data.split(' ');
//       logs[0].data.push([moment(line.msec).format('YYYY-MM-DD HH:mm:ss'), ...tmps]);
//     }
//     filename = `${process.cwd()}/reports/RecordPositionInfo_${moment().format('YYYY-MM-DD')}.xlsx`;
//     buffer = xlsx.build(logs);
//     fs.writeFileSync(filename, buffer as any);
//     bot.telegram.sendDocument(process.env.TELEGRAM_CHAT_ID, { filename: filename, source: fs.readFileSync(filename) });
//   }
//   {
//     logs = [
//       {
//         name: 'sheet1',
//         data: [['time', 'id', 'ContractName', 'UnrealizedPNL', 'RealizedPNL']],
//       },
//     ];
//     for (let line of spotCx.positionPnlDataLog) {
//       let tmps = line.data.split(' ');
//       logs[0].data.push([moment(line.msec).format('YYYY-MM-DD HH:mm:ss'), ...tmps]);
//     }
//     filename = `${process.cwd()}/reports/RecordPositionPNL_${moment().format('YYYY-MM-DD')}.xlsx`;
//     buffer = xlsx.build(logs);
//     fs.writeFileSync(filename, buffer as any);
//     bot.telegram.sendDocument(process.env.TELEGRAM_CHAT_ID, { filename: filename, source: fs.readFileSync(filename) });
//   }
// 	// */
//   // ctx.reply(ctx.message.text);
// });
// bot.command('status', async (ctx) => {
//   if (!checkPermission(ctx)) {
//     return;
//   }
//   let params = getParams(ctx, 1);
//   if (params.size == 0) {
//     ctx.reply('缺少参数');
//     return;
//   }
//   let id = params.get('id');
//   let spotCxs = loopSpotCxs.filter((v: SpotCx) => {
//     return v.id == id;
//   });
//   if (spotCxs.length == 0) {
//     ctx.reply(`找不到交易对:${id}`);
//     return false;
//   }
//   let spotCx = spotCxs[0];
//   let desc = JSON.stringify(spotCx.recordedStatus.spotCxMarket, null, 4);
//   ctx.reply(desc);
//   desc = JSON.stringify(spotCx.recordedStatus.hedgeContract, null, 4);
//   ctx.reply(desc);
//   desc = JSON.stringify(spotCx.recordedStatus.positionData, null, 4);
//   ctx.reply(desc);
//   // ctx.reply(ctx.message.text);
// });
// bot.command('set', async (ctx) => {
//   if (!checkPermission(ctx)) {
//     return;
//   }
//   // console.log('set:', ctx);
//   let params = getParams(ctx, 2);
//   if (params.size == 0) {
//     ctx.reply('缺少参数');
//     return;
//   }
//   console.log('set:', ctx.message.text);
//   console.log('set:', params);
//   return await SetSpotCxParams(ctx, params);
// });
// bot.command('remove', async (ctx) => {
//   if (!checkPermission(ctx)) {
//     return;
//   }
//   let params = getParams(ctx);
//   if (!params.has('id')) {
//     ctx.reply('参数个数不正确,参考 /remove id=pair');
//     return;
//   }
//   let ret = await RemoveStrategy(params.get('id'));
//   if (!ret) {
//     ctx.reply(`找不到交易对:${params.get('id')}`);
//   }
//   await sendBotMessage('执行结果:' + (ret ? '成功' : '失败'));
// });
// bot.command('addstrategy', async (ctx) => {
//   if (!checkPermission(ctx)) {
//     return;
//   }
//   let ret = await AddStrategy(ctx.message.text.substring(ctx.message.text.search(' ') + 1) as string);
//   ctx.reply('执行结果:' + (ret ? '成功' : '失败'));
// });
// // bot.command('hipster', Telegraf.reply('xxxx'));
// //登陆

//标记一个启动时间,早与这个时间的指令都扔掉
bot.on('message', async ctx => {
  console.log('message:', ctx);
  let text = (ctx.update.message as any).text;
  if (text == '查看') {
    await GetGridConfig();
  } else if (text == '暂停') {
    command_pause(ctx);
    await GetGridConfig();
  } else if (text == '运行') {
    command_pause(ctx);
    await GetGridConfig();
  } else if (text == '加仓') {
    for (let cx of loopSpotCxs) {
      if (cx.gridConfig) {
        if (cx.gridConfig.OnOverOffNegativePosition > 0) {
          cx.gridConfig.OnOverOffNegativePosition -= 1;
        } else {
          cx.gridConfig.OnOverOffPositivePosition += 1;
        }
        cx.gridConfig.lastOp = null;
        cx.SaveStatusConfig();
        ctx.reply(`加仓成功:${cx.gridConfig.OnOverOffPositivePosition}/${cx.gridConfig.OnOverOffNegativePosition}`);
        //只需要处理的一个,剩下的都一样
        break;
      }
    }
  } else if (text == '减仓') {
    for (let cx of loopSpotCxs) {
      if (cx.gridConfig) {
        if (cx.gridConfig.OnOverOffPositivePosition >= 2) {
          cx.gridConfig.OnOverOffPositivePosition -= 1;
        } else if (cx.gridConfig.OnOverOffPositivePosition > 0) {
          cx.gridConfig.OnOverOffPositivePosition = 0;
        } else {
          cx.gridConfig.OnOverOffNegativePosition += 1;
        }
        cx.gridConfig.lastOp = null;
        cx.SaveStatusConfig();
        ctx.reply(`减仓成功:${cx.gridConfig.OnOverOffPositivePosition}/${cx.gridConfig.OnOverOffNegativePosition}`);
        //只需要处理的一个,剩下的都一样
        break;
      }
    }
  } else if (text == '买入') {
    for (let cx of loopSpotCxs) {
      if (cx.gridConfig) {
        cx.botDNotional = cx.botDNotional || 0;
        cx.botDNotional++;
        ctx.reply(`买入${cx.botDNotional}成功`);
        //只需要处理的一个,剩下的都一样
        break;
      }
    }
  } else if (text == '卖出') {
    for (let cx of loopSpotCxs) {
      if (cx.gridConfig) {
        cx.botDNotional = cx.botDNotional || 0;
        cx.botDNotional--;
        ctx.reply(`卖出${cx.botDNotional}成功`);
        //只需要处理的一个,剩下的都一样
        break;
      }
    }
  }
});
let startTime = Math.floor(Date.now() / 1000);
export let TeleGramBotInit = () => {
  startTime = Math.floor(Date.now() / 1000);
  bot.settings;
  bot.launch();
  if (!process.env.TELEGRAM_CHAT_ID_CONTROL) {
    process.env.TELEGRAM_CHAT_ID_CONTROL = process.env.TELEGRAM_CHAT_ID;
  }
  return bot;
};

// // Enable graceful stop
// process.once('SIGINT', () => bot.stop('SIGINT'));
// process.once('SIGTERM', () => bot.stop('SIGTERM'));

// //因为有些文本跟markdown有冲突,就先不用
export let sendBotMessage = async (text: string, markdown: boolean = true, extra?: any) => {
  console.log('sendBotMessage:', text);
  try {
    if (markdown) {
      return await bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, text, { parse_mode: 'Markdown', ...extra });
    } else {
      return await bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, text, { ...extra });
    }
  } catch (e) {
    console.log('sendBotMessage err:', e);
  }
};
export let sendBotMessageControl = async (text: string, markdown: boolean = true, extra?: any) => {
  console.log('sendBotMessageControl:', text);
  try {
    if (markdown) {
      return await bot_control.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID_CONTROL, text, {
        parse_mode: 'Markdown',
        ...extra,
      });
    } else {
      return await bot_control.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID_CONTROL, text, { ...extra });
    }
  } catch (e) {
    console.log('sendBotMessage err:', e);
  }
};

// export let sendBotMessage = async (text: string, markdown: boolean = true, extra?: any) => {
//   console.log('sendBotMessage:', text);
// };
