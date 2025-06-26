import { ChainId, } from '@surge/sdk-core';
import { DAI_ARBITRUM_SEPOLIA, DAI_XRPL_EVM_TESTNET, USDC_ARBITRUM_SEPOLIA, USDC_XRPL_EVM_TESTNET, } from '../../../providers/token-provider';
import { WRAPPED_NATIVE_CURRENCY } from '../../../util';
// Only keep tokens for XRPL_EVM_TESTNET and ARBITRUM_SEPOLIA
export const usdGasTokensByChain = {
    [ChainId.XRPL_EVM_TESTNET]: [DAI_XRPL_EVM_TESTNET, USDC_XRPL_EVM_TESTNET],
    [ChainId.ARBITRUM_SEPOLIA]: [DAI_ARBITRUM_SEPOLIA, USDC_ARBITRUM_SEPOLIA],
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
export class IV2GasModelFactory {
}
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
export class IOnChainGasModelFactory {
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
// Determines if native currency is token0
// Gets the native price of the pool, dependent on 0 or 1
// quotes across the pool
export const getQuoteThroughNativePool = (chainId, nativeTokenAmount, nativeTokenPool) => {
    const nativeCurrency = WRAPPED_NATIVE_CURRENCY[chainId];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FzLW1vZGVsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3JvdXRlcnMvYWxwaGEtcm91dGVyL2dhcy1tb2RlbHMvZ2FzLW1vZGVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFDTCxPQUFPLEdBR1IsTUFBTSxpQkFBaUIsQ0FBQztBQUt6QixPQUFPLEVBQ0wsb0JBQW9CLEVBQ3BCLG9CQUFvQixFQUNwQixxQkFBcUIsRUFDckIscUJBQXFCLEdBQ3RCLE1BQU0sbUNBQW1DLENBQUM7QUFNM0MsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sZUFBZSxDQUFDO0FBU3hELDZEQUE2RDtBQUM3RCxNQUFNLENBQUMsTUFBTSxtQkFBbUIsR0FBdUM7SUFDckUsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLG9CQUFvQixFQUFFLHFCQUFxQixDQUFDO0lBQ3pFLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQyxvQkFBb0IsRUFBRSxxQkFBcUIsQ0FBQztDQUMxRSxDQUFDO0FBNkVGOzs7Ozs7Ozs7O0dBVUc7QUFDSCxNQUFNLE9BQWdCLGtCQUFrQjtDQVF2QztBQUVEOzs7Ozs7Ozs7O0dBVUc7QUFDSCxNQUFNLE9BQWdCLHVCQUF1QjtJQWNqQyw0QkFBNEIsQ0FDcEMsMkJBQXFDO1FBRXJDLElBQUksWUFBWSxHQUFHLENBQUMsQ0FBQztRQUNyQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsMkJBQTJCLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzNELE1BQU0sSUFBSSxHQUFHLDJCQUEyQixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzVDLElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxJQUFJLElBQUksR0FBRyxDQUFDLEVBQUU7Z0JBQ3hDLHlGQUF5RjtnQkFDekYsWUFBWSxJQUFJLElBQUksR0FBRyxDQUFDLENBQUM7YUFDMUI7U0FDRjtRQUVELE9BQU8sWUFBWSxDQUFDO0lBQ3RCLENBQUM7Q0FDRjtBQUVELDBDQUEwQztBQUMxQyx5REFBeUQ7QUFDekQseUJBQXlCO0FBQ3pCLE1BQU0sQ0FBQyxNQUFNLHlCQUF5QixHQUFHLENBQ3ZDLE9BQWdCLEVBQ2hCLGlCQUEyQyxFQUMzQyxlQUE0QixFQUNaLEVBQUU7SUFDbEIsTUFBTSxjQUFjLEdBQUcsdUJBQXVCLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDeEQsSUFBSSxDQUFDLGNBQWM7UUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLHdDQUF3QyxDQUFDLENBQUM7SUFDL0UsSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFO1FBQ3RELE1BQU0sSUFBSSxLQUFLLENBQUMsMkJBQTJCLENBQUMsQ0FBQztLQUM5QztJQUNELE1BQU0sUUFBUSxHQUFHLGVBQWUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBRS9ELDZDQUE2QztJQUM3QyxNQUFNLFdBQVcsR0FBRyxDQUFDLGFBQWEsSUFBSSxlQUFlLElBQUksZUFBZSxDQUFDLFdBQVcsQ0FBQztRQUNuRixDQUFDLENBQUMsZUFBZSxDQUFDLFdBQVc7UUFDN0IsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUNkLE1BQU0sV0FBVyxHQUFHLENBQUMsYUFBYSxJQUFJLGVBQWUsSUFBSSxlQUFlLENBQUMsV0FBVyxDQUFDO1FBQ25GLENBQUMsQ0FBQyxlQUFlLENBQUMsV0FBVztRQUM3QixDQUFDLENBQUMsU0FBUyxDQUFDO0lBQ2QsSUFBSSxDQUFDLFdBQVcsSUFBSSxDQUFDLFdBQVcsRUFBRTtRQUNoQyxNQUFNLElBQUksS0FBSyxDQUFDLGlDQUFpQyxDQUFDLENBQUM7S0FDcEQ7SUFFRCxNQUFNLGdCQUFnQixHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUM7SUFFOUQsT0FBTyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQW1CLENBQUM7QUFDckUsQ0FBQyxDQUFDIn0=