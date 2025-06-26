import { ChainId, Currency, Token } from '@surge/sdk-core';
export declare const V3_CORE_FACTORY_ADDRESSES: AddressMap;
export declare const QUOTER_V2_ADDRESSES: AddressMap;
export declare const NEW_QUOTER_V2_ADDRESSES: AddressMap;
export declare const UNISWAP_MULTICALL_ADDRESSES: AddressMap;
export declare const SWAP_ROUTER_02_ADDRESSES: (chainId: number) => string;
export type AddressMap = {
    [chainId: number]: string | undefined;
};
export declare const WETH9: {
    [chainId in ChainId]?: Token;
};
export declare function getAddressLowerCase(currency: Currency): string;
export declare function getAddress(currency: Currency): string;
export declare const ARB_GASINFO_ADDRESS = "0x0000000000000000000000000000000000000067";
