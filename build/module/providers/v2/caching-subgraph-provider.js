import { Protocol } from '@surge/router-sdk';
import { CachingSubgraphProvider } from '../caching-subgraph-provider';
/**
 * Provider for getting V2 pools, with functionality for caching the results.
 *
 * @export
 * @class CachingV2SubgraphProvider
 */
export class CachingV2SubgraphProvider extends CachingSubgraphProvider {
    /**
     * Creates an instance of CachingV2SubgraphProvider.
     * @param chainId The chain id to use.
     * @param subgraphProvider The provider to use to get the subgraph pools when not in the cache.
     * @param cache Cache instance to hold cached pools.
     */
    constructor(chainId, subgraphProvider, cache) {
        super(chainId, subgraphProvider, cache, Protocol.V2);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FjaGluZy1zdWJncmFwaC1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9wcm92aWRlcnMvdjIvY2FjaGluZy1zdWJncmFwaC1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFHN0MsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFLdkU7Ozs7O0dBS0c7QUFDSCxNQUFNLE9BQU8seUJBQ1gsU0FBUSx1QkFBdUM7SUFHL0M7Ozs7O09BS0c7SUFDSCxZQUNFLE9BQWdCLEVBQ2hCLGdCQUFxQyxFQUNyQyxLQUErQjtRQUUvQixLQUFLLENBQUMsT0FBTyxFQUFFLGdCQUFnQixFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDdkQsQ0FBQztDQUNGIn0=