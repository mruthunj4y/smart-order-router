import { computePoolAddress, Pool } from '@surge/v3-sdk';
import retry from 'async-retry';
import { IUniswapV3PoolState__factory } from '../../types/IUniswapV3PoolState__factory';
import { V3_CORE_FACTORY_ADDRESSES } from '../../util/addresses';
import { log } from '../../util/log';
import { PoolProvider } from '../pool-provider';
export class V3PoolProvider extends PoolProvider {
    /**
     * Creates an instance of V3PoolProvider.
     * @param chainId The chain id to use.
     * @param multicall2Provider The multicall provider to use to get the pools.
     * @param retryOptions The retry options for each call to the multicall.
     */
    constructor(chainId, multicall2Provider, retryOptions = {
        retries: 2,
        minTimeout: 50,
        maxTimeout: 500,
    }) {
        super(chainId, multicall2Provider, retryOptions);
        // Computing pool addresses is slow as it requires hashing, encoding etc.
        // Addresses never change so can always be cached.
        this.POOL_ADDRESS_CACHE = {};
    }
    async getPools(tokenPairs, providerConfig) {
        return await super.getPoolsInternal(tokenPairs, providerConfig);
    }
    getPoolAddress(tokenA, tokenB, feeAmount) {
        const { poolIdentifier, currency0, currency1 } = this.getPoolIdentifier([
            tokenA,
            tokenB,
            feeAmount,
        ]);
        return {
            poolAddress: poolIdentifier,
            token0: currency0,
            token1: currency1,
        };
    }
    getLiquidityFunctionName() {
        return 'liquidity';
    }
    getSlot0FunctionName() {
        return 'slot0';
    }
    async getPoolsData(poolAddresses, functionName, providerConfig) {
        const { results, blockNumber } = await retry(async () => {
            return this.multicall2Provider.callSameFunctionOnMultipleContracts({
                addresses: poolAddresses,
                contractInterface: IUniswapV3PoolState__factory.createInterface(),
                functionName: functionName,
                providerConfig,
            });
        }, this.retryOptions);
        log.debug(`Pool data fetched as of block ${blockNumber}`);
        return results;
    }
    getPoolIdentifier(pool) {
        const [tokenA, tokenB, feeAmount] = pool;
        const [token0, token1] = tokenA.sortsBefore(tokenB)
            ? [tokenA, tokenB]
            : [tokenB, tokenA];
        const cacheKey = `${this.chainId}/${token0.address}/${token1.address}/${feeAmount}`;
        const cachedAddress = this.POOL_ADDRESS_CACHE[cacheKey];
        if (cachedAddress) {
            return {
                poolIdentifier: cachedAddress,
                currency0: token0,
                currency1: token1,
            };
        }
        const poolAddress = computePoolAddress({
            factoryAddress: V3_CORE_FACTORY_ADDRESSES[this.chainId],
            tokenA: token0,
            tokenB: token1,
            fee: feeAmount,
            initCodeHashManualOverride: undefined,
        });
        this.POOL_ADDRESS_CACHE[cacheKey] = poolAddress;
        return {
            poolIdentifier: poolAddress,
            currency0: token0,
            currency1: token1,
        };
    }
    instantiatePool(pool, slot0, liquidity) {
        const [token0, token1, feeAmount] = pool;
        return new Pool(token0, token1, feeAmount, slot0.sqrtPriceX96.toString(), liquidity.toString(), slot0.tick);
    }
    instantiatePoolAccessor(poolIdentifierToPool) {
        return {
            getPool: (tokenA, tokenB, feeAmount) => {
                const { poolAddress } = this.getPoolAddress(tokenA, tokenB, feeAmount);
                return poolIdentifierToPool[poolAddress];
            },
            getPoolByAddress: (address) => poolIdentifierToPool[address],
            getAllPools: () => Object.values(poolIdentifierToPool),
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9vbC1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9wcm92aWRlcnMvdjMvcG9vbC1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQSxPQUFPLEVBQUUsa0JBQWtCLEVBQWEsSUFBSSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQ3BFLE9BQU8sS0FBa0MsTUFBTSxhQUFhLENBQUM7QUFFN0QsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDeEYsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFDakUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBRXJDLE9BQU8sRUFBc0IsWUFBWSxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUF5RHBFLE1BQU0sT0FBTyxjQUNYLFNBQVEsWUFNUDtJQU1EOzs7OztPQUtHO0lBQ0gsWUFDRSxPQUFnQixFQUNoQixrQkFBc0MsRUFDdEMsZUFBbUM7UUFDakMsT0FBTyxFQUFFLENBQUM7UUFDVixVQUFVLEVBQUUsRUFBRTtRQUNkLFVBQVUsRUFBRSxHQUFHO0tBQ2hCO1FBRUQsS0FBSyxDQUFDLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxZQUFZLENBQUMsQ0FBQztRQW5CbkQseUVBQXlFO1FBQ3pFLGtEQUFrRDtRQUMxQyx1QkFBa0IsR0FBOEIsRUFBRSxDQUFDO0lBa0IzRCxDQUFDO0lBRU0sS0FBSyxDQUFDLFFBQVEsQ0FDbkIsVUFBNkIsRUFDN0IsY0FBK0I7UUFFL0IsT0FBTyxNQUFNLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDbEUsQ0FBQztJQUVNLGNBQWMsQ0FDbkIsTUFBYSxFQUNiLE1BQWEsRUFDYixTQUFvQjtRQUVwQixNQUFNLEVBQUUsY0FBYyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsR0FBRyxJQUFJLENBQUMsaUJBQWlC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