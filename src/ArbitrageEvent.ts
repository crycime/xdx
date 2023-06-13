import { ethers, network, config, artifacts } from 'hardhat';

export let TrendingEvent = {
  TOPIC_ERC20_TRANSFER: ethers.utils.id('Transfer(address,address,uint256)'),
  TOPIC_UNISWAP_SYNC_V2: ethers.utils.id('Sync(uint112,uint112)'),
  TOPIC_UNISWAP_SWAP_V2: ethers.utils.id('Swap(address,uint256,uint256,uint256,uint256,address)'),
  TOPIC_UNISWAP_BURN_V2: ethers.utils.id('Burn(address,uint256,uint256,address)'),
  TOPIC_UNISWAP_MINT_V2: ethers.utils.id('Mint(address,uint256,uint256)'),
  TOPIC_UNISWAP_SWAP_V3: ethers.utils.id('Swap(address,address,int256,int256,uint160,uint128,int24)'),
  TOPIC_UNISWAP_BURN_V3: ethers.utils.id('Burn(address,int24,int24,uint128,uint256,uint256)'),
  TOPIC_UNISWAP_MINT_V3: ethers.utils.id('Mint(address,address,int24,int24,uint128,uint256,uint256)'),
  TOPIC_UNISWAP_FLASH_V3: ethers.utils.id('Flash(address,address,uint256,uint256,uint256,uint256)'),
  TOPIC_BALANCER_VALT_SWAP: ethers.utils.id('Swap(bytes32,address,address,uint256,uint256)'),
  TOPIC_BALANCER_VALT_SWAP_V1: ethers.utils.id('LOG_SWAP(address,address,address,uint256,uint256)'), //LOG_SWAP(index_topic_1addresscaller,index_topic_2addresstokenIn,index_topic_3addresstokenOut,uint256tokenAmountIn,uint256tokenAmountOut)
  TOPIC_BALANCER_VALT_BALANCE: ethers.utils.id('PoolBalanceChanged(bytes32,address,address[],int256,uint256[])'),
  TOPIC_BANCOR_SWAP_CONVERSION: ethers.utils.id('Conversion(address,address,address,uint256,uint256,address)'), //Conversion (index_topic_1 address _smartToken, index_topic_2 address _fromToken, index_topic_3 address _toToken, uint256 _fromAmount, uint256 _toAmount, address _trader)
  TOPIC_BANCOR_SWAP_CONVERSION_1: ethers.utils.id('Conversion(address,address,address,uint256,uint256,int256)'), //Conversion (index_topic_1 address _fromToken, index_topic_2 address _toToken, index_topic_3 address _trader, uint256 _amount, uint256 _return, int256 _conversionFee)
  TOPIC_BANCOR_PRICE_UPDATE: ethers.utils.id('PriceDataUpdate(address,uint256,uint256,uint32)'), //PriceDataUpdate(indexed address,uint256,uint256,uint32)
  TOPIC_CURVE_EXCHANGE: ethers.utils.id('TokenExchange(address,int128,uint256,int128,uint256)'), //TokenExchange(index_topic_1addressbuyer,int128sold_id,uint256tokens_sold,int128bought_id,uint256tokens_bought)
  TOPIC_CURVE_EXCHANGE_UNDERLYING: ethers.utils.id('TokenExchangeUnderlying(address,int128,uint256,int128,uint256)'), //TokenExchangeUnderlying (index_topic_1 address buyer, int128 sold_id, uint256 tokens_sold, int128 bought_id, uint256 tokens_bought)
};
