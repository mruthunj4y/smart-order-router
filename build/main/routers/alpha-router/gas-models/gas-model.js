"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQuoteThroughNativePool = exports.IOnChainGasModelFactory = exports.IV2GasModelFactory = exports.usdGasTokensByChain = void 0;
const sdk_core_1 = require("@surge/sdk-core");
const token_provider_1 = require("../../../providers/token-provider");
const util_1 = require("../../../util");
// Only keep tokens for XRPL_EVM_TESTNET and ARBITRUM_SEPOLIA
exports.usdGasTokensByChain = {
    [sdk_core_1.ChainId.XRPL_EVM_TESTNET]: [token_provider_1.DAI_XRPL_EVM_TESTNET, token_provider_1.USDC_XRPL_EVM_TESTNET],
    [sdk_core_1.ChainId.ARBITRUM_SEPOLIA]: [token_provider_1.DAI_ARBITRUM_SEPOLIA, token_provider_1.USDC_ARBITRUM_SEPOLIA],
};
/**
 * Factory for building gas models that can be used with any route to generate
 * gas estimates.
 *
 * Factory model is used so that any supporting data can be fetched once and
 * returned as part of the model.
 *
 * @export
 * @abstract
 * @class IV2GasModelFactory
 */
class IV2GasModelFactory {
}
exports.IV2GasModelFactory = IV2GasModelFactory;
/**
 * Factory for building gas models that can be used with any route to generate
 * gas estimates.
 *
 * Factory model is used so that any supporting data can be fetched once and
 * returned as part of the model.
 *
 * @export
 * @abstract
 * @class IOnChainGasModelFactory
 */
class IOnChainGasModelFactory {
    totalInitializedTicksCrossed(initializedTicksCrossedList) {
        let ticksCrossed = 0;
        for (let i = 0; i < initializedTicksCrossedList.length; i++) {
            const tick = initializedTicksCrossedList[i];
            if (typeof tick === 'number' && tick > 0) {
                // Quoter returns Array<number of calls to crossTick + 1>, so we need to subtract 1 here.
                ticksCrossed += tick - 1;
            }
        }
        return ticksCrossed;
    }
}
exports.IOnChainGasModelFactory = IOnChainGasModelFactory;
// Determines if native currency is token0
// Gets the native price of the pool, dependent on 0 or 1
// quotes across the pool
const getQuoteThroughNativePool = (chainId, nativeTokenAmount, nativeTokenPool) => {
    const nativeCurrency = util_1.WRAPPED_NATIVE_CURRENCY[chainId];
    if (!nativeCurrency)
        throw new Error('No wrapped native token for this chain');
    if (!nativeTokenPool.token0 || !nativeTokenPool.token1) {
        throw new Error('Pool tokens are undefined');
    }
    const isToken0 = nativeTokenPool.token0.equals(nativeCurrency);
    // Type guard for token0Price and token1Price
    const token0Price = ("token0Price" in nativeTokenPool && nativeTokenPool.token0Price)
        ? nativeTokenPool.token0Price
        : undefined;
    const token1Price = ("token1Price" in nativeTokenPool && nativeTokenPool.token1Price)
        ? nativeTokenPool.token1Price
        : undefined;
    if (!token0Price || !token1Price) {
        throw new Error('Pool token prices are undefined');
    }
    const nativeTokenPrice = isToken0 ? token0Price : token1Price;
    return nativeTokenPrice.quote(nativeTokenAmount);
};
exports.getQuoteThroughNativePool = getQuoteThroughNativePool;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FzLW1vZGVsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3JvdXRlcnMvYWxwaGEtcm91dGVyL2dhcy1tb2RlbHMvZ2FzLW1vZGVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLDhDQUl5QjtBQUt6QixzRUFLMkM7QUFNM0Msd0NBQXdEO0FBU3hELDZEQUE2RDtBQUNoRCxRQUFBLG1CQUFtQixHQUF1QztJQUNyRSxDQUFDLGtCQUFPLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLHFDQUFvQixFQUFFLHNDQUFxQixDQUFDO0lBQ3pFLENBQUMsa0JBQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUMscUNBQW9CLEVBQUUsc0NBQXFCLENBQUM7Q0FDMUUsQ0FBQztBQTZFRjs7Ozs7Ozs7OztHQVVHO0FBQ0gsTUFBc0Isa0JBQWtCO0NBUXZDO0FBUkQsZ0RBUUM7QUFFRDs7Ozs7Ozs7OztHQVVHO0FBQ0gsTUFBc0IsdUJBQXVCO0lBY2pDLDRCQUE0QixDQUNwQywyQkFBcUM7UUFFckMsSUFBSSxZQUFZLEdBQUcsQ0FBQyxDQUFDO1FBQ3JCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRywyQkFBMkIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDM0QsTUFBTSxJQUFJLEdBQUcsMkJBQTJCLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUMsSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLElBQUksSUFBSSxHQUFHLENBQUMsRUFBRTtnQkFDeEMseUZBQXlGO2dCQUN6RixZQUFZLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQzthQUMxQjtTQUNGO1FBRUQsT0FBTyxZQUFZLENBQUM7SUFDdEIsQ0FBQztDQUNGO0FBNUJELDBEQTRCQztBQUVELDBDQUEwQztBQUMxQyx5REFBeUQ7QUFDekQseUJBQXlCO0FBQ2xCLE1BQU0seUJBQXlCLEdBQUcsQ0FDdkMsT0FBZ0IsRUFDaEIsaUJBQTJDLEVBQzNDLGVBQTRCLEVBQ1osRUFBRTtJQUNsQixNQUFNLGNBQWMsR0FBRyw4QkFBdUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN4RCxJQUFJLENBQUMsY0FBYztRQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsd0NBQXdDLENBQUMsQ0FBQztJQUMvRSxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUU7UUFDdEQsTUFBTSxJQUFJLEtBQUssQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO0tBQzlDO0lBQ0QsTUFBTSxRQUFRLEdBQUcsZUFBZSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUM7SUFFL0QsNkNBQTZDO0lBQzdDLE1BQU0sV0FBVyxHQUFHLENBQUMsYUFBYSxJQUFJLGVBQWUsSUFBSSxlQUFlLENBQUMsV0FBVyxDQUFDO1FBQ25GLENBQUMsQ0FBQyxlQUFlLENBQUMsV0FBVztRQUM3QixDQUFDLENBQUMsU0FBUyxDQUFDO0lBQ2QsTUFBTSxXQUFXLEdBQUcsQ0FBQyxhQUFhLElBQUksZUFBZSxJQUFJLGVBQWUsQ0FBQyxXQUFXLENBQUM7UUFDbkYsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxXQUFXO1FBQzdCLENBQUMsQ0FBQyxTQUFTLENBQUM7SUFDZCxJQUFJLENBQUMsV0FBVyxJQUFJLENBQUMsV0FBVyxFQUFFO1FBQ2hDLE1BQU0sSUFBSSxLQUFLLENBQUMsaUNBQWlDLENBQUMsQ0FBQztLQUNwRDtJQUVELE1BQU0sZ0JBQWdCLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQztJQUU5RCxPQUFPLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBbUIsQ0FBQztBQUNyRSxDQUFDLENBQUM7QUExQlcsUUFBQSx5QkFBeUIsNkJBMEJwQyJ9