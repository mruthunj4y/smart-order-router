import { ChainId, Token } from '@surge/sdk-core';
export declare const SUPPORTED_CHAINS: ChainId[];
export declare const V2_SUPPORTED: ChainId[];
export declare const HAS_L1_FEE: ChainId[];
export declare const NETWORKS_WITH_SAME_UNISWAP_ADDRESSES: ChainId[];
export declare const ID_TO_CHAIN_ID: (id: number) => ChainId;
export declare enum ChainName {
    XRPL_EVM_TESTNET = "xrpl-evm-sidechain-testnet",
    ARBITRUM_SEPOLIA = "arbitrum-sepolia"
}
export declare enum NativeCurrencyName {
    ETHER = "ETH",
    XRPL_EVM_TESTNET = "XRP"
}
export declare const NATIVE_NAMES_BY_ID: {
    [chainId: number]: string[];
};
export declare const NATIVE_CURRENCY: {
    [chainId: number]: NativeCurrencyName;
};
export declare const ID_TO_NETWORK_NAME: (id: number) => ChainName;
export declare const CHAIN_IDS_LIST: string[];
export declare const ID_TO_PROVIDER: (id: ChainId) => string;
export declare const WRAPPED_NATIVE_CURRENCY: {
    [chainId in ChainId]?: Token;
};
