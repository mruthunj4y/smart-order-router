"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PoolProvider = void 0;
const lodash_1 = __importDefault(require("lodash"));
const util_1 = require("../util");
class PoolProvider {
    /**
     * @param chainId The chain id to use.
     * @param multicall2Provider The multicall provider to use to get the pools.
     * @param retryOptions The retry options for each call to the multicall.
     */
    constructor(chainId, multicall2Provider, retryOptions = {
        retries: 2,
        minTimeout: 50,
        maxTimeout: 500,
    }) {
        this.chainId = chainId;
        this.multicall2Provider = multicall2Provider;
        this.retryOptions = retryOptions;
    }
    async getPoolsInternal(poolConstructs, providerConfig) {
        const poolIdentifierSet = new Set();
        const sortedCurrencyPairs = [];
        const sortedPoolIdentifiers = [];
        for (const poolConstruct of poolConstructs) {
            const { poolIdentifier: poolIdentifier, currency0, currency1, } = this.getPoolIdentifier(poolConstruct);
            if (poolIdentifierSet.has(poolIdentifier)) {
                continue;
            }
            // It's the easiest way to change the pool construct in place, since we don't know the entire pool construct at compiling time.
            poolConstruct[0] = currency0;
            poolConstruct[1] = currency1;
            poolIdentifierSet.add(poolIdentifier);
            sortedCurrencyPairs.push(poolConstruct);
            sortedPoolIdentifiers.push(poolIdentifier);
        }
        util_1.log.debug(`getPools called with ${poolConstructs.length} token pairs. Deduped down to ${poolIdentifierSet.size}`);
        const [slot0Results, liquidityResults] = await Promise.all([
            this.getPoolsData(sortedPoolIdentifiers, this.getSlot0FunctionName(), providerConfig),
            this.getPoolsData(sortedPoolIdentifiers, this.getLiquidityFunctionName(), providerConfig),
        ]);
        util_1.log.info(`Got liquidity and slot0s for ${poolIdentifierSet.size} pools ${(providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber)
            ? `as of block: ${providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber}.`
            : ``}`);
        const poolIdentifierToPool = {};
        const invalidPools = [];
        for (let i = 0; i < sortedPoolIdentifiers.length; i++) {
            const slot0Result = slot0Results[i];
            const liquidityResult = liquidityResults[i];
            // These properties tell us if a pool is valid and initialized or not.
            if (!(slot0Result === null || slot0Result === void 0 ? void 0 : slot0Result.success) ||
                !(liquidityResult === null || liquidityResult === void 0 ? void 0 : liquidityResult.success) ||
                slot0Result.result.sqrtPriceX96.eq(0)) {
                invalidPools.push(sortedCurrencyPairs[i]);
                continue;
            }
            const slot0 = slot0Result.result;
            const liquidity = liquidityResult.result[0];
            const pool = this.instantiatePool(sortedCurrencyPairs[i], slot0, liquidity);
            const poolIdentifier = sortedPoolIdentifiers[i];
            poolIdentifierToPool[poolIdentifier] = pool;
        }
        const poolStrs = lodash_1.default.map(Object.values(poolIdentifierToPool), util_1.poolToString);
        util_1.log.debug({ poolStrs }, `Found ${poolStrs.length} valid pools`);
        return this.instantiatePoolAccessor(poolIdentifierToPool);
    }
}
exports.PoolProvider = PoolProvider;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9vbC1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9wcm92aWRlcnMvcG9vbC1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFJQSxvREFBdUI7QUFFdkIsa0NBQTRDO0FBbUI1QyxNQUFzQixZQUFZO0lBT2hDOzs7O09BSUc7SUFDSCxZQUNZLE9BQWdCLEVBQ2hCLGtCQUFzQyxFQUN0QyxlQUE2QjtRQUNyQyxPQUFPLEVBQUUsQ0FBQztRQUNWLFVBQVUsRUFBRSxFQUFFO1FBQ2QsVUFBVSxFQUFFLEdBQUc7S0FDaEI7UUFOUyxZQUFPLEdBQVAsT0FBTyxDQUFTO1FBQ2hCLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBb0I7UUFDdEMsaUJBQVksR0FBWixZQUFZLENBSXJCO0lBQ0EsQ0FBQztJQUVNLEtBQUssQ0FBQyxnQkFBZ0IsQ0FDOUIsY0FBZ0MsRUFDaEMsY0FBK0I7UUFFL0IsTUFBTSxpQkFBaUIsR0FBZ0IsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUN6RCxNQUFNLG1CQUFtQixHQUEwQixFQUFFLENBQUM7UUFDdEQsTUFBTSxxQkFBcUIsR0FBYSxFQUFFLENBQUM7UUFFM0MsS0FBSyxNQUFNLGFBQWEsSUFBSSxjQUFjLEVBQUU7WUFDMUMsTUFBTSxFQUNKLGNBQWMsRUFBRSxjQUFjLEVBQzlCLFNBQVMsRUFDVCxTQUFTLEdBQ1YsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsYUFBYSxDQUFDLENBQUM7WUFFMUMsSUFBSSxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLEVBQUU7Z0JBQ3pDLFNBQVM7YUFDVjtZQUVELCtIQUErSDtZQUMvSCxhQUFhLENBQUMsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDO1lBQzdCLGFBQWEsQ0FBQyxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUM7WUFDN0IsaUJBQWlCLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQ3RDLG1C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