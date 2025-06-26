import { ChainId, Token } from '@surge/sdk-core';
type ChainTokenList = {
    readonly [chainId in ChainId]: Token[];
};
export declare const BASES_TO_CHECK_TRADES_AGAINST: () => ChainTokenList;
export declare const ADDITIONAL_BASES: () => Promise<{
    1449000?: {
        [tokenAddress: string]: Token[];
    } | undefined;
    421614?: {
        [tokenAddress: string]: Token[];
    } | undefined;
}>;
/**
 * Some tokens can only be swapped via certain pairs, so we override the list of bases that are considered for these
 * tokens.
 */
export declare const CUSTOM_BASES: () => Promise<{
    1449000?: {
        [tokenAddress: string]: Token[];
    } | undefined;
    421614?: {
        [tokenAddress: string]: Token[];
    } | undefined;
}>;
export {};
