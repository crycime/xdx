// SPDX-License-Identifier: MIT

pragma solidity >=0.8.3;
pragma abicoder v2;

import "../interfaces/IERC20.sol";

contract ERC20FixTransfer {
    function balanceOfMe(address token) internal view returns (uint256) {
        (bool success, bytes memory data) = token.staticcall(
            abi.encodeWithSelector(IERC20.balanceOf.selector, address(this))
        );
        require(success && data.length >= 32, "BN");
        return abi.decode(data, (uint256));
    }

    function balanceOfMsgSender(address token) internal view returns (uint256) {
        (bool success, bytes memory data) = token.staticcall(
            abi.encodeWithSelector(IERC20.balanceOf.selector, address(msg.sender))
        );
        require(success && data.length >= 32, "BN");
        return abi.decode(data, (uint256));
    }

    function fixTransfer(
        address token,
        address to,
        uint256 value
    ) internal {
        token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, uint256(value)));
    }
}
