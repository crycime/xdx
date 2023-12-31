/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import {
  BaseContract,
  BigNumber,
  BytesLike,
  CallOverrides,
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import { FunctionFragment, Result } from "@ethersproject/abi";
import { Listener, Provider } from "@ethersproject/providers";
import { TypedEventFilter, TypedEvent, TypedListener, OnEvent } from "./common";

export interface ICurveRegistryInterface extends utils.Interface {
  functions: {
    "get_pool_info(address)": FunctionFragment;
  };

  encodeFunctionData(
    functionFragment: "get_pool_info",
    values: [string]
  ): string;

  decodeFunctionResult(
    functionFragment: "get_pool_info",
    data: BytesLike
  ): Result;

  events: {};
}

export interface ICurveRegistry extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: ICurveRegistryInterface;

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
    get_pool_info(
      pool: string,
      overrides?: CallOverrides
    ): Promise<
      [
        BigNumber[],
        BigNumber[],
        BigNumber[],
        BigNumber[],
        string,
        BigNumber,
        BigNumber
      ] & {
        balances: BigNumber[];
        underlying_balances: BigNumber[];
        decimals: BigNumber[];
        underlying_decimals: BigNumber[];
        lp_token: string;
        A: BigNumber;
        fee: BigNumber;
      }
    >;
  };

  get_pool_info(
    pool: string,
    overrides?: CallOverrides
  ): Promise<
    [
      BigNumber[],
      BigNumber[],
      BigNumber[],
      BigNumber[],
      string,
      BigNumber,
      BigNumber
    ] & {
      balances: BigNumber[];
      underlying_balances: BigNumber[];
      decimals: BigNumber[];
      underlying_decimals: BigNumber[];
      lp_token: string;
      A: BigNumber;
      fee: BigNumber;
    }
  >;

  callStatic: {
    get_pool_info(
      pool: string,
      overrides?: CallOverrides
    ): Promise<
      [
        BigNumber[],
        BigNumber[],
        BigNumber[],
        BigNumber[],
        string,
        BigNumber,
        BigNumber
      ] & {
        balances: BigNumber[];
        underlying_balances: BigNumber[];
        decimals: BigNumber[];
        underlying_decimals: BigNumber[];
        lp_token: string;
        A: BigNumber;
        fee: BigNumber;
      }
    >;
  };

  filters: {};

  estimateGas: {
    get_pool_info(pool: string, overrides?: CallOverrides): Promise<BigNumber>;
  };

  populateTransaction: {
    get_pool_info(
      pool: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;
  };
}
