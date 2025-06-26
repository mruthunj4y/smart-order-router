import { Token } from '@surge/sdk-core';
import { Pair } from '@surge/v2-sdk';
import retry from 'async-retry';
import _ from 'lodash';
import { IUniswapV2Pair__factory } from '../../types/IUniswapV2Pair_factory';
import { CurrencyAmount, ID_TO_NETWORK_NAME, metric, MetricLoggerUnit, } from '../../util';
import { log } from '../../util/log';
import { poolToString } from '../../util/routes';
import { TokenValidationResult } from '../token-validator-provider';
export class V2PoolProvider {
    /**
     * Creates an instance of V2PoolProvider.
     * @param chainId The chain id to use.
     * @param multicall2Provider The multicall provider to use to get the pools.
     * @param tokenPropertiesProvider The token properties provider to use to get token properties.
     * @param retryOptions The retry options for each call to the multicall.
     */
    constructor(chainId, multicall2Provider, tokenPropertiesProvider, retryOptions = {
        retries: 2,
        minTimeout: 50,
        maxTimeout: 500,
    }) {
        this.chainId = chainId;
        this.multicall2Provider = multicall2Provider;
        this.tokenPropertiesProvider = tokenPropertiesProvider;
        this.retryOptions = retryOptions;
        // Computing pool addresses is slow as it requires hashing, encoding etc.
        // Addresses never change so can always be cached.
        this.POOL_ADDRESS_CACHE = {};
    }
    async getPools(tokenPairs, providerConfig) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const poolAddressSet = new Set();
        const sortedTokenPairs = [];
        const sortedPoolAddresses = [];
        for (const tokenPair of tokenPairs) {
            const [tokenA, tokenB] = tokenPair;
            const { poolAddress, token0, token1 } = this.getPoolAddress(tokenA, tokenB);
            if (poolAddressSet.has(poolAddress)) {
                continue;
            }
            poolAddressSet.add(poolAddress);
            sortedTokenPairs.push([token0, token1]);
            sortedPoolAddresses.push(poolAddress);
        }
        log.debug(`getPools called with ${tokenPairs.length} token pairs. Deduped down to ${poolAddressSet.size}`);
        metric.putMetric('V2_RPC_POOL_RPC_CALL', 1, MetricLoggerUnit.None);
        metric.putMetric('V2GetReservesBatchSize', sortedPoolAddresses.length, MetricLoggerUnit.Count);
        metric.putMetric(`V2GetReservesBatchSize_${ID_TO_NETWORK_NAME(this.chainId)}`, sortedPoolAddresses.length, MetricLoggerUnit.Count);
        const [reservesResults, tokenPropertiesMap] = await Promise.all([
            this.getPoolsData(sortedPoolAddresses, 'getReserves', providerConfig),
            this.tokenPropertiesProvider.getTokensProperties(this.flatten(tokenPairs), providerConfig),
        ]);
        log.info(`Got reserves for ${poolAddressSet.size} pools ${(providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber)
            ? `as of block: ${await (providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber)}.`
            : ``}`);
        const poolAddressToPool = {};
        const invalidPools = [];
        for (let i = 0; i < sortedPoolAddresses.length; i++) {
            const reservesResult = reservesResults[i];
            if (!(reservesResult === null || reservesResult === void 0 ? void 0 : reservesResult.success)) {
                const [token0, token1] = sortedTokenPairs[i];
                invalidPools.push([token0, token1]);
                continue;
            }
            let [token0, token1] = sortedTokenPairs[i];
            if (((_a = tokenPropertiesMap[token0.address.toLowerCase()]) === null || _a === void 0 ? void 0 : _a.tokenValidationResult) === TokenValidationResult.FOT) {
                token0 = new Token(token0.chainId, token0.address, token0.decimals, token0.symbol, token0.name, true, // at this point we know it's valid token address
                (_c = (_b = tokenPropertiesMap[token0.address.toLowerCase()]) === null || _b === void 0 ? void 0 : _b.tokenFeeResult) === null || _c === void 0 ? void 0 : _c.buyFeeBps, (_e = (_d = tokenPropertiesMap[token0.address.toLowerCase()]) === null || _d === void 0 ? void 0 : _d.tokenFeeResult) === null || _e === void 0 ? void 0 : _e.sellFeeBps);
            }
            if (((_f = tokenPropertiesMap[token1.address.toLowerCase()]) === null || _f === void 0 ? void 0 : _f.tokenValidationResult) === TokenValidationResult.FOT) {
                token1 = new Token(token1.chainId, token1.address, token1.decimals, token1.symbol, token1.name, true, // at this point we know it's valid token address
                (_h = (_g = tokenPropertiesMap[token1.address.toLowerCase()]) === null || _g === void 0 ? void 0 : _g.tokenFeeResult) === null || _h === void 0 ? void 0 : _h.buyFeeBps, (_k = (_j = tokenPropertiesMap[token1.address.toLowerCase()]) === null || _j === void 0 ? void 0 : _j.tokenFeeResult) === null || _k === void 0 ? void 0 : _k.sellFeeBps);
            }
            const { reserve0, reserve1 } = reservesResult.result;
            const pool = new Pair(CurrencyAmount.fromRawAmount(token0, reserve0.toString()), CurrencyAmount.fromRawAmount(token1, reserve1.toString()));
            const poolAddress = sortedPoolAddresses[i];
            poolAddressToPool[poolAddress] = pool;
        }
        if (invalidPools.length > 0) {
            log.info({
                invalidPools: _.map(invalidPools, ([token0, token1]) => `${token0.symbol}/${token1.symbol}`),
            }, `${invalidPools.length} pools invalid after checking their slot0 and liquidity results. Dropping.`);
        }
        const poolStrs = _.map(Object.values(poolAddressToPool), poolToString);
        log.debug({ poolStrs }, `Found ${poolStrs.length} valid pools`);
        return {
            getPool: (tokenA, tokenB) => {
                const { poolAddress } = this.getPoolAddress(tokenA, tokenB);
                return poolAddressToPool[poolAddress];
            },
            getPoolByAddress: (address) => poolAddressToPool[address],
            getAllPools: () => Object.values(poolAddressToPool),
        };
    }
    getPoolAddress(tokenA, tokenB) {
        const [token0, token1] = tokenA.sortsBefore(tokenB)
            ? [tokenA, tokenB]
            : [tokenB, tokenA];
        const cacheKey = `${this.chainId}/${token0.address}/${token1.address}`;
        const cachedAddress = this.POOL_ADDRESS_CACHE[cacheKey];
        if (cachedAddress) {
            return { poolAddress: cachedAddress, token0, token1 };
        }
        const poolAddress = Pair.getAddress(token0, token1);
        this.POOL_ADDRESS_CACHE[cacheKey] = poolAddress;
        return { poolAddress, token0, token1 };
    }
    async getPoolsData(poolAddresses, functionName, providerConfig) {
        const { results, blockNumber } = await retry(async () => {
            return this.multicall2Provider.callSameFunctionOnMultipleContracts({
                addresses: poolAddresses,
                contractInterface: IUniswapV2Pair__factory.createInterface(),
                functionName: functionName,
                providerConfig,
            });
        }, this.retryOptions);
        log.debug(`Pool data fetched as of block ${blockNumber}`);
        return results;
    }
    // We are using ES2017. ES2019 has native flatMap support
    flatten(tokenPairs) {
        const tokens = new Array();
        for (const [tokenA, tokenB] of tokenPairs) {
            tokens.push(tokenA);
            tokens.push(tokenB);
        }
        return tokens;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9vbC1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9wcm92aWRlcnMvdjIvcG9vbC1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQVcsS0FBSyxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDakQsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUNyQyxPQUFPLEtBQWtDLE1BQU0sYUFBYSxDQUFDO0FBQzdELE9BQU8sQ0FBQyxNQUFNLFFBQVEsQ0FBQztBQUV2QixPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM3RSxPQUFPLEVBQ0wsY0FBYyxFQUNkLGtCQUFrQixFQUNsQixNQUFNLEVBQ04sZ0JBQWdCLEdBQ2pCLE1BQU0sWUFBWSxDQUFDO0FBQ3BCLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUNyQyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFJakQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFnRHBFLE1BQU0sT0FBTyxjQUFjO0lBS3pCOzs7Ozs7T0FNRztJQUNILFlBQ1ksT0FBZ0IsRUFDaEIsa0JBQXNDLEVBQ3RDLHVCQUFpRCxFQUNqRCxlQUFtQztRQUMzQyxPQUFPLEVBQUUsQ0FBQztRQUNWLFVBQVUsRUFBRSxFQUFFO1FBQ2QsVUFBVSxFQUFFLEdBQUc7S0FDaEI7UUFQUyxZQUFPLEdBQVAsT0FBTyxDQUFTO1FBQ2hCLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBb0I7UUFDdEMsNEJBQXVCLEdBQXZCLHVCQUF1QixDQUEwQjtRQUNqRCxpQkFBWSxHQUFaLFlBQVksQ0FJckI7UUFuQkgseUVBQXlFO1FBQ3pFLGtEQUFrRDtRQUMxQyx1QkFBa0IsR0FBOEIsRUFBRSxDQUFDO0lBa0J4RCxDQUFDO0lBRUcsS0FBSyxDQUFDLFFBQVEsQ0FDbkIsVUFBNEIsRUFDNUIsY0FBK0I7O1FBRS9CLE1BQU0sY0FBYyxHQUFnQixJQUFJLEdBQUcsRUFBVSxDQUFDO1FBQ3RELE1BQU0sZ0JBQWdCLEdBQTBCLEVBQUUsQ0FBQztRQUNuRCxNQUFNLG1CQUFtQixHQUFhLEVBQUUsQ0FBQztRQUV6QyxLQUFLLE1BQU0sU0FBUyxJQUFJLFVBQVUsRUFBRTtZQUNsQyxNQUFNLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxHQUFHLFNBQVMsQ0FBQztZQUVuQyxNQUFNLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUN6RCxNQUFNLEVBQ04sTUFBTSxDQUNQLENBQUM7WUFFRixJQUFJLGNBQWMsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLEVBQUU7Z0JBQ25DLFNBQVM7YUFDVjtZQUVELGNBQWMsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDaEMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDeEMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1NBQ3ZDO1FBRUQsR0FBRyxDQUFDLEtBQUssQ0FDUCx3QkFBd0IsVUFBVSxDQUFDLE1BQU0saUNBQWlDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsQ0FDaEcsQ0FBQztRQUVGLE1BQU0sQ0FBQyxTQUFTLENBQUMsc0JBQXNCLEVBQUUsQ0FBQyxFQUFFLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ25FLE1BQU0sQ0FBQyxTQUFTLENBQ2Qsd0JBQXdCLEVBQ3hCLG1CQUFtQixDQUFDLE1BQU0sRUFDMUIsZ0JBQWdCLENBQUMsS0FBSyxDQUN2QixDQUFDO1FBQ0YsTUFBTSxDQUFDLFNBQVMsQ0FDZCwwQkFBMEIsa0JBQWtCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQzVELG1CQUFtQixDQUFDLE1BQU0sRUFDMUIsZ0JBQWdCLENBQUMsS0FBSyxDQUN2QixDQUFDO1FBRUYsTUFBTSxDQUFDLGVBQWUsRUFBRSxrQkFBa0IsQ0FBQyxHQUFHLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQztZQUM5RCxJQUFJLENBQUMsWUFBWSxDQUNmLG1CQUFtQixFQUNuQixhQUFhLEVBQ2IsY0FBYyxDQUNmO1lBQ0QsSUFBSSxDQUFDLHVCQUF1QixDQUFDLG1CQUFtQixDQUM5QyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxFQUN4QixjQUFjLENBQ2Y7U0FDRixDQUFDLENBQUM7UUFFSCxHQUFHLENBQUMsSUFBSSxDQUNOLG9CQUFvQixjQUFjLENBQUMsSUFBSSxVQUNyQyxDQUFBLGNBQWMsYUFBZCxjQUFjLHVCQUFkLGNBQWMsQ0FBRSxXQUFXO1lBQ3pCLENBQUMsQ0FBQyxnQkFBZ0IsTUFBTSxDQUFBLGNBQWMsYUFBZCxjQUFjLHVCQUFkLGNBQWMsQ0FBRSxXQUFXLENBQUEsR0FBRztZQUN0RCxDQUFDLENBQUMsRUFDTixFQUFFLENBQ0gsQ0FBQztRQUVGLE1BQU0saUJBQWlCLEdBQW9DLEVBQUUsQ0FBQztRQUU5RCxNQUFNLFlBQVksR0FBcUIsRUFBRSxDQUFDO1FBRTFDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDbkQsTUFBTSxjQUFjLEdBQUcsZUFBZSxDQUFDLENBQUMsQ0FBRSxDQUFDO1lBRTNDLElBQUksQ0FBQyxDQUFBLGNBQWMsYUFBZCxjQUFjLHVCQUFkLGNBQWMsQ0FBRSxPQUFPLENBQUEsRUFBRTtnQkFDNUIsTUFBTSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsR0FBRyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUUsQ0FBQztnQkFDOUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO2dCQUVwQyxTQUFTO2FBQ1Y7WUFFRCxJQUFJLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxHQUFHLGdCQUFnQixDQUFDLENBQUMsQ0FBRSxDQUFDO1lBQzVDLElBQ0UsQ0FBQSxNQUFBLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsMENBQzVDLHFCQUFxQixNQUFLLHFCQUFxQixDQUFDLEdBQUcsRUFDdkQ7Z0JBQ0EsTUFBTSxHQUFHLElBQUksS0FBSyxDQUNoQixNQUFNLENBQUMsT0FBTyxFQUNkLE1BQU0sQ0FBQyxPQUFPLEVBQ2QsTUFBTSxDQUFDLFFBQVEsRUFDZixNQUFNLENBQUMsTUFBTSxFQUNiLE1BQU0sQ0FBQyxJQUFJLEVBQ1gsSUFBSSxFQUFFLGlEQUFpRDtnQkFDdkQsTUFBQSxNQUFBLGtCQUFrQixDQUNoQixNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUM3QiwwQ0FBRSxjQUFjLDBDQUFFLFNBQVMsRUFDNUIsTUFBQSxNQUFBLGtCQUFrQixDQUNoQixNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUM3QiwwQ0FBRSxjQUFjLDBDQUFFLFVBQVUsQ0FDOUIsQ0FBQzthQUNIO1lBRUQsSUFDRSxDQUFBLE1BQUEsa0JBQWtCLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQywwQ0FDNUMscUJBQXFCLE1BQUsscUJBQXFCLENBQUMsR0FBRyxFQUN2RDtnQkFDQSxNQUFNLEdBQUcsSUFBSSxLQUFLLENBQ2hCLE1BQU0sQ0FBQyxPQUFPLEVBQ2QsTUFBTSxDQUFDLE9BQU8sRUFDZCxNQUFNLENBQUMsUUFBUSxFQUNmLE1BQU0sQ0FBQyxNQUFNLEVBQ2IsTUFBTSxDQUFDLElBQUksRUFDWCxJQUFJLEVBQUUsaURBQWlEO2dCQUN2RCxNQUFBLE1BQUEsa0JBQWtCLENBQ2hCLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQzdCLDBDQUFFLGNBQWMsMENBQUUsU0FBUyxFQUM1QixNQUFBLE1BQUEsa0JBQWtCLENBQ2hCLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQzdCLDBDQUFFLGNBQWMsMENBQUUsVUFBVSxDQUM5QixDQUFDO2FBQ0g7WUFFRCxNQUFNLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxHQUFHLGNBQWMsQ0FBQyxNQUFNLENBQUM7WUFFckQsTUFBTSxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQ25CLGNBQWMsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxFQUN6RCxjQUFjLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FDMUQsQ0FBQztZQUVGLE1BQU0sV0FBVyxHQUFHLG1CQUFtQixDQUFDLENBQUMsQ0FBRSxDQUFDO1lBRTVDLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxHQUFHLElBQUksQ0FBQztTQUN2QztRQUVELElBQUksWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDM0IsR0FBRyxDQUFDLElBQUksQ0FDTjtnQkFDRSxZQUFZLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FDakIsWUFBWSxFQUNaLENBQUMsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFLENBQzFEO2FBQ0YsRUFDRCxHQUFHLFlBQVksQ0FBQyxNQUFNLDRFQUE0RSxDQUNuRyxDQUFDO1NBQ0g7UUFFRCxNQUFNLFFBQVEsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUV2RSxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsUUFBUSxFQUFFLEVBQUUsU0FBUyxRQUFRLENBQUMsTUFBTSxjQUFjLENBQUMsQ0FBQztRQUVoRSxPQUFPO1lBQ0wsT0FBTyxFQUFFLENBQUMsTUFBYSxFQUFFLE1BQWEsRUFBb0IsRUFBRTtnQkFDMUQsTUFBTSxFQUFFLFdBQVcsRUFBRSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO2dCQUM1RCxPQUFPLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ3hDLENBQUM7WUFDRCxnQkFBZ0IsRUFBRSxDQUFDLE9BQWUsRUFBb0IsRUFBRSxDQUN0RCxpQkFBaUIsQ0FBQyxPQUFPLENBQUM7WUFDNUIsV0FBVyxFQUFFLEdBQVcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUM7U0FDNUQsQ0FBQztJQUNKLENBQUM7SUFFTSxjQUFjLENBQ25CLE1BQWEsRUFDYixNQUFhO1FBRWIsTUFBTSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQztZQUNqRCxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDO1lBQ2xCLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztRQUVyQixNQUFNLFFBQVEsR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7UUFFdkUsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRXhELElBQUksYUFBYSxFQUFFO1lBQ2pCLE9BQU8sRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsQ0FBQztTQUN2RDtRQUVELE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBRXBELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsR0FBRyxXQUFXLENBQUM7UUFFaEQsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLENBQUM7SUFDekMsQ0FBQztJQUVPLEtBQUssQ0FBQyxZQUFZLENBQ3hCLGFBQXVCLEVBQ3ZCLFlBQW9CLEVBQ3BCLGNBQStCO1FBRS9CLE1BQU0sRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLEdBQUcsTUFBTSxLQUFLLENBQUMsS0FBSyxJQUFJLEVBQUU7WUFDdEQsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUMsbUNBQW1DLENBR2hFO2dCQUNBLFNBQVMsRUFBRSxhQUFhO2dCQUN4QixpQkFBaUIsRUFBRSx1QkFBdUIsQ0FBQyxlQUFlLEVBQUU7Z0JBQzVELFlBQVksRUFBRSxZQUFZO2dCQUMxQixjQUFjO2FBQ2YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUV0QixHQUFHLENBQUMsS0FBSyxDQUFDLGlDQUFpQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1FBRTFELE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUM7SUFFRCx5REFBeUQ7SUFDakQsT0FBTyxDQUFDLFVBQWlDO1FBQy9DLE1BQU0sTUFBTSxHQUFHLElBQUksS0FBSyxFQUFTLENBQUM7UUFFbEMsS0FBSyxNQUFNLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxJQUFJLFVBQVUsRUFBRTtZQUN6QyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3BCLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7U0FDckI7UUFFRCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0NBQ0YifQ==