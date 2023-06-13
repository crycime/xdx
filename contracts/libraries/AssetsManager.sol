// SPDX-License-Identifier: MIT

pragma solidity >=0.8.3;
pragma abicoder v2;

import "../interfaces/IERC20.sol";
import "../interfaces/IWETH9.sol";
import "./ERC20FixTransfer.sol";

// import 'hardhat/console.sol';

contract AssetsManager is ERC20FixTransfer {
    //合约拥有者
    address internal _owner;
    //资产拥有者
    address private _assetsManager;
    mapping(address => bool) private _whitelist;
    address private constant WETH_ADDRESS = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2; //本链原生币

    constructor(address assetsManager_) {
        _owner = msg.sender;
        if (assetsManager_ == address(0)) {
            _assetsManager = _owner;
        } else {
            _assetsManager = assetsManager_;
        }
        _whitelist[_owner] = true;
        _whitelist[_assetsManager] = true;
    }

    modifier onlyOwner() {
        require(_owner == msg.sender, "O");
        _;
    }

    modifier onlyAssetsManager() {
        require(_assetsManager == msg.sender, "A");
        _;
    }

    //可以最后再检查是否白名单,节省gas
    modifier onlyWhitelist() {
        _;
        require(_whitelist[msg.sender] == true, "W");
    }

    //提款只能owner
    function collect(address token, uint256 wad) public {
        //允许白名单用户给owner提币
        if (checkWhiteList(msg.sender)) {
            if (token == address(0)) {
                payable(_assetsManager).transfer(wad);
            } else {
                fixTransfer(token, _assetsManager, wad);
            }
        }
    }

    //存款谁都可以,不限制
    function deposit() public payable {
        if (msg.value > 0) {
            IWETH9(WETH_ADDRESS).deposit{ value: msg.value }();
        } else {
            IWETH9(WETH_ADDRESS).deposit{ value: address(this).balance }();
        }
    }

    //授权,可以给合约使用某个币,这样可以不用每次授权
    //这个接口约assetsManager有冲突,随后考虑
    function approve(
        address token,
        address spender,
        uint256 value
    ) external onlyOwner {
        IERC20(token).approve(spender, value);
    }

    //转移owner,只有自己可以转自己
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner != address(0)) {
            _owner = newOwner;
        }
    }

    //转移assetsManager,只有自己可以转自己,owner也不能转,确保安全
    function transferAssetsManager(address newAssetsManager) external onlyAssetsManager {
        if (newAssetsManager != address(0)) {
            _assetsManager = newAssetsManager;
        }
    }

    //设置或者取消白名单
    function setWhitelist(address addr, bool set) public onlyOwner {
        _whitelist[addr] = set;
    }

    //检查是否为白名单用户
    function checkWhiteList(address addr) internal view returns (bool) {
        return _whitelist[addr];
    }

    //查看owner
    function owner() public view onlyWhitelist returns (address) {
        return _owner;
    }

    //查看assetsManager
    function assetsManager() public view onlyWhitelist returns (address) {
        return _assetsManager;
    }

    //查看白名单
    function whitelist(address addr) public view onlyWhitelist returns (bool) {
        return _whitelist[addr];
    }
}
