// SPDX-License-Identifier: MIT

pragma solidity >=0.8.3;
pragma abicoder v2;

import "./interfaces/IBancorNetwork.sol";
import "./interfaces/ITrendingCall.sol";
import "./interfaces/IPlaceOrder.sol";
import "./libraries/AssetsManager.sol";

// import 'hardhat/console.sol';

interface IChiToken {
    function freeFromUpTo(address from, uint256 value) external returns (uint256);
}

contract TrendingCall is AssetsManager, ITrendingCall {
    //省gas
    IChiToken private _chi;
    //下单合约
    IPlaceOrder private _placeOrder;
    //当前正在调用的下单合约,为了安全存储下
    address private _currentPlaceOrder;

    //交易对信息,支持多账号和多币种下单
    PairBaseData[] private _pairList;

    constructor(address assetsManager, IPlaceOrder placeOrder) AssetsManager(assetsManager) {
        _placeOrder = placeOrder;
        _chi = IChiToken(0x0000000000004946c0e9F43F4Dee607b0eF1fA1c);
        // setWhitelist(msg.sender, true); //BOBO-00-TRENDING-POLYGON-GAS 0x7f6B68A532c5E8E92C705A031cb5f872Cc4ADFF9 在底层加入了
        setWhitelist(0xf1270B16aFC4551A09B0DB971a60E48A7be015b8, true); //BO-01-TRENDING-POLYGON-GAS
        setWhitelist(0xe2Ec577976Af7DeB30cF4880cafFc1F4b219E564, true); //BO-02-TRENDING-POLYGON-GAS
        setWhitelist(0xb99daf98C7Fec8330604a9A4463bbaD04800b013, true); //BO-03-TRENDING-POLYGON-GAS
        //默认初始化5个池子
        for (uint256 index = 0; index < 10; index++) {
            PairBaseData memory pairInfo = PairBaseData({ pairId: uint8(index), nonce: 0, position0: 0, position1: 0 });
            _pairList.push(pairInfo);
        }
    }

    fallback() external payable {}

    // receive() external payable {}

    function getPairList() public view onlyWhitelist returns (PairBaseData[] memory pools) {
        return _pairList;
    }

    function addPairList(PairBaseData[] calldata pools) public onlyWhitelist {
        for (uint256 index = 0; index < pools.length; index++) {
            _pairList.push(pools[index]);
        }
    }

    function updatePairData(
        uint32 oldNonce,
        int112 oldPosition0,
        PairBaseData calldata newPair
    ) public onlyWhitelist {
        PairBaseData storage pairInfo = _pairList[newPair.pairId];
        require(pairInfo.nonce == oldNonce && pairInfo.position0 == oldPosition0, "U");
        _pairList[newPair.pairId] = newPair;
    }

    //用Chi节省gas
    modifier discountCHI() {
        uint256 gasStart = gasleft();
        _;
        uint256 gasSpent = 21000 + gasStart - gasleft() + 16 * msg.data.length;
        _chi.freeFromUpTo(msg.sender, (gasSpent + 14154) / 41947 + 1);
    }

    //设置下单合约,暂时让白名单用户可操作,方便调试
    function setPlaceOrder(IPlaceOrder placeOrder) external onlyWhitelist {
        _placeOrder = placeOrder;
    }

    //用区块刹车
    function placeOrderCallDeadlineBlock(
        bytes calldata data,
        uint8 pairId,
        uint32 inputNonce,
        uint256 deadlineBlock
    ) external onlyWhitelist {
        if (block.number > deadlineBlock) {
            return;
        }
        placeOrderCall(pairId, inputNonce, data);
    }

    //用区块刹车使用Chi
    function placeOrderCallDeadlineBlockChi(
        bytes calldata data,
        uint8 pairId,
        uint32 inputNonce,
        uint256 deadlineBlock
    ) external discountCHI onlyWhitelist {
        if (block.number > deadlineBlock) {
            return;
        }
        placeOrderCall(pairId, inputNonce, data);
    }

    //用时间刹车
    function placeOrderCallDeadlineTime(
        bytes calldata data,
        uint8 pairId,
        uint32 inputNonce,
        uint256 deadlineTime
    ) external onlyWhitelist {
        if (block.timestamp > deadlineTime) {
            return;
        }
        placeOrderCall(pairId, inputNonce, data);
    }

    //用时间刹车使用Chi
    function placeOrderCallDeadlineTimeChi(
        bytes calldata data,
        uint8 pairId,
        uint32 inputNonce,
        uint256 deadlineTime
    ) external discountCHI onlyWhitelist {
        if (block.timestamp > deadlineTime) {
            return;
        }
        placeOrderCall(pairId, inputNonce, data);
    }

    //用区块和时间刹车
    function placeOrderCallDeadlineBlockAndTime(
        bytes calldata data,
        uint8 pairId,
        uint32 inputNonce,
        uint256 deadlineBlock,
        uint256 deadlineTime
    ) external onlyWhitelist {
        if (block.timestamp > deadlineTime && block.number > deadlineBlock) {
            return;
        }
        placeOrderCall(pairId, inputNonce, data);
    }

    //用区块和时间刹车使用Chi
    function placeOrderCallDeadlineBlockAndTimeChi(
        bytes calldata data,
        uint8 pairId,
        uint32 inputNonce,
        uint256 deadlineBlock,
        uint256 deadlineTime
    ) external discountCHI onlyWhitelist {
        if (block.timestamp > deadlineTime && block.number > deadlineBlock) {
            return;
        }
        placeOrderCall(pairId, inputNonce, data);
    }

    //这个函数不做亏损检查,只能用来做模拟计算
    function placeOrderCallReturn(bytes calldata data) public onlyWhitelist returns (int256 amount0, int256 amount1) {
        _currentPlaceOrder = address(_placeOrder);
        (amount0, amount1) = _placeOrder.placeOrderCallReturn(data);
        _currentPlaceOrder = address(0);
        // (bool success, bytes memory resultData) = address(_placeOrder).delegatecall(
        //     abi.encodeWithSelector(_placeOrder.placeOrderCallReturn.selector, data)
        // );
        // if (success) {
        //     volume = abi.decode(resultData, (uint256));
        // }
    }

    function getInputData(bytes calldata data) public view returns (PlaceOrderInput memory orderInput) {
        return _placeOrder.getInputData(data);
    }

    function placeOrderCall(
        uint8 pairId,
        uint32 inputNonce,
        bytes calldata data
    ) private {
        //如果指定了nonce,并且当前系统已经大于这个nonce则舍弃
        //如果nonce过期就什么都不做
        if (inputNonce > 0) {
            PairBaseData storage pairInfo = _pairList[pairId];
            if (pairInfo.nonce >= inputNonce) {
                return;
            }
            pairInfo.nonce = inputNonce;
            _currentPlaceOrder = address(_placeOrder);
            (int256 amount0, int256 amount1) = _placeOrder.placeOrderCall(data);
            _currentPlaceOrder = address(0);
            pairInfo.position0 += int112(int256(amount0));
            pairInfo.position1 += int112(int256(amount1));
        } else {
            _currentPlaceOrder = address(_placeOrder);
            _placeOrder.placeOrderCall(data);
            _currentPlaceOrder = address(0);
        }
        // address(_placeOrder).delegatecall(abi.encodeWithSelector(_placeOrder.placeOrderCall.selector, data));
    }

    function placeOrderFixTransfer(
        address token,
        address to,
        uint256 value
    ) public override {
        require(_currentPlaceOrder == msg.sender, "P");
        fixTransfer(token, to, value);
    }

    //授权,可以给合约使用某个币,这样可以不用每次授权
    //这个接口约assetsManager有冲突,随后考虑
    function placeOrderApprove(
        address token,
        address spender,
        uint256 value
    ) public override {
        require(_currentPlaceOrder == msg.sender, "P");
        IERC20(token).approve(spender, value);
    }
}
