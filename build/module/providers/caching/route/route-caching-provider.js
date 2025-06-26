import { TradeType } from '@surge/sdk-core';
import { CacheMode } from './model';
/**
 * Abstract class for a RouteCachingProvider.
 * Defines the base methods of how to interact with this interface, but not the implementation of how to cache.
 */
export class IRouteCachingProvider {
    constructor() {
        /**
         * Final implementation of the public `getCachedRoute` method, this is how code will interact with the implementation
         *
         * @public
         * @readonly
         * @param chainId
         * @param amount
         * @param quoteCurrency
         * @param tradeType
         * @param protocols
         * @param blockNumber
         */
        this.getCachedRoute = async (
        // Defined as a readonly member instead of a regular function to make it final.
        chainId, amount, quoteCurrency, tradeType, protocols, blockNumber, optimistic = false) => {
            if ((await this.getCacheMode(chainId, amount, quoteCurrency, tradeType, protocols)) == CacheMode.Darkmode) {
                return undefined;
            }
            const cachedRoute = await this._getCachedRoute(chainId, amount, quoteCurrency, tradeType, protocols, blockNumber, optimistic);
            return this.filterExpiredCachedRoutes(cachedRoute, blockNumber, optimistic);
        };
        /**
         * Final implementation of the public `setCachedRoute` method.
         * This method will set the blockToLive in the CachedRoutes object before calling the internal method to insert in cache.
         *
         * @public
         * @readonly
         * @param cachedRoutes The route to cache.
         * @returns Promise<boolean> Indicates if the route was inserted into cache.
         */
        this.setCachedRoute = async (
        // Defined as a readonly member instead of a regular function to make it final.
        cachedRoutes, amount) => {
            if ((await this.getCacheModeFromCachedRoutes(cachedRoutes, amount)) ==
                CacheMode.Darkmode) {
                return false;
            }
            cachedRoutes.blocksToLive = await this._getBlocksToLive(cachedRoutes, amount);
            return this._setCachedRoute(cachedRoutes, amount);
        };
    }
    /**
     * Returns the CacheMode for the given cachedRoutes and amount
     *
     * @param cachedRoutes
     * @param amount
     */
    getCacheModeFromCachedRoutes(cachedRoutes, amount) {
        const quoteCurrency = cachedRoutes.tradeType == TradeType.EXACT_INPUT
            ? cachedRoutes.currencyOut
            : cachedRoutes.currencyIn;
        return this.getCacheMode(cachedRoutes.chainId, amount, quoteCurrency, cachedRoutes.tradeType, cachedRoutes.protocolsCovered);
    }
    filterExpiredCachedRoutes(cachedRoutes, blockNumber, optimistic) {
        return (cachedRoutes === null || cachedRoutes === void 0 ? void 0 : cachedRoutes.notExpired(blockNumber, optimistic))
            ? cachedRoutes
            : undefined;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUtY2FjaGluZy1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9wcm92aWRlcnMvY2FjaGluZy9yb3V0ZS9yb3V0ZS1jYWNoaW5nLXByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQU9BLE9BQU8sRUFBcUMsU0FBUyxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFFL0UsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLFNBQVMsQ0FBQztBQUdwQzs7O0dBR0c7QUFDSCxNQUFNLE9BQWdCLHFCQUFxQjtJQUEzQztRQUNFOzs7Ozs7Ozs7OztXQVdHO1FBQ2EsbUJBQWMsR0FBRyxLQUFLO1FBQ3BDLCtFQUErRTtRQUMvRSxPQUFlLEVBQ2YsTUFBZ0MsRUFDaEMsYUFBdUIsRUFDdkIsU0FBb0IsRUFDcEIsU0FBcUIsRUFDckIsV0FBbUIsRUFDbkIsVUFBVSxHQUFHLEtBQUssRUFDaUIsRUFBRTtZQUNyQyxJQUNFLENBQUMsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUN0QixPQUFPLEVBQ1AsTUFBTSxFQUNOLGFBQWEsRUFDYixTQUFTLEVBQ1QsU0FBUyxDQUNWLENBQUMsSUFBSSxTQUFTLENBQUMsUUFBUSxFQUN4QjtnQkFDQSxPQUFPLFNBQVMsQ0FBQzthQUNsQjtZQUVELE1BQU0sV0FBVyxHQUFHLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FDNUMsT0FBTyxFQUNQLE1BQU0sRUFDTixhQUFhLEVBQ2IsU0FBUyxFQUNULFNBQVMsRUFDVCxXQUFXLEVBQ1gsVUFBVSxDQUNYLENBQUM7WUFFRixPQUFPLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxXQUFXLEVBQUUsV0FBVyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzlFLENBQUMsQ0FBQztRQUVGOzs7Ozs7OztXQVFHO1FBQ2EsbUJBQWMsR0FBRyxLQUFLO1FBQ3BDLCtFQUErRTtRQUMvRSxZQUEwQixFQUMxQixNQUFnQyxFQUNkLEVBQUU7WUFDcEIsSUFDRSxDQUFDLE1BQU0sSUFBSSxDQUFDLDRCQUE0QixDQUFDLFlBQVksRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFDL0QsU0FBUyxDQUFDLFFBQVEsRUFDbEI7Z0JBQ0EsT0FBTyxLQUFLLENBQUM7YUFDZDtZQUVELFlBQVksQ0FBQyxZQUFZLEdBQUcsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQ3JELFlBQVksRUFDWixNQUFNLENBQ1AsQ0FBQztZQUVGLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDcEQsQ0FBQyxDQUFDO0lBb0dKLENBQUM7SUFsR0M7Ozs7O09BS0c7SUFDSSw0QkFBNEIsQ0FDakMsWUFBMEIsRUFDMUIsTUFBZ0M7UUFFaEMsTUFBTSxhQUFhLEdBQ2pCLFlBQVksQ0FBQyxTQUFTLElBQUksU0FBUyxDQUFDLFdBQVc7WUFDN0MsQ0FBQyxDQUFDLFlBQVksQ0FBQyxXQUFXO1lBQzFCLENBQUMsQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDO1FBRTlCLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FDdEIsWUFBWSxDQUFDLE9BQU8sRUFDcEIsTUFBTSxFQUNOLGFBQWEsRUFDYixZQUFZLENBQUMsU0FBUyxFQUN0QixZQUFZLENBQUMsZ0JBQWdCLENBQzlCLENBQUM7SUFDSixDQUFDO0lBbUJTLHlCQUF5QixDQUNqQyxZQUFzQyxFQUN0QyxXQUFtQixFQUNuQixVQUFtQjtRQUVuQixPQUFPLENBQUEsWUFBWSxhQUFaLFlBQVksdUJBQVosWUFBWSxDQUFFLFVBQVUsQ0FBQyxXQUFXLEVBQUUsVUFBVSxDQUFDO1lBQ3RELENBQUMsQ0FBQyxZQUFZO1lBQ2QsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUNoQixDQUFDO0NBaURGIn0=