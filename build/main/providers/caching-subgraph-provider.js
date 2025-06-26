"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CachingSubgraphProvider = exports.BASES_TO_CHECK_TRADES_AGAINST = void 0;
const sdk_core_1 = require("@surge/sdk-core");
const util_1 = require("../util");
const token_provider_1 = require("./token-provider");
exports.BASES_TO_CHECK_TRADES_AGAINST = {
    [sdk_core_1.ChainId.XRPL_EVM_TESTNET]: [
        util_1.WRAPPED_NATIVE_CURRENCY[sdk_core_1.ChainId.XRPL_EVM_TESTNET],
        token_provider_1.WETH_XRPL_EVM_TESTNET,
        token_provider_1.DAI_XRPL_EVM_TESTNET,
        token_provider_1.TON_XRPL_EVM_TESTNET,
        token_provider_1.TRON_XRPL_EVM_TESTNET,
        token_provider_1.SOL_XRPL_EVM_TESTNET,
        token_provider_1.USDC_XRPL_EVM_TESTNET,
        token_provider_1.RLUSD_XRPL_EVM_TESTNET,
        token_provider_1.MATIC_XRPL_EVM_TESTNET,
        token_provider_1.AXL_XRPL_EVM_TESTNET,
        token_provider_1.AVAX_XRPL_EVM_TESTNET,
        token_provider_1.USDT_XRPL_EVM_TESTNET,
        token_provider_1.BNB_XRPL_EVM_TESTNET,
    ],
    [sdk_core_1.ChainId.ARBITRUM_SEPOLIA]: [
        util_1.WRAPPED_NATIVE_CURRENCY[sdk_core_1.ChainId.ARBITRUM_SEPOLIA],
    ],
};
class CachingSubgraphProvider {
    /**
     * Creates an instance of CachingV3SubgraphProvider.
     * @param chainId The chain id to use.
     * @param subgraphProvider The provider to use to get the subgraph pools when not in the cache.
     * @param cache Cache instance to hold cached pools.
     * @param protocol Subgraph protocol version
     */
    constructor(chainId, subgraphProvider, cache, protocol) {
        this.chainId = chainId;
        this.subgraphProvider = subgraphProvider;
        this.cache = cache;
        this.protocol = protocol;
        this.SUBGRAPH_KEY = (chainId) => `subgraph-pools-${this.
            protocol}-${chainId}`;
    }
    async getPools() {
        const cachedPools = await this.cache.get(this.SUBGRAPH_KEY(this.chainId));
        if (cachedPools) {
            return cachedPools;
        }
        const pools = await this.subgraphProvider.getPools();
        await this.cache.set(this.SUBGRAPH_KEY(this.chainId), pools);
        return pools;
    }
}
exports.CachingSubgraphProvider = CachingSubgraphProvider;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FjaGluZy1zdWJncmFwaC1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9wcm92aWRlcnMvY2FjaGluZy1zdWJncmFwaC1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSw4Q0FBaUQ7QUFHakQsa0NBQWtEO0FBSWxELHFEQWEwQjtBQU9iLFFBQUEsNkJBQTZCLEdBQW1CO0lBQzNELENBQUMsa0JBQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO1FBQzFCLDhCQUF1QixDQUFDLGtCQUFPLENBQUMsZ0JBQWdCLENBQUU7UUFDbEQsc0NBQXFCO1FBQ3JCLHFDQUFvQjtRQUNwQixxQ0FBb0I7UUFDcEIsc0NBQXFCO1FBQ3JCLHFDQUFvQjtRQUNwQixzQ0FBcUI7UUFDckIsdUNBQXNCO1FBQ3RCLHVDQUFzQjtRQUN0QixxQ0FBb0I7UUFDcEIsc0NBQXFCO1FBQ3JCLHNDQUFxQjtRQUNyQixxQ0FBb0I7S0FDckI7SUFDRCxDQUFDLGtCQUFPLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtRQUMxQiw4QkFBdUIsQ0FBQyxrQkFBTyxDQUFDLGdCQUFnQixDQUFFO0tBQ25EO0NBQ0YsQ0FBQztBQWtCRixNQUFzQix1QkFBdUI7SUFPM0M7Ozs7OztPQU1HO0lBQ0gsWUFDVSxPQUFnQixFQUNkLGdCQUFrRCxFQUNwRCxLQUE4QixFQUM5QixRQUFrQjtRQUhsQixZQUFPLEdBQVAsT0FBTyxDQUFTO1FBQ2QscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFrQztRQUNwRCxVQUFLLEdBQUwsS0FBSyxDQUF5QjtRQUM5QixhQUFRLEdBQVIsUUFBUSxDQUFVO1FBZnBCLGlCQUFZLEdBQUcsQ0FBQyxPQUFnQixFQUFFLEVBQUUsQ0FDMUMsa0JBQWtCLElBQUk7WUFDcEIsUUFBUSxJQUFJLE9BQU8sRUFBRSxDQUFDO0lBY3RCLENBQUM7SUFFRSxLQUFLLENBQUMsUUFBUTtRQUNuQixNQUFNLFdBQVcsR0FBRyxNQUFNLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFFMUUsSUFBSSxXQUFXLEVBQUU7WUFDZixPQUFPLFdBQVcsQ0FBQztTQUNwQjtRQUVELE1BQU0sS0FBSyxHQUFHLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxDQUFDO1FBRXJELE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFN0QsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0NBQ0Y7QUFsQ0QsMERBa0NDIn0=