import { BigNumber } from '@ethersproject/bignumber';
import { scale, bnum, calcOutGivenIn } from '../src/balancer-labs/src/bmath';
import { BigNumber as BalancerBigNumber } from '../src/balancer-labs/src/utils/bignumber';
export function BalancercalcOutGivenIn(
  tokenBalanceIn: BigNumber,
  tokenWeightIn: BigNumber,
  tokenBalanceOut: BigNumber,
  tokenWeightOut: BigNumber,
  tokenAmountIn: BigNumber,
  swapFee: BigNumber
): BigNumber {
  let ret = calcOutGivenIn(
    new BalancerBigNumber(tokenBalanceIn.toString()),
    new BalancerBigNumber(tokenWeightIn.toString()),
    new BalancerBigNumber(tokenBalanceOut.toString()),
    new BalancerBigNumber(tokenWeightOut.toString()),
    new BalancerBigNumber(tokenAmountIn.toString()),
    new BalancerBigNumber(swapFee.toString())
  );
  return BigNumber.from('0x' + ret.toString(16));
}
