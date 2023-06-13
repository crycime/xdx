[
  {
    inputs: [
      { internalType: 'contract IBridgeAdapter', name: 'bridgeAdapter_', type: 'address' },
      { internalType: 'contract INativeOrdersFeature', name: 'zeroEx_', type: 'address' },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: 'bytes32', name: 'orderHash', type: 'bytes32' }],
    name: 'ProtocolFeeUnfunded',
    type: 'event',
  },
  {
    inputs: [],
    name: 'bridgeAdapter',
    outputs: [{ internalType: 'contract IBridgeAdapter', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'deployer',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address payable', name: 'ethRecipient', type: 'address' }],
    name: 'die',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address payable', name: 'sender', type: 'address' },
          { internalType: 'address payable', name: 'recipient', type: 'address' },
          { internalType: 'bytes', name: 'data', type: 'bytes' },
        ],
        internalType: 'struct IERC20Transformer.TransformContext',
        name: 'context',
        type: 'tuple',
      },
    ],
    name: 'transform',
    outputs: [{ internalType: 'bytes4', name: 'magicBytes', type: 'bytes4' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'zeroEx',
    outputs: [{ internalType: 'contract INativeOrdersFeature', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];
