"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CachingTokenProviderWithFallback = exports.CACHE_SEED_TOKENS = void 0;
const sdk_core_1 = require("@surge/sdk-core");
const lodash_1 = __importDefault(require("lodash"));
const util_1 = require("../util");
const token_provider_1 = require("./token-provider");
// These tokens will added to the Token cache on initialization.
exports.CACHE_SEED_TOKENS = {
    [sdk_core_1.ChainId.XRPL_EVM_TESTNET]: {
        WETH_XRPL_EVM_TESTNET: token_provider_1.WETH_XRPL_EVM_TESTNET,
        DAI_XRPL_EVM_TESTNET: token_provider_1.DAI_XRPL_EVM_TESTNET,
        TON_XRPL_EVM_TESTNET: token_provider_1.TON_XRPL_EVM_TESTNET,
        TRON_XRPL_EVM_TESTNET: token_provider_1.TRON_XRPL_EVM_TESTNET,
        SOL_XRPL_EVM_TESTNET: token_provider_1.SOL_XRPL_EVM_TESTNET,
        USDC_XRPL_EVM_TESTNET: token_provider_1.USDC_XRPL_EVM_TESTNET,
        RLUSD_XRPL_EVM_TESTNET: token_provider_1.RLUSD_XRPL_EVM_TESTNET,
        MATIC_XRPL_EVM_TESTNET: token_provider_1.MATIC_XRPL_EVM_TESTNET,
        AXL_XRPL_EVM_TESTNET: token_provider_1.AXL_XRPL_EVM_TESTNET,
        AVAX_XRPL_EVM_TESTNET: token_provider_1.AVAX_XRPL_EVM_TESTNET,
        USDT_XRPL_EVM_TESTNET: token_provider_1.USDT_XRPL_EVM_TESTNET,
        BNB_XRPL_EVM_TESTNET: token_provider_1.BNB_XRPL_EVM_TESTNET,
    },
    [sdk_core_1.ChainId.ARBITRUM_SEPOLIA]: {
        USDC: token_provider_1.USDC_ARBITRUM_SEPOLIA,
        DAI: token_provider_1.DAI_ARBITRUM_SEPOLIA,
    },
};
/**
 * Provider for getting token metadata that falls back to a different provider
 * in the event of failure.
 *
 * @export
 * @class CachingTokenProviderWithFallback
 */
