// SPDX-License-Identifier: MIT

pragma solidity >=0.8.3;

// pragma abicoder v2;

import './IERC20.sol';

interface IBancorNetwork {
    function convertByPath(
        // IERC20[] calldata _path,
        address[] calldata _path,
        uint256 _amount,
        uint256 _minReturn,
        address _beneficiary,
        address _affiliateAccount,
        uint256 _affiliateFee
    ) external payable returns (uint256);
}

interface IBancoronverter {
    function token() external view returns (address);

    function reserveBalance(address _reserveToken) external view returns (uint256);
}
