/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import {
  BaseContract,
  BigNumber,
  BigNumberish,
  BytesLike,
  CallOverrides,
  ContractTransaction,
  Overrides,
  PayableOverrides,
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import { FunctionFragment, Result } from "@ethersproject/abi";
import { Listener, Provider } from "@ethersproject/providers";
import { TypedEventFilter, TypedEvent, TypedListener, OnEvent } from "./common";

export type PlaceOrderHeaderStruct = {
  dxType: BigNumberish;
  pathLen: BigNumberish;
  tokenStart: string;
  tokenEnd: string;
  volume: BigNumberish;
  volumeMinTo: BigNumberish;
  RKKgas: BigNumberish;
};

export type PlaceOrderHeaderStructOutput = [
  number,
  number,
  string,
  string,
  BigNumber,
  BigNumber,
  BigNumber
] & {
  dxType: number;
  pathLen: number;
  tokenStart: string;
  tokenEnd: string;
  volume: BigNumber;
  volumeMinTo: BigNumber;
  RKKgas: BigNumber;
};

export type PlaceOrderPathStruct = {
  dxType: BigNumberish;
  side: BigNumberish;
  fee: BigNumberish;
  feePrecision: BigNumberish;
  tick: BigNumberish;
  selectorDataBegin: BigNumberish;
  selectorDataLen: BigNumberish;
  maker: string;
  addr: string;
  tokenFrom: string;
  tokenTo: string;
  reserve0: BigNumberish;
  reserve1: BigNumberish;
  balanceFrom: BigNumberish;
  priceX96: BigNumberish;
  extData: BytesLike;
};

export type PlaceOrderPathStructOutput = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  string,
  string,
  string,
  string,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  string
] & {
  dxType: number;
  side: number;
  fee: number;
  feePrecision: number;
  tick: number;
  selectorDataBegin: number;
  selectorDataLen: number;
  maker: string;
  addr: string;
  tokenFrom: string;
  tokenTo: string;
  reserve0: BigNumber;
  reserve1: BigNumber;
  balanceFrom: BigNumber;
  priceX96: BigNumber;
  extData: string;
};

export type PlaceOrderInputStruct = {
  header: PlaceOrderHeaderStruct;
  path: PlaceOrderPathStruct[];
};

export type PlaceOrderInputStructOutput = [
  PlaceOrderHeaderStructOutput,
  PlaceOrderPathStructOutput[]
] & {
  header: PlaceOrderHeaderStructOutput;
  path: PlaceOrderPathStructOutput[];
};

export interface TrendingCallInterface extends utils.Interface {
  functions: {
    "approve(address,address,uint256)": FunctionFragment;
    "collect(address,uint256)": FunctionFragment;
    "deposit()": FunctionFragment;
    "getK(bytes)": FunctionFragment;
    "setWhitelist(address,bool)": FunctionFragment;
    "placeOrderCall(bytes,uint256,uint256)": FunctionFragment;
    "placeOrderCallDeadline(bytes,uint256)": FunctionFragment;
    "placeOrderCallMultiReturn(bytes[])": FunctionFragment;
    "placeOrderCallReturn(bytes)": FunctionFragment;
    "transferOwnership(address)": FunctionFragment;
  };

  encodeFunctionData(
    functionFragment: "approve",
    values: [string, string, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "collect",
    values: [string, BigNumberish]
  ): string;
  encodeFunctionData(functionFragment: "deposit", values?: undefined): string;
  encodeFunctionData(functionFragment: "getK", values: [BytesLike]): string;
  encodeFunctionData(
    functionFragment: "setWhitelist",
    values: [string, boolean]
  ): string;
  encodeFunctionData(
    functionFragment: "placeOrderCall",
    values: [BytesLike, BigNumberish, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "placeOrderCallDeadline",
    values: [BytesLike, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "placeOrderCallMultiReturn",
    values: [BytesLike[]]
  ): string;
  encodeFunctionData(
    functionFragment: "placeOrderCallReturn",
    values: [BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "transferOwnership",
    values: [string]
  ): string;

  decodeFunctionResult(functionFragment: "approve", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "collect", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "deposit", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "getK", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "setWhitelist",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "placeOrderCall", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "placeOrderCallDeadline",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "placeOrderCallMultiReturn",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "placeOrderCallReturn",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "transferOwnership",
    data: BytesLike
  ): Result;

  events: {};
}

export interface TrendingCall extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: TrendingCallInterface;

  queryFilter<TEvent extends TypedEvent>(
    event: TypedEventFilter<TEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TEvent>>;

  listeners<TEvent extends TypedEvent>(
    eventFilter?: TypedEventFilter<TEvent>
  ): Array<TypedListener<TEvent>>;
  listeners(eventName?: string): Array<Listener>;
  removeAllListeners<TEvent extends TypedEvent>(
    eventFilter: TypedEventFilter<TEvent>
  ): this;
  removeAllListeners(eventName?: string): this;
  off: OnEvent<this>;
  on: OnEvent<this>;
  once: OnEvent<this>;
  removeListener: OnEvent<this>;

  functions: {
    approve(
      token: string,
      spender: string,
      value: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    collect(
      token: string,
      wad: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    deposit(
      overrides?: PayableOverrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    getK(
      data: BytesLike,
      overrides?: CallOverrides
    ): Promise<
      [PlaceOrderInputStructOutput, BigNumber] & {
        arbdata: PlaceOrderInputStructOutput;
        V: BigNumber;
      }
    >;

    setWhitelist(
      addr: string,
      set: boolean,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    placeOrderCall(
      data: BytesLike,
      removeTokenId: BigNumberish,
      notional: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    placeOrderCallDeadline(
      data: BytesLike,
      deadlineBlock: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    placeOrderCallMultiReturn(
      datalist: BytesLike[],
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    placeOrderCallReturn(
      data: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    transferOwnership(
      newOwner: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;
  };

  approve(
    token: string,
    spender: string,
    value: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  collect(
    token: string,
    wad: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  deposit(
    overrides?: PayableOverrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  getK(
    data: BytesLike,
    overrides?: CallOverrides
  ): Promise<
    [PlaceOrderInputStructOutput, BigNumber] & {
      arbdata: PlaceOrderInputStructOutput;
      V: BigNumber;
    }
  >;

  setWhitelist(
    addr: string,
    set: boolean,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  placeOrderCall(
    data: BytesLike,
    removeTokenId: BigNumberish,
    notional: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  placeOrderCallDeadline(
    data: BytesLike,
    deadlineBlock: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  placeOrderCallMultiReturn(
    datalist: BytesLike[],
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  placeOrderCallReturn(
    data: BytesLike,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  transferOwnership(
    newOwner: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  callStatic: {
    approve(
      token: string,
      spender: string,
      value: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    collect(
      token: string,
      wad: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    deposit(overrides?: CallOverrides): Promise<void>;

    getK(
      data: BytesLike,
      overrides?: CallOverrides
    ): Promise<
      [PlaceOrderInputStructOutput, BigNumber] & {
        arbdata: PlaceOrderInputStructOutput;
        V: BigNumber;
      }
    >;

    setWhitelist(
      addr: string,
      set: boolean,
      overrides?: CallOverrides
    ): Promise<void>;

    placeOrderCall(
      data: BytesLike,
      removeTokenId: BigNumberish,
      notional: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    placeOrderCallDeadline(
      data: BytesLike,
      deadlineBlock: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    placeOrderCallMultiReturn(
      datalist: BytesLike[],
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    placeOrderCallReturn(
      data: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    transferOwnership(
      newOwner: string,
      overrides?: CallOverrides
    ): Promise<void>;
  };

  filters: {};

  estimateGas: {
    approve(
      token: string,
      spender: string,
      value: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    collect(
      token: string,
      wad: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    deposit(
      overrides?: PayableOverrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    getK(data: BytesLike, overrides?: CallOverrides): Promise<BigNumber>;

    setWhitelist(
      addr: string,
      set: boolean,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    placeOrderCall(
      data: BytesLike,
      removeTokenId: BigNumberish,
      notional: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    placeOrderCallDeadline(
      data: BytesLike,
      deadlineBlock: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    placeOrderCallMultiReturn(
      datalist: BytesLike[],
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    placeOrderCallReturn(
      data: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    transferOwnership(
      newOwner: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    approve(
      token: string,
      spender: string,
      value: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    collect(
      token: string,
      wad: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    deposit(
      overrides?: PayableOverrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    getK(
      data: BytesLike,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    setWhitelist(
      addr: string,
      set: boolean,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    placeOrderCall(
      data: BytesLike,
      removeTokenId: BigNumberish,
      notional: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    placeOrderCallDeadline(
      data: BytesLike,
      deadlineBlock: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    placeOrderCallMultiReturn(
      datalist: BytesLike[],
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    placeOrderCallReturn(
      data: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    transferOwnership(
      newOwner: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;
  };
}
