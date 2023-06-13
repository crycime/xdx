// SPDX-License-Identifier: MIT

pragma solidity >=0.8.3;
pragma abicoder v2;

import './IStructs.sol';

interface IMulticall {
    function multicall(
        address pooladdr,
        PreCheckParams calldata checkparams,
        bytes[] calldata datas,
        address[] calldata addrs,
        int8[] calldata calltypes
    ) external payable returns (bytes[] memory results);

    function call(
        address pooladdr,
        PreCheckParams calldata checkparams,
        bytes calldata datas
    ) external payable returns (bytes memory results);

    // function multidelegatecall(
    //     address pooladdr,
    //     PreCheckParams calldata checkparams,
    //     bytes[] calldata datas,
    //     address[] calldata addrs
    // ) external payable returns (bytes[] memory results);
    // function delegatecall(
    //     address pooladdr,
    //     PreCheckParams calldata checkparams,
    //     bytes calldata datas
    // ) external payable returns (bytes memory results);
}
