/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import { Provider } from "@ethersproject/providers";
import type { IChiToken, IChiTokenInterface } from "../IChiToken";

const _abi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "freeFromUpTo",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
];

export class IChiToken__factory {
  static readonly abi = _abi;
  static createInterface(): IChiTokenInterface {
    return new utils.Interface(_abi) as IChiTokenInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): IChiToken {
    return new Contract(address, _abi, signerOrProvider) as IChiToken;
  }
}
