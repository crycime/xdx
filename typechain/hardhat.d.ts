/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { ethers } from "ethers";
import {
  FactoryOptions,
  HardhatEthersHelpers as HardhatEthersHelpersBase,
} from "@nomiclabs/hardhat-ethers/types";

import * as Contracts from ".";

declare module "hardhat/types/runtime" {
  interface HardhatEthersHelpers extends HardhatEthersHelpersBase {
    getContractFactory(
      name: "ArbitrageCall",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ArbitrageCall__factory>;
    getContractFactory(
      name: "I0XExchangeV3",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.I0XExchangeV3__factory>;
    getContractFactory(
      name: "IZeroxV4",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IZeroxV4__factory>;
    getContractFactory(
      name: "IBalancer",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IBalancer__factory>;
    getContractFactory(
      name: "IBalancerBasePool",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IBalancerBasePool__factory>;
    getContractFactory(
      name: "IBalancerV2Vault",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IBalancerV2Vault__factory>;
    getContractFactory(
      name: "IBancorNetwork",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IBancorNetwork__factory>;
    getContractFactory(
      name: "IBancoronverter",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IBancoronverter__factory>;
    getContractFactory(
      name: "ICurve",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ICurve__factory>;
    getContractFactory(
      name: "ICurveCalculator",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ICurveCalculator__factory>;
    getContractFactory(
      name: "ICurveRegistry",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ICurveRegistry__factory>;
    getContractFactory(
      name: "IERC20",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IERC20__factory>;
    getContractFactory(
      name: "IMulticall",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IMulticall__factory>;
    getContractFactory(
      name: "INonfungiblePositionManager",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.INonfungiblePositionManager__factory>;
    getContractFactory(
      name: "IPlaceOrder",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IPlaceOrder__factory>;
    getContractFactory(
      name: "ISwapRouter",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ISwapRouter__factory>;
    getContractFactory(
      name: "ITrendingCall",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ITrendingCall__factory>;
    getContractFactory(
      name: "IUniswapV2Pair",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IUniswapV2Pair__factory>;
    getContractFactory(
      name: "IUniswapV3Pool",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IUniswapV3Pool__factory>;
    getContractFactory(
      name: "IUniswapV3SwapCallback",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IUniswapV3SwapCallback__factory>;
    getContractFactory(
      name: "IWETH9",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IWETH9__factory>;
    getContractFactory(
      name: "IUniswapV3PoolActions",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IUniswapV3PoolActions__factory>;
    getContractFactory(
      name: "IUniswapV3PoolDerivedState",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IUniswapV3PoolDerivedState__factory>;
    getContractFactory(
      name: "IUniswapV3PoolEvents",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IUniswapV3PoolEvents__factory>;
    getContractFactory(
      name: "IUniswapV3PoolImmutables",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IUniswapV3PoolImmutables__factory>;
    getContractFactory(
      name: "IUniswapV3PoolOwnerActions",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IUniswapV3PoolOwnerActions__factory>;
    getContractFactory(
      name: "IUniswapV3PoolState",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IUniswapV3PoolState__factory>;
    getContractFactory(
      name: "AssetsManager",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.AssetsManager__factory>;
    getContractFactory(
      name: "PlaceOrder",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.PlaceOrder__factory>;
    getContractFactory(
      name: "WETH9",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.WETH9__factory>;
    getContractFactory(
      name: "IChiToken",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IChiToken__factory>;
    getContractFactory(
      name: "TrendingCall",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.TrendingCall__factory>;
    getContractFactory(
      name: "V3LiquidityBot",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.V3LiquidityBot__factory>;

    getContractAt(
      name: "ArbitrageCall",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ArbitrageCall>;
    getContractAt(
      name: "I0XExchangeV3",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.I0XExchangeV3>;
    getContractAt(
      name: "IZeroxV4",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IZeroxV4>;
    getContractAt(
      name: "IBalancer",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IBalancer>;
    getContractAt(
      name: "IBalancerBasePool",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IBalancerBasePool>;
    getContractAt(
      name: "IBalancerV2Vault",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IBalancerV2Vault>;
    getContractAt(
      name: "IBancorNetwork",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IBancorNetwork>;
    getContractAt(
      name: "IBancoronverter",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IBancoronverter>;
    getContractAt(
      name: "ICurve",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ICurve>;
    getContractAt(
      name: "ICurveCalculator",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ICurveCalculator>;
    getContractAt(
      name: "ICurveRegistry",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ICurveRegistry>;
    getContractAt(
      name: "IERC20",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IERC20>;
    getContractAt(
      name: "IMulticall",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IMulticall>;
    getContractAt(
      name: "INonfungiblePositionManager",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.INonfungiblePositionManager>;
    getContractAt(
      name: "IPlaceOrder",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IPlaceOrder>;
    getContractAt(
      name: "ISwapRouter",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ISwapRouter>;
    getContractAt(
      name: "ITrendingCall",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ITrendingCall>;
    getContractAt(
      name: "IUniswapV2Pair",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IUniswapV2Pair>;
    getContractAt(
      name: "IUniswapV3Pool",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IUniswapV3Pool>;
    getContractAt(
      name: "IUniswapV3SwapCallback",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IUniswapV3SwapCallback>;
    getContractAt(
      name: "IWETH9",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IWETH9>;
    getContractAt(
      name: "IUniswapV3PoolActions",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IUniswapV3PoolActions>;
    getContractAt(
      name: "IUniswapV3PoolDerivedState",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IUniswapV3PoolDerivedState>;
    getContractAt(
      name: "IUniswapV3PoolEvents",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IUniswapV3PoolEvents>;
    getContractAt(
      name: "IUniswapV3PoolImmutables",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IUniswapV3PoolImmutables>;
    getContractAt(
      name: "IUniswapV3PoolOwnerActions",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IUniswapV3PoolOwnerActions>;
    getContractAt(
      name: "IUniswapV3PoolState",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IUniswapV3PoolState>;
    getContractAt(
      name: "AssetsManager",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.AssetsManager>;
    getContractAt(
      name: "PlaceOrder",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.PlaceOrder>;
    getContractAt(
      name: "WETH9",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.WETH9>;
    getContractAt(
      name: "IChiToken",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IChiToken>;
    getContractAt(
      name: "TrendingCall",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.TrendingCall>;
    getContractAt(
      name: "V3LiquidityBot",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.V3LiquidityBot>;

    // default types
    getContractFactory(
      name: string,
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<ethers.ContractFactory>;
    getContractFactory(
      abi: any[],
      bytecode: ethers.utils.BytesLike,
      signer?: ethers.Signer
    ): Promise<ethers.ContractFactory>;
    getContractAt(
      nameOrAbi: string | any[],
      address: string,
      signer?: ethers.Signer
    ): Promise<ethers.Contract>;
  }
}
