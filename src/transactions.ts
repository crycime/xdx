import { BigNumber, Wallet } from 'ethers';
export const CancelPendingTransactoinAll = async (owner: Wallet, nonce?: number, hash?: string) => {
  console.log('cancel account:', owner.address);
  let pendingNonce = await owner.provider.getTransactionCount(owner.address, 'pending');
  console.log('pending nonce:', pendingNonce);
  let nownonce = await owner.getTransactionCount();
  console.log('now nonce:', nownonce);
  for (let nonce = nownonce; nonce < pendingNonce; nonce++) {
    let ret = await CancelPendingTransactoin(owner, nonce);
    if (!ret) {
      console.log('CancelPendingTransactoin err:', owner.address);
      return false;
    }
    let ret1 = await ret.wait();
    console.log('cancel transaction ok:', nonce, hash, ret1);
  }
  return true;
};
export const CancelPendingTransactoin = async (
  owner: Wallet,
  nonce?: number,
  hash?: string,
  maxFeePerGas?: BigNumber,
) => {
  nonce = nonce || (await owner.getTransactionCount());
  console.log('pending nonce:', owner.address, await owner.provider.getTransactionCount(owner.address, 'pending'));
  console.log('next nonce:', owner.address, await owner.getTransactionCount());
  let nextNonce = await owner.getTransactionCount();
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
  if (hash && hash != '') {
    let tx = await owner.provider.getTransaction(hash);
    if (tx) {
      if (feeData.maxFeePerGas.add(feeData.maxPriorityFeePerGas).lt(tx.maxFeePerGas.add(tx.maxPriorityFeePerGas))) {
        feeData.maxFeePerGas = tx.maxFeePerGas.mul(13).div(10);
        feeData.maxPriorityFeePerGas = tx.maxPriorityFeePerGas.mul(13).div(10);
      }
    } else if (maxFeePerGas) {
      if (feeData.maxFeePerGas.lt(maxFeePerGas)) {
        feeData.maxFeePerGas = maxFeePerGas;
        feeData.maxPriorityFeePerGas = maxFeePerGas;
      }
    }
  }
  if (feeData.maxFeePerGas.lt(feeData.gasPrice)) {
    feeData.maxFeePerGas = feeData.gasPrice;
  }
  while (true) {
    try {
      let newtx = {
        nonce: nonce,
        gasLimit: 21000,
        // gasPrice: gasPrice,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxFeePerGas,
        to: owner.address,
        value: 0,
      };
      console.log(
        '加价撤销订单:',
        nonce,
        newtx.maxFeePerGas.toString(),
        newtx.maxPriorityFeePerGas.toString(),
        feeData.maxFeePerGas.toString(),
        feeData.maxPriorityFeePerGas.toString(),
      );
      // let signTx = await wallet.sign(tx)
      // let resp = await rpcProvider.sendTransaction(signTx)
      let ret = await owner.sendTransaction(newtx);
      console.log(
        'cancel transaction waiting :',
        nonce,
        feeData.gasPrice.toString(),
        feeData.maxFeePerGas.toString(),
        hash,
        ret,
      );
      return ret;
    } catch (e) {
      if (e.reason == 'replacement fee too low') {
        console.log(
          'cancel transaction err:retry',
          e.reason,
          nonce,
          feeData.gasPrice.toString(),
          feeData.maxFeePerGas.toString(),
          hash,
        );
        feeData.maxFeePerGas = feeData.maxFeePerGas.mul(12).div(10);
        feeData.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas.mul(12).div(10);
      } else {
        return null;
      }
    }
  }
  // let ret1 = ret.wait();
  // console.log('cancel transaction:', ret1);
  // return ret1;
};
