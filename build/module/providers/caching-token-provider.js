import { ChainId } from '@surge/sdk-core';
import _ from 'lodash';
import { log } from '../util';
import { AVAX_XRPL_EVM_TESTNET, AXL_XRPL_EVM_TESTNET, BNB_XRPL_EVM_TESTNET, DAI_ARBITRUM_SEPOLIA, DAI_XRPL_EVM_TESTNET, MATIC_XRPL_EVM_TESTNET, RLUSD_XRPL_EVM_TESTNET, SOL_XRPL_EVM_TESTNET, TON_XRPL_EVM_TESTNET, TRON_XRPL_EVM_TESTNET, USDC_ARBITRUM_SEPOLIA, USDC_XRPL_EVM_TESTNET, USDT_XRPL_EVM_TESTNET, WETH_XRPL_EVM_TESTNET, } from './token-provider';
// These tokens will added to the Token cache on initialization.
export const CACHE_SEED_TOKENS = {
    [ChainId.XRPL_EVM_TESTNET]: {
        WETH_XRPL_EVM_TESTNET,
        DAI_XRPL_EVM_TESTNET,
        TON_XRPL_EVM_TESTNET,
        TRON_XRPL_EVM_TESTNET,
        SOL_XRPL_EVM_TESTNET,
        USDC_XRPL_EVM_TESTNET,
        RLUSD_XRPL_EVM_TESTNET,
        MATIC_XRPL_EVM_TESTNET,
        AXL_XRPL_EVM_TESTNET,
        AVAX_XRPL_EVM_TESTNET,
        USDT_XRPL_EVM_TESTNET,
        BNB_XRPL_EVM_TESTNET,
    },
    [ChainId.ARBITRUM_SEPOLIA]: {
        USDC: USDC_ARBITRUM_SEPOLIA,
        DAI: DAI_ARBITRUM_SEPOLIA,
    },
};
/**
 * Provider for getting token metadata that falls back to a different provider
 * in the event of failure.
 *
 * @export
 * @class CachingTokenProviderWithFallback
 */
export class CachingTokenProviderWithFallback {
    constructor(chainId, 
    // Token metadata (e.g. symbol and decimals) don't change so can be cached indefinitely.
    // Constructing a new token object is slow as sdk-core does checksumming.
    tokenCache, primaryTokenProvider, fallbackTokenProvider) {
        this.chainId = chainId;
        this.tokenCache = tokenCache;
        this.primaryTokenProvider = primaryTokenProvider;
        this.fallbackTokenProvider = fallbackTokenProvider;
        this.CACHE_KEY = (chainId, address) => `token-${chainId}-${address}`;
    }
    async getTokens(_addresses) {
        const seedTokens = CACHE_SEED_TOKENS[this.chainId];
        if (seedTokens) {
            for (const token of Object.values(seedTokens)) {
                await this.tokenCache.set(this.CACHE_KEY(this.chainId, token.address.toLowerCase()), token);
            }
        }
        const addressToToken = {};
        const symbolToToken = {};
        const addresses = _(_addresses)
            .map((address) => address.toLowerCase())
            .uniq()
            .value();
        const addressesToFindInPrimary = [];
        const addressesToFindInSecondary = [];
        for (const address of addresses) {
            if (await this.tokenCache.has(this.CACHE_KEY(this.chainId, address))) {
                const cachedToken = await this.tokenCache.get(this.CACHE_KEY(this.chainId, address));
                if (cachedToken) {
                    addressToToken[address.toLowerCase()] = cachedToken;
                    if (cachedToken.symbol) {
                        symbolToToken[cachedToken.symbol] = cachedToken;
                    }
                }
            }
            else {
                addressesToFindInPrimary.push(address);
            }
        }
        log.info({ addressesToFindInPrimary }, `Found ${addresses.length - addressesToFindInPrimary.length} out of ${addresses.length} tokens in local cache. ${addressesToFindInPrimary.length > 0
            ? `Checking primary token provider for ${addressesToFindInPrimary.length} tokens`
            : ``}
      `);
        if (addressesToFindInPrimary.length > 0) {
            const primaryTokenAccessor = await this.primaryTokenProvider.getTokens(addressesToFindInPrimary);
            for (const address of addressesToFindInPrimary) {
                const token = primaryTokenAccessor.getTokenByAddress(address);
                if (token) {
                    addressToToken[address.toLowerCase()] = token;
                    if (token.symbol) {
                        symbolToToken[token.symbol] = token;
                    }
                    await this.tokenCache.set(this.CACHE_KEY(this.chainId, address.toLowerCase()), token);
                }
                else {
                    addressesToFindInSecondary.push(address);
                }
            }
            log.info({ addressesToFindInSecondary }, `Found ${addressesToFindInPrimary.length - addressesToFindInSecondary.length} tokens in primary. ${this.fallbackTokenProvider
                ? `Checking secondary token provider for ${addressesToFindInSecondary.length} tokens`
                : `No fallback token provider specified. About to return.`}`);
        }
        if (this.fallbackTokenProvider && addressesToFindInSecondary.length > 0) {
            const secondaryTokenAccessor = await this.fallbackTokenProvider.getTokens(addressesToFindInSecondary);
            for (const address of addressesToFindInSecondary) {
                const token = secondaryTokenAccessor.getTokenByAddress(address);
                if (token) {
                    addressToToken[address.toLowerCase()] = token;
                    if (token.symbol) {
                        symbolToToken[token.symbol] = token;
                    }
                    await this.tokenCache.set(this.CACHE_KEY(this.chainId, address.toLowerCase()), token);
                }
            }
        }
        return {
            getTokenByAddress: (address) => {
                return addressToToken[address.toLowerCase()];
            },
            getTokenBySymbol: (symbol) => {
                return symbolToToken[symbol.toLowerCase()];
            },
            getAllTokens: () => {
                return Object.values(addressToToken);
            },
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FjaGluZy10b2tlbi1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9wcm92aWRlcnMvY2FjaGluZy10b2tlbi1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0saUJBQWlCLENBQUM7QUFDakQsT0FBTyxDQUFDLE1BQU0sUUFBUSxDQUFDO0FBRXZCLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxTQUFTLENBQUM7QUFHOUIsT0FBTyxFQUNMLHFCQUFxQixFQUNyQixvQkFBb0IsRUFDcEIsb0JBQW9CLEVBQ3BCLG9CQUFvQixFQUNwQixvQkFBb0IsRUFFcEIsc0JBQXNCLEVBQ3RCLHNCQUFzQixFQUN0QixvQkFBb0IsRUFFcEIsb0JBQW9CLEVBQ3BCLHFCQUFxQixFQUNyQixxQkFBcUIsRUFDckIscUJBQXFCLEVBQ3JCLHFCQUFxQixFQUNyQixxQkFBcUIsR0FDdEIsTUFBTSxrQkFBa0IsQ0FBQztBQUUxQixnRUFBZ0U7QUFDaEUsTUFBTSxDQUFDLE1BQU0saUJBQWlCLEdBRTFCO0lBQ0YsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtRQUMxQixxQkFBcUI7UUFDckIsb0JBQW9CO1FBQ3BCLG9CQUFvQjtRQUNwQixxQkFBcUI7UUFDckIsb0JBQW9CO1FBQ3BCLHFCQUFxQjtRQUNyQixzQkFBc0I7UUFDdEIsc0JBQXNCO1FBQ3RCLG9CQUFvQjtRQUNwQixxQkFBcUI7UUFDckIscUJBQXFCO1FBQ3JCLG9CQUFvQjtLQUNyQjtJQUNELENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLEVBQUU7UUFDMUIsSUFBSSxFQUFFLHFCQUFxQjtRQUMzQixHQUFHLEVBQUUsb0JBQW9CO0tBQzFCO0NBQ0YsQ0FBQztBQUVGOzs7Ozs7R0FNRztBQUNILE1BQU0sT0FBTyxnQ0FBZ0M7SUFJM0MsWUFDWSxPQUFnQjtJQUMxQix3RkFBd0Y7SUFDeEYseUVB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