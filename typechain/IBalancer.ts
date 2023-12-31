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
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import { FunctionFragment, Result } from "@ethersproject/abi";
import { Listener, Provider } from "@ethersproject/providers";
import { TypedEventFilter, TypedEvent, TypedListener, OnEvent } from "./common";

export interface IBalancerInterface extends utils.Interface {
  functions: {
    "getBalance(address)": FunctionFragment;
    "getSpotPrice(address,address)": FunctionFragment;
    "swapExactAmountIn(address,uint256,address,uint256,uint256)": FunctionFragment;
  };

  encodeFunctionData(functionFragment: "getBalance", values: [string]): string;
  encodeFunctionData(
    functionFragment: "getSpotPrice",
    values: [string, string]
  ): string;
  encodeFunctionData(
    functionFragment: "swapExactAmountIn",
    values: [string, BigNumberish, string, BigNumberish, BigNumberish]
  ): string;

  decodeFunctionResult(functionFragment: "getBalance", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "getSpotPrice",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "swapExactAmountIn",
    data: BytesLike
  ): Result;

  events: {};
}

export interface IBalancer extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: IBalancerInterface;

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
    getBalance(token: string, overrides?: CallOverrides): Promise<[BigNumber]>;

    getSpotPrice(
      tokenIn: string,
      tokenOut: string,
      overrides?: CallOverrides
    ): Promise<[BigNumber] & { spotPrice: BigNumber }>;

    swapExactAmountIn(
      tokenIn: string,
      tokenAmountIn: BigNumberish,
      tokenOut: string,
      minAmountOut: BigNumberish,
      maxPrice: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;
  };

  getBalance(token: string, overrides?: CallOverrides): Promise<BigNumber>;

  getSpotPrice(
    tokenIn: string,
    tokenOut: string,
    overrides?: CallOverrides
  ): Promise<BigNumber>;

  swapExactAmountIn(
    tokenIn: string,
    tokenAmountIn: BigNumberish,
    tokenOut: string,
    minAmountOut: BigNumberish,
    maxPrice: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  callStatic: {
    getBalance(token: string, overrides?: CallOverrides): Promise<BigNumber>;

    getSpotPrice(
      tokenIn: string,
      tokenOut: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    swapExactAmountIn(
      tokenIn: string,
      tokenAmountIn: BigNumberish,
      tokenOut: string,
      minAmountOut: BigNumberish,
      maxPrice: BigNumberish,
      overrides?: CallOverrides
    ): Promise<
      [BigNumber, BigNumber] & {
        tokenAmountOut: BigNumber;
        spotPriceAfter: BigNumber;
      }
    >;
  };

  filters: {};

  estimateGas: {
    getBalance(token: string, overrides?: CallOverrides): Promise<BigNumber>;

    getSpotPrice(
      tokenIn: string,
      tokenOut: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    swapExactAmountIn(
      tokenIn: string,
      tokenAmountIn: BigNumberish,
      tokenOut: string,
      minAmountOut: BigNumberish,
      maxPrice: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    getBalance(
      token: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getSpotPrice(
      tokenIn: string,
      tokenOut: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    swapExactAmountIn(
      tokenIn: string,
      tokenAmountIn: BigNumberish,
      tokenOut: string,
      minAmountOut: BigNumberish,
      maxPrice: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;
  };
}
