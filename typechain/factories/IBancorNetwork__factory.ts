/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import { Provider } from "@ethersproject/providers";
import type {
  IBancorNetwork,
  IBancorNetworkInterface,
} from "../IBancorNetwork";

const _abi = [
  {
    inputs: [
      {
        internalType: "address[]",
        name: "_path",
        type: "address[]",
      },
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_minReturn",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "_beneficiary",
        type: "address",
      },
      {
        internalType: "address",
        name: "_affiliateAccount",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "_affiliateFee",
        type: "uint256",
      },
    ],
    name: "convertByPath",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
];

export class IBancorNetwork__factory {
  static readonly abi = _abi;
  static createInterface(): IBancorNetworkInterface {
    return new utils.Interface(_abi) as IBancorNetworkInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): IBancorNetwork {
    return new Contract(address, _abi, signerOrProvider) as IBancorNetwork;
  }
}
