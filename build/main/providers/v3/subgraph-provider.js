"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.V3SubgraphProvider = void 0;
const router_sdk_1 = require("@surge/router-sdk");
const sdk_core_1 = require("@surge/sdk-core");
const subgraph_provider_1 = require("../subgraph-provider");
const SUBGRAPH_URL_BY_CHAIN = {
    [sdk_core_1.ChainId.XRPL_EVM_TESTNET]: '',
    [sdk_core_1.ChainId.ARBITRUM_SEPOLIA]: '',
};
class V3SubgraphProvider extends subgraph_provider_1.SubgraphProvider {
    constructor(chainId, retries = 2, timeout = 30000, rollback = true, trackedEthThreshold = 0.01, untrackedUsdThreshold = Number.MAX_VALUE, subgraphUrlOverride) {
        super(router_sdk_1.Protocol.V3, chainId, retries, timeout, rollback, trackedEthThreshold, untrackedUsdThreshold, subgraphUrlOverride !== null && subgraphUrlOverride !== void 0 ? subgraphUrlOverride : SUBGRAPH_URL_BY_CHAIN[chainId]);
    }
    subgraphQuery(blockNumber) {
        return `
    query getPools($pageSize: Int!, $id: String) {
      pools(
        first: $pageSize
        ${blockNumber ? `block: { number: ${blockNumber} }` : ``}
          where: { id_gt: $id }
        ) {
          id
          token0 {
            symbol
            id
          }
          token1 {
            symbol
            id
          }
          feeTier
          liquidity
          totalValueLockedUSD
          totalValueLockedETH
          totalValueLockedUSDUntracked
        }
      }
   `;
    }
    mapSubgraphPool(rawPool) {
        return {
            id: rawPool.id,
            feeTier: rawPool.feeTier,
            liquidity: rawPool.liquidity,
            token0: {
                id: rawPool.token0.id,
            },
            token1: {
                id: rawPool.token1.id,
            },
            tvlETH: parseFloat(rawPool.totalValueLockedETH),
            tvlUSD: parseFloat(rawPool.totalValueLockedUSD),
        };
    }
}
exports.V3SubgraphProvider = V3SubgraphProvider;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3ViZ3JhcGgtcHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcHJvdmlkZXJzL3YzL3N1YmdyYXBoLXByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLGtEQUE2QztBQUM3Qyw4Q0FBaUQ7QUFHakQsNERBQXdEO0FBaUN4RCxNQUFNLHFCQUFxQixHQUFzQztJQUMvRCxDQUFDLGtCQUFPLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxFQUFFO0lBQzlCLENBQUMsa0JBQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLEVBQUU7Q0FDL0IsQ0FBQztBQWdCRixNQUFhLGtCQUNYLFNBQVEsb0NBQW1EO0lBRTNELFlBQ0UsT0FBZ0IsRUFDaEIsT0FBTyxHQUFHLENBQUMsRUFDWCxPQUFPLEdBQUcsS0FBSyxFQUNmLFFBQVEsR0FBRyxJQUFJLEVBQ2YsbUJBQW1CLEdBQUcsSUFBSSxFQUMxQixxQkFBcUIsR0FBRyxNQUFNLENBQUMsU0FBUyxFQUN4QyxtQkFBNEI7UUFFNUIsS0FBSyxDQUNILHFCQUFRLENBQUMsRUFBRSxFQUNYLE9BQU8sRUFDUCxPQUFPLEVBQ1AsT0FBTyxFQUNQLFFBQVEsRUFDUixtQkFBbUIsRUFDbkIscUJBQXFCLEVBQ3JCLG1CQUFtQixhQUFuQixtQkFBbUIsY0FBbkIsbUJBQW1CLEdBQUkscUJBQXFCLENBQUMsT0FBTyxDQUFDLENBQ3RELENBQUM7SUFDSixDQUFDO0lBRWtCLGFBQWEsQ0FBQyxXQUFvQjtRQUNuRCxPQUFPOzs7O1VBSUQsV0FBVyxDQUFDLENBQUMsQ0FBQyxvQkFBb0IsV0FBVyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUU7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFtQjVELENBQUM7SUFDSCxDQUFDO0lBRWtCLGVBQWUsQ0FDaEMsT0FBMEI7UUFFMUIsT0FBTztZQUNMLEVBQUUsRUFBRSxPQUFPLENBQUMsRUFBRTtZQUNkLE9BQU8sRUFBRSxPQUFPLENBQUMsT0FBTztZQUN4QixTQUFTLEVBQUUsT0FBTyxDQUFDLFNBQVM7WUFDNUIsTUFBTSxFQUFFO2dCQUNOLEVBQUUsRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7YUFDdEI7WUFDRCxNQUFNLEVBQUU7Z0JBQ04sRUFBRSxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRTthQUN0QjtZQUNELE1BQU0sRUFBRSxVQUFVLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDO1lBQy9DLE1BQU0sRUFBRSxVQUFVLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDO1NBQ2hELENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFwRUQsZ0RBb0VDIn0=