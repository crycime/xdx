/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import type { WETH9, WETH9Interface } from "../WETH9";

const _abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "src",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "guy",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "wad",
        type: "uint256",
      },
    ],
    name: "Approval",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "dst",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "wad",
        type: "uint256",
      },
    ],
    name: "Deposit",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "src",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "dst",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "wad",
        type: "uint256",
      },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "src",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "wad",
        type: "uint256",
      },
    ],
    name: "Withdrawal",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "allowance",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "guy",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "wad",
        type: "uint256",
      },
    ],
    name: "approve",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [
      {
        internalType: "uint8",
        name: "",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "deposit",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "dst",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "wad",
        type: "uint256",
      },
    ],
    name: "transfer",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "src",
        type: "address",
      },
      {
        internalType: "address",
        name: "dst",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "wad",
        type: "uint256",
      },
    ],
    name: "transferFrom",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "wad",
        type: "uint256",
      },
    ],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    stateMutability: "payable",
    type: "receive",
  },
];

const _bytecode =
  "0x60c0604052600d60808190526c2bb930b83832b21022ba3432b960991b60a090815261002e916000919061007a565b50604080518082019091526004808252630ae8aa8960e31b602090920191825261005a9160019161007a565b506002805460ff1916601217905534801561007457600080fd5b5061014e565b82805461008690610113565b90600052602060002090601f0160209004810192826100a857600085556100ee565b82601f106100c157805160ff19168380011785556100ee565b828001600101855582156100ee579182015b828111156100ee5782518255916020019190600101906100d3565b506100fa9291506100fe565b5090565b5b808211156100fa57600081556001016100ff565b600181811c9082168061012757607f821691505b6020821081141561014857634e487b7160e01b600052602260045260246000fd5b50919050565b610a778061015d6000396000f3fe6080604052600436106100c05760003560e01c8063313ce56711610074578063a9059cbb1161004e578063a9059cbb146101fa578063d0e30db01461021a578063dd62ed3e1461022257600080fd5b8063313ce5671461018c57806370a08231146101b857806395d89b41146101e557600080fd5b806318160ddd116100a557806318160ddd1461012f57806323b872dd1461014c5780632e1a7d4d1461016c57600080fd5b806306fdde03146100d4578063095ea7b3146100ff57600080fd5b366100cf576100cd61025a565b005b600080fd5b3480156100e057600080fd5b506100e96102b5565b6040516100f69190610937565b60405180910390f35b34801561010b57600080fd5b5061011f61011a366004610889565b610343565b60405190151581526020016100f6565b34801561013b57600080fd5b50475b6040519081526020016100f6565b34801561015857600080fd5b5061011f61016736600461084d565b6103bc565b34801561017857600080fd5b506100cd6101873660046108b3565b6105d3565b34801561019857600080fd5b506002546101a69060ff1681565b60405160ff90911681526020016100f6565b3480156101c457600080fd5b5061013e6101d33660046107ff565b60036020526000908152604090205481565b3480156101f157600080fd5b506100e96106f9565b34801561020657600080fd5b5061011f610215366004610889565b610706565b6100cd61025a565b34801561022e57600080fd5b5061013e61023d36600461081a565b600460209081526000928352604080842090915290825290205481565b336000908152600360205260408120805434929061027990849061098f565b909155505060405134815233907fe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c9060200160405180910390a2565b600080546102c2906109be565b80601f01602080910402602001604051908101604052809291908181526020018280546102ee906109be565b801561033b5780601f106103105761010080835404028352916020019161033b565b820191906000526020600020905b81548152906001019060200180831161031e57829003601f168201915b505050505081565b33600081815260046020908152604080832073ffffffffffffffffffffffffffffffffffffffff8716808552925280832085905551919290917f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925906103ab9086815260200190565b60405180910390a350600192915050565b73ffffffffffffffffffffffffffffffffffffffff83166000908152600360205260408120548211156103ee57600080fd5b73ffffffffffffffffffffffffffffffffffffffff84163314801590610464575073ffffffffffffffffffffffffffffffffffffffff841660009081526004602090815260408083203384529091529020547fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff14155b156104ec5773ffffffffffffffffffffffffffffffffffffffff841660009081526004602090815260408083203384529091529020548211156104a657600080fd5b73ffffffffffffffffffffffffffffffffffffffff84166000908152600460209081526040808320338452909152812080548492906104e69084906109a7565b90915550505b73ffffffffffffffffffffffffffffffffffffffff8416600090815260036020526040812080548492906105219084906109a7565b909155505073ffffffffffffffffffffffffffffffffffffffff83166000908152600360205260408120805484929061055b90849061098f565b925050819055508273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040516105c191815260200190565b60405180910390a35060019392505050565b6106536040518060400160405280600581526020017f787878783a0000000000000000000000000000000000000000000000000000008152503083600360003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461071a565b3360009081526003602052604090205481111561066f57600080fd5b336000908152600360205260408120805483929061068e9084906109a7565b9091555050604051339082156108fc029083906000818181858888f193505050501580156106c0573d6000803e3d6000fd5b5060405181815233907f7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b659060200160405180910390a250565b600180546102c2906109be565b60006107133384846103bc565b9392505050565b6107af84848484604051602401610734949392919061094a565b604080517fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe08184030181529190526020810180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff167fdaa394bd000000000000000000000000000000000000000000000000000000001790526107b5565b50505050565b80516a636f6e736f6c652e6c6f67602083016000808483855afa5050505050565b803573ffffffffffffffffffffffffffffffffffffffff811681146107fa57600080fd5b919050565b60006020828403121561081157600080fd5b610713826107d6565b6000806040838503121561082d57600080fd5b610836836107d6565b9150610844602084016107d6565b90509250929050565b60008060006060848603121561086257600080fd5b61086b846107d6565b9250610879602085016107d6565b9150604084013590509250925092565b6000806040838503121561089c57600080fd5b6108a5836107d6565b946020939093013593505050565b6000602082840312156108c557600080fd5b5035919050565b6000815180845260005b818110156108f2576020818501810151868301820152016108d6565b81811115610904576000602083870101525b50601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0169290920160200192915050565b60208152600061071360208301846108cc565b60808152600061095d60808301876108cc565b73ffffffffffffffffffffffffffffffffffffffff959095166020830152506040810192909252606090910152919050565b600082198211156109a2576109a2610a12565b500190565b6000828210156109b9576109b9610a12565b500390565b600181811c908216806109d257607f821691505b60208210811415610a0c577f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b50919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fdfea264697066735822122045936a3e54f682db37c2cb9b0dadfd419ad23efeaf9584dc80235b1f722ff31764736f6c63430008060033";

type WETH9ConstructorParams =
  | [signer?: Signer]
  | ConstructorParameters<typeof ContractFactory>;

const isSuperArgs = (
  xs: WETH9ConstructorParams
): xs is ConstructorParameters<typeof ContractFactory> => xs.length > 1;

export class WETH9__factory extends ContractFactory {
  constructor(...args: WETH9ConstructorParams) {
    if (isSuperArgs(args)) {
      super(...args);
    } else {
      super(_abi, _bytecode, args[0]);
    }
  }

  deploy(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<WETH9> {
    return super.deploy(overrides || {}) as Promise<WETH9>;
  }
  getDeployTransaction(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  attach(address: string): WETH9 {
    return super.attach(address) as WETH9;
  }
  connect(signer: Signer): WETH9__factory {
    return super.connect(signer) as WETH9__factory;
  }
  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): WETH9Interface {
    return new utils.Interface(_abi) as WETH9Interface;
  }
  static connect(address: string, signerOrProvider: Signer | Provider): WETH9 {
    return new Contract(address, _abi, signerOrProvider) as WETH9;
  }
}
