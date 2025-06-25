import {
  ChainId,
  Currency,
  Ether,
  NativeCurrency,
  Token,
} from '@surge/sdk-core';

// WIP: Gnosis, Moonbeam
export const SUPPORTED_CHAINS: ChainId[] = [
  ChainId.XRPL_EVM_TESTNET,
  ChainId.ARBITRUM_SEPOLIA,
  // Gnosis and Moonbeam don't yet have contracts deployed yet
];

export const V2_SUPPORTED = [
  ChainId.XRPL_EVM_TESTNET,
];

export const HAS_L1_FEE = [
  ChainId.XRPL_EVM_TESTNET,
  ChainId.ARBITRUM_SEPOLIA,
];

export const NETWORKS_WITH_SAME_UNISWAP_ADDRESSES = [
  ChainId.XRPL_EVM_TESTNET,
];

export const ID_TO_CHAIN_ID = (id: number): ChainId => {
  switch (id) {
    case 1449000:
      return ChainId.XRPL_EVM_TESTNET;
    case 421614:
      return ChainId.ARBITRUM_SEPOLIA;
    default:
      throw new Error(`Unknown chain id: ${id}`);
  }
};

export enum ChainName {
  XRPL_EVM_TESTNET = 'xrpl-evm-sidechain-testnet',
  ARBITRUM_SEPOLIA = 'arbitrum-sepolia',
}

export enum NativeCurrencyName {
  // Strings match input for CLI
  ETHER = 'ETH',
  XRPL_EVM_TESTNET = 'XRP',
}

export const NATIVE_NAMES_BY_ID: { [chainId: number]: string[] } = {
  [ChainId.XRPL_EVM_TESTNET]: [
    'XRP',
    'RIPPLE',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  ],
  [ChainId.ARBITRUM_SEPOLIA]: [
    'ETH',
    'ETHER',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  ],
};

export const NATIVE_CURRENCY: { [chainId: number]: NativeCurrencyName } = {
  [ChainId.XRPL_EVM_TESTNET]: NativeCurrencyName.XRPL_EVM_TESTNET,
  [ChainId.ARBITRUM_SEPOLIA]: NativeCurrencyName.ETHER,
};

export const ID_TO_NETWORK_NAME = (id: number): ChainName => {
  switch (id) {
    case 1449000:
      return ChainName.XRPL_EVM_TESTNET;
    case 421614:
      return ChainName.ARBITRUM_SEPOLIA;
    default:
      throw new Error(`Unknown chain id: ${id}`);
  }
};

export const CHAIN_IDS_LIST = Object.values(ChainId).map((c) =>
  c.toString()
) as string[];

export const ID_TO_PROVIDER = (id: ChainId): string => {
  switch (id) {
    case ChainId.XRPL_EVM_TESTNET:
      return process.env.JSON_RPC_PROVIDER!;
    case ChainId.ARBITRUM_SEPOLIA:
      return process.env.JSON_RPC_PROVIDER_ARBITRUM_SEPOLIA!;
    default:
      throw new Error(`Chain id: ${id} not supported`);
  }
};

export const WRAPPED_NATIVE_CURRENCY: { [chainId in ChainId]: Token } = {
  [ChainId.XRPL_EVM_TESTNET]: new Token(
    1,
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    18,
    'WXRP',
    'Wrapped XRP'
  ),
  [ChainId.ARBITRUM_SEPOLIA]: new Token(
    ChainId.ARBITRUM_SEPOLIA,
    '0xc556bAe1e86B2aE9c22eA5E036b07E55E7596074',
    18,
    'WETH',
    'Wrapped Ether'
  ),
};

// function isMatic(
//   chainId: number
// ): chainId is ChainId.POLYGON | ChainId.POLYGON_MUMBAI {
//   return chainId === ChainId.POLYGON_MUMBAI || chainId === ChainId.POLYGON;
// }

// class MaticNativeCurrency extends NativeCurrency {
//   equals(other: Currency): boolean {
//     return other.isNative && other.chainId === this.chainId;
//   }

//   get wrapped(): Token {
//     if (!isMatic(this.chainId)) throw new Error('Not matic');
//     const nativeCurrency = WRAPPED_NATIVE_CURRENCY[this.chainId];
//     if (nativeCurrency) {
//       return nativeCurrency;
//     }
//     throw new Error(`Does not support this chain ${this.chainId}`);
//   }

//   public constructor(chainId: number) {
//     if (!isMatic(chainId)) throw new Error('Not matic');
//     super(chainId, 18, 'MATIC', 'Polygon Matic');
//   }
// }

// function isCelo(
//   chainId: number
// ): chainId is ChainId.CELO | ChainId.CELO_ALFAJORES {
//   return chainId === ChainId.CELO_ALFAJORES || chainId === ChainId.CELO;
// }

// class CeloNativeCurrency extends NativeCurrency {
//   equals(other: Currency): boolean {
//     return other.isNative && other.chainId === this.chainId;
//   }

//   get wrapped(): Token {
//     if (!isCelo(this.chainId)) throw new Error('Not celo');
//     const nativeCurrency = WRAPPED_NATIVE_CURRENCY[this.chainId];
//     if (nativeCurrency) {
//       return nativeCurrency;
//     }
//     throw new Error(`Does not support this chain ${this.chainId}`);
//   }

//   public constructor(chainId: number) {
//     if (!isCelo(chainId)) throw new Error('Not celo');
//     super(chainId, 18, 'CELO', 'Celo');
//   }
// }

// function isGnosis(chainId: number): chainId is ChainId.GNOSIS {
//   return chainId === ChainId.GNOSIS;
// }

// class GnosisNativeCurrency extends NativeCurrency {
//   equals(other: Currency): boolean {
//     return other.isNative && other.chainId === this.chainId;
//   }

//   get wrapped(): Token {
//     if (!isGnosis(this.chainId)) throw new Error('Not gnosis');
//     const nativeCurrency = WRAPPED_NATIVE_CURRENCY[this.chainId];
//     if (nativeCurrency) {
//       return nativeCurrency;
//     }
//     throw new Error(`Does not support this chain ${this.chainId}`);
//   }

//   public constructor(chainId: number) {
//     if (!isGnosis(chainId)) throw new Error('Not gnosis');
//     super(chainId, 18, 'XDAI', 'xDai');
//   }
// }

// function isBnb(chainId: number): chainId is ChainId.BNB {
//   return chainId === ChainId.BNB;
// }

// class BnbNativeCurrency extends NativeCurrency {
//   equals(other: Currency): boolean {
//     return other.isNative && other.chainId === this.chainId;
//   }

//   get wrapped(): Token {
//     if (!isBnb(this.chainId)) throw new Error('Not bnb');
//     const nativeCurrency = WRAPPED_NATIVE_CURRENCY[this.chainId];
//     if (nativeCurrency) {
//       return nativeCurrency;
//     }
//     throw new Error(`Does not support this chain ${this.chainId}`);
//   }

//   public constructor(chainId: number) {
//     if (!isBnb(chainId)) throw new Error('Not bnb');
//     super(chainId, 18, 'BNB', 'BNB');
//   }
// }

// function isMoonbeam(chainId: number): chainId is ChainId.MOONBEAM {
//   return chainId === ChainId.MOONBEAM;
// }

// class MoonbeamNativeCurrency extends NativeCurrency {
//   equals(other: Currency): boolean {
//     return other.isNative && other.chainId === this.chainId;
//   }

//   get wrapped(): Token {
//     if (!isMoonbeam(this.chainId)) throw new Error('Not moonbeam');
//     const nativeCurrency = WRAPPED_NATIVE_CURRENCY[this.chainId];
//     if (nativeCurrency) {
//       return nativeCurrency;
//     }
//     throw new Error(`Does not support this chain ${this.chainId}`);
//   }

//   public constructor(chainId: number) {
//     if (!isMoonbeam(chainId)) throw new Error('Not moonbeam');
//     super(chainId, 18, 'GLMR', 'Glimmer');
//   }
// }

// function isAvax(chainId: number): chainId is ChainId.AVALANCHE {
//   return chainId === ChainId.AVALANCHE;
// }

// class AvalancheNativeCurrency extends NativeCurrency {
//   equals(other: Currency): boolean {
//     return other.isNative && other.chainId === this.chainId;
//   }

//   get wrapped(): Token {
//     if (!isAvax(this.chainId)) throw new Error('Not avalanche');
//     const nativeCurrency = WRAPPED_NATIVE_CURRENCY[this.chainId];
//     if (nativeCurrency) {
//       return nativeCurrency;
//     }
//     throw new Error(`Does not support this chain ${this.chainId}`);
//   }

//   public constructor(chainId: number) {
//     if (!isAvax(chainId)) throw new Error('Not avalanche');
//     super(chainId, 18, 'AVAX', 'Avalanche');
//   }
// }

// export class ExtendedEther extends Ether {
//   public get wrapped(): Token {
//     if (this.chainId in WRAPPED_NATIVE_CURRENCY) {
//       return WRAPPED_NATIVE_CURRENCY[this.chainId as ChainId];
//     }
//     throw new Error('Unsupported chain ID');
//   }

//   private static _cachedExtendedEther: { [chainId: number]: NativeCurrency } =
//     {};

//   public static onChain(chainId: number): ExtendedEther {
//     return (
//       this._cachedExtendedEther[chainId] ??
//       (this._cachedExtendedEther[chainId] = new ExtendedEther(chainId))
//     );
//   }
// }

// const cachedNativeCurrency: { [chainId: number]: NativeCurrency } = {};

// export function nativeOnChain(chainId: number): NativeCurrency {
//   if (cachedNativeCurrency[chainId] != undefined) {
//     return cachedNativeCurrency[chainId]!;
//   }
//   if (isMatic(chainId)) {
//     cachedNativeCurrency[chainId] = new MaticNativeCurrency(chainId);
//   } else if (isCelo(chainId)) {
//     cachedNativeCurrency[chainId] = new CeloNativeCurrency(chainId);
//   } else if (isGnosis(chainId)) {
//     cachedNativeCurrency[chainId] = new GnosisNativeCurrency(chainId);
//   } else if (isMoonbeam(chainId)) {
//     cachedNativeCurrency[chainId] = new MoonbeamNativeCurrency(chainId);
//   } else if (isBnb(chainId)) {
//     cachedNativeCurrency[chainId] = new BnbNativeCurrency(chainId);
//   } else if (isAvax(chainId)) {
//     cachedNativeCurrency[chainId] = new AvalancheNativeCurrency(chainId);
//   } else {
//     cachedNativeCurrency[chainId] = ExtendedEther.onChain(chainId);
//   }

//   return cachedNativeCurrency[chainId]!;
// }