class CachingTokenProviderWithFallback {
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
        const seedTokens = exports.CACHE_SEED_TOKENS[this.chainId];
        if (seedTokens) {
            for (const token of Object.values(seedTokens)) {
                await this.tokenCache.set(this.CACHE_KEY(this.chainId, token.address.toLowerCase()), token);
            }
        }
        const addressToToken = {};
        const symbolToToken = {};
        const addresses = (0, lodash_1.default)(_addresses)
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
        util_1.log.info({ addressesToFindInPrimary }, `Found ${addresses.length - addressesToFindInPrimary.length} out of ${addresses.length} tokens in local cache. ${addressesToFindInPrimary.length > 0
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
            util_1.log.info({ addressesToFindInSecondary }, `Found ${addressesToFindInPrimary.length - addressesToFindInSecondary.length} tokens in primary. ${this.fallbackTokenProvider
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
exports.CachingTokenProviderWithFallback = CachingTokenProviderWithFallback;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FjaGluZy10b2tlbi1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9wcm92aWRlcnMvY2FjaGluZy10b2tlbi1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSw4Q0FBaUQ7QUFDakQsb0RBQXVCO0FBRXZCLGtDQUE4QjtBQUc5QixxREFpQjBCO0FBRTFCLGdFQUFnRTtBQUNuRCxRQUFBLGlCQUFpQixHQUUxQjtJQUNGLENBQUMsa0JBQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO1FBQzFCLHFCQUFxQixFQUFyQixzQ0FBcUI7UUFDckIsb0JBQW9CLEVBQXBCLHFDQUFvQjtRQUNwQixvQkFBb0IsRUFBcEIscUNBQW9CO1FBQ3BCLHFCQUFxQixFQUFyQixzQ0FBcUI7UUFDckIsb0JBQW9CLEVBQXBCLHFDQUFvQjtRQUNwQixxQkFBcUIsRUFBckIsc0NBQXFCO1FBQ3JCLHNCQUFzQixFQUF0Qix1Q0FBc0I7UUFDdEIsc0JBQXNCLEVBQXRCLHVDQUFzQjtRQUN0QixvQkFBb0IsRUFBcEIscUNBQW9CO1FBQ3BCLHFCQUFxQixFQUFyQixzQ0FBcUI7UUFDckIscUJBQXFCLEVBQXJCLHNDQUFxQjtRQUNyQixvQkFBb0IsRUFBcEIscUNBQW9CO0tBQ3JCO0lBQ0QsQ0FBQyxrQkFBTyxDQUFDLGdCQUFnQixDQUFDLEVBQUU7UUFDMUIsSUFBSSxFQUFFLHNDQUFxQjtRQUMzQixHQUFHLEVBQUUscUNBQW9CO0tBQzFCO0NBQ0YsQ0FBQztBQUVGOzs7Ozs7R0FNRztBQUNILE1BQWEsZ0NBQWdDO0lBSTNDLFlBQ1ksT0FBZ0I7SUFDMUIsd0ZBQXdGO0lBQ3hGLHlFQUF5RTtJQUNqRSxVQUF5QixFQUN2QixvQkFBb0MsRUFDcEMscUJBQXNDO1FBTHRDLFlBQU8sR0FBUCxPQUFPLENBQVM7UUFHbEIsZUFBVSxHQUFWLFVBQVUsQ0FBZTtRQUN2Qix5QkFBb0IsR0FBcEIsb0JBQW9CLENBQWdCO1FBQ3BDLDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBaUI7UUFUMUMsY0FBUyxHQUFHLENBQUMsT0FBZ0IsRUFBRSxPQUFlLEVBQUUsRUFBRSxDQUN4RCxTQUFTLE9BQU8sSUFBSSxPQUFPLEVBQUUsQ0FBQztJQVM1QixDQUFDO0lBRUUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxVQUFvQjtRQUN6QyxNQUFNLFVBQVUsR0FBRyx5QkFBaUIsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFbkQsSUFBSSxVQUFVLEVBQUU7WUFDZCxLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLEVBQUU7Z0JBQzdDLE1BQU0sSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQ3ZCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLEVBQ3pELEtBQUssQ0FDTixDQUFDO2FBQ0g7U0FDRjtRQUVELE1BQU0sY0FBYyxHQUFpQyxFQUFFLENBQUM7UUFDeEQsTUFBTSxhQUFhLEdBQWdDLEVBQUUsQ0FBQztRQUV0RCxNQUFNLFNBQVMsR0FBRyxJQUFBLGdCQUFDLEVBQUMsVUFBVSxDQUFDO2FBQzVCLEdBQUcsQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDO2FBQ3ZDLElBQUksRUFBRTthQUNOLEtBQUssRUFBRSxDQUFDO1FBRVgsTUFBTSx3QkFBd0IsR0FBRyxFQUFFLENBQUM7UUFDcEMsTUFBTSwwQkFBMEIsR0FBRyxFQUFFLENBQUM7UUFFdEMsS0FBSyxNQUFNLE9BQU8sSUFBSSxTQUFTLEVBQUU7WUFDL0IsSUFBSSxNQUFNLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQyxFQUFFO2dCQUNwRSxNQUFNLFdBQVcsR0FBRyxNQUFNLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUNyRixJQUFJLFdBQVcsRUFBRTtvQkFDZixjQUFjLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDO29CQUNwRCxJQUFJLFdBQVcsQ0FBQyxNQUFNLEVBQUU7d0JBQ3RCLGFBQWEsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEdBQUcsV0FBVyxDQUFDO3FCQUNqRDtpQkFDRjthQUNGO2lCQUFNO2dCQUNMLHdCQUF3QixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQzthQUN4QztTQUNGO1FBRUQsVUFBRyxDQUFDLElBQUksQ0FDTixFQUFFLHdCQUF3QixFQUFFLEVBQzVCLFNBQVMsU0FBUyxDQUFDLE1BQU0sR0FBRyx3QkFBd0IsQ0FBQyxNQUFNLFdBQVcsU0FBUyxDQUFDLE1BQ2hGLDJCQUEyQix3QkFBd0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQztZQUM1RCxDQUFDLENBQUMsdUNBQXVDLHdCQUF3QixDQUFDLE1BQU0sU0FBUztZQUNqRixDQUFDLENBQUMsRUFDSjtPQUNDLENBQ0YsQ0FBQztRQUVGLElBQUksd0JBQXdCLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUN2QyxNQUFNLG9CQUFvQixHQUFHLE1BQU0sSUFBSSxDQUFDLG9CQUFvQixDQUFDLFNBQVMsQ0FDcEUsd0JBQXdCLENBQ3pCLENBQUM7WUFFRixLQUFLLE1BQU0sT0FBTyxJQUFJLHdCQUF3QixFQUFFO2dCQUM5QyxNQUFNLEtBQUssR0FBRyxvQkFBb0IsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDOUQsSUFBSSxLQUFLLEVBQUU7b0JBQ1QsY0FBYyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQztvQkFDOUMsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFO3dCQUNoQixhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEtBQUssQ0FBQztxQkFDckM7b0JBQ0QsTUFBTSxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FDdkIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxFQUNuRCxLQUFLLENBQ04sQ0FBQztpQkFDSDtxQkFBTTtvQkFDTCwwQkFBMEIsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7aUJBQzFDO2FBQ0Y7WUFFRCxVQUFHLENBQUMsSUFBSSxDQUNOLEVBQUUsMEJBQTBCLEVBQUUsRUFDOUIsU0FBUyx3QkFBd0IsQ0FBQyxNQUFNLEdBQUcsMEJBQTBCLENBQUMsTUFDdEUsdUJBQXVCLElBQUksQ0FBQyxxQkFBcUI7Z0JBQy9DLENBQUMsQ0FBQyx5Q0FBeUMsMEJBQTBCLENBQUMsTUFBTSxTQUFTO2dCQUNyRixDQUFDLENBQUMsd0RBQ0osRUFBRSxDQUNILENBQUM7U0FDSDtRQUVELElBQUksSUFBSSxDQUFDLHFCQUFxQixJQUFJLDBCQUEwQixDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDdkUsTUFBTSxzQkFBc0IsR0FBRyxNQUFNLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLENBQ3ZFLDBCQUEwQixDQUMzQixDQUFDO1lBRUYsS0FBSyxNQUFNLE9BQU8sSUFBSSwwQkFBMEIsRUFBRTtnQkFDaEQsTUFBTSxLQUFLLEdBQUcsc0JBQXNCLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ2hFLElBQUksS0FBSyxFQUFFO29CQUNULGNBQWMsQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUM7b0JBQzlDLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRTt3QkFDaEIsYUFBYSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxLQUFLLENBQUM7cUJBQ3JDO29CQUNELE1BQU0sSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQ3ZCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsRUFDbkQsS0FBSyxDQUNOLENBQUM7aUJBQ0g7YUFDRjtTQUNGO1FBRUQsT0FBTztZQUNMLGlCQUFpQixFQUFFLENBQUMsT0FBZSxFQUFxQixFQUFFO2dCQUN4RCxPQUFPLGNBQWMsQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztZQUMvQyxDQUFDO1lBQ0QsZ0JBQWdCLEVBQUUsQ0FBQyxNQUFjLEVBQXFCLEVBQUU7Z0JBQ3RELE9BQU8sYUFBYSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1lBQzdDLENBQUM7WUFDRCxZQUFZLEVBQUUsR0FBWSxFQUFFO2dCQUMxQixPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDdkMsQ0FBQztTQUNGLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUEzSEQsNEVBMkhDIn0=