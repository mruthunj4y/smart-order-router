"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.V2HeuristicGasModelFactory = exports.COST_PER_EXTRA_HOP = exports.BASE_SWAP_COST = void 0;
const bignumber_1 = require("@ethersproject/bignumber");
const lodash_1 = __importDefault(require("lodash"));
const util_1 = require("../../../../util");
const amounts_1 = require("../../../../util/amounts");
const gas_factory_helpers_1 = require("../../../../util/gas-factory-helpers");
const gas_model_1 = require("../gas-model");
// Constant cost for doing any swap regardless of pools.
exports.BASE_SWAP_COST = bignumber_1.BigNumber.from(135000); // 115000, bumped up by 20_000 @eric 7/8/2022
// Constant per extra hop in the route.
exports.COST_PER_EXTRA_HOP = bignumber_1.BigNumber.from(50000); // 20000, bumped up by 30_000 @eric 7/8/2022
/**
 * Computes a gas estimate for a V2 swap using heuristics.
 * Considers number of hops in the route and the typical base cost for a swap.
 *
 * We compute gas estimates off-chain because
 *  1/ Calling eth_estimateGas for a swaps requires the caller to have
 *     the full balance token being swapped, and approvals.
 *  2/ Tracking gas used using a wrapper contract is not accurate with Multicall
 *     due to EIP-2929. We would have to make a request for every swap we wanted to estimate.
 *  3/ For V2 we simulate all our swaps off-chain so have no way to track gas used.
 *
 * Note, certain tokens e.g. rebasing/fee-on-transfer, may incur higher gas costs than
 * what we estimate here. This is because they run extra logic on token transfer.
 *
 * @export
 * @class V2HeuristicGasModelFactory
 */
class V2HeuristicGasModelFactory extends gas_model_1.IV2GasModelFactory {
    constructor() {
        super();
    }
    async buildGasModel({ chainId, gasPriceWei, poolProvider, token, providerConfig, }) {
        const usdPoolPromise = this.getHighestLiquidityUSDPool(chainId, poolProvider, providerConfig);
        // Only fetch the native gasToken pool if specified by the config AND the gas token is not the native currency.
        const nativeAndSpecifiedGasTokenPoolPromise = (providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.gasToken) &&
            !(providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.gasToken.equals(util_1.WRAPPED_NATIVE_CURRENCY[chainId]))
            ? this.getEthPool(chainId, providerConfig.gasToken, poolProvider, providerConfig)
            : Promise.resolve(null);
        const [usdPool, nativeAndSpecifiedGasTokenPool] = await Promise.all([
            usdPoolPromise,
            nativeAndSpecifiedGasTokenPoolPromise,
        ]);
        let ethPool = null;
        if (!token.equals(util_1.WRAPPED_NATIVE_CURRENCY[chainId])) {
            ethPool = await this.getEthPool(chainId, token, poolProvider, providerConfig);
        }
        const usdToken = usdPool.token0.address == util_1.WRAPPED_NATIVE_CURRENCY[chainId].address
            ? usdPool.token1
            : usdPool.token0;
        const calculateL1GasFees = async (route) => {
            // Ensure token is not undefined
            const wrappedNative = util_1.WRAPPED_NATIVE_CURRENCY[chainId];
            const nativePool = !token.equals(wrappedNative)
                ? await (0, gas_factory_helpers_1.getV2NativePool)(token, poolProvider, providerConfig)
                : null;
            // calculateL1GasFeesHelper expects: route, chainId, usdPool, quoteToken, nativePool, providerConfig?
            return await (0, gas_factory_helpers_1.calculateL1GasFeesHelper)(route, chainId, usdPool, token, nativePool, providerConfig);
        };
        return {
            estimateGasCost: (routeWithValidQuote) => {
                var _a;
                const { gasCostInEth, gasUse } = this.estimateGas(routeWithValidQuote, gasPriceWei, chainId, providerConfig);
                /** ------ MARK: USD logic  -------- */
                const gasCostInTermsOfUSD = (0, gas_model_1.getQuoteThroughNativePool)(chainId, gasCostInEth, usdPool);
                /** ------ MARK: Conditional logic run if gasToken is specified  -------- */
                let gasCostInTermsOfGasToken = undefined;
                if (nativeAndSpecifiedGasTokenPool) {
                    gasCostInTermsOfGasToken = (0, gas_model_1.getQuoteThroughNativePool)(chainId, gasCostInEth, nativeAndSpecifiedGasTokenPool);
                }
                // if the gasToken is the native currency, we can just use the gasCostInEth
                else if ((_a = providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.gasToken) === null || _a === void 0 ? void 0 : _a.equals(util_1.WRAPPED_NATIVE_CURRENCY[chainId])) {
                    gasCostInTermsOfGasToken = gasCostInEth;
                }
                /** ------ MARK: return early if quoteToken is wrapped native currency ------- */
                if (token.equals(util_1.WRAPPED_NATIVE_CURRENCY[chainId])) {
                    return {
                        gasEstimate: gasUse,
                        gasCostInToken: gasCostInEth,
                        gasCostInUSD: gasCostInTermsOfUSD,
                        gasCostInGasToken: gasCostInTermsOfGasToken,
                    };
                }
                // If the quote token is not WETH, we convert the gas cost to be in terms of the quote token.
                // We do this by getting the highest liquidity <token>/ETH pool.
                if (!ethPool) {
                    util_1.log.info('Unable to find ETH pool with the quote token to produce gas adjusted costs. Route will not account for gas.');
                    return {
                        gasEstimate: gasUse,
                        gasCostInToken: amounts_1.CurrencyAmount.fromRawAmount(token, 0),
                        gasCostInUSD: amounts_1.CurrencyAmount.fromRawAmount(usdToken, 0),
                    };
                }
                const gasCostInTermsOfQuoteToken = (0, gas_model_1.getQuoteThroughNativePool)(chainId, gasCostInEth, ethPool);
                return {
                    gasEstimate: gasUse,
                    gasCostInToken: gasCostInTermsOfQuoteToken,
                    gasCostInUSD: gasCostInTermsOfUSD,
                    gasCostInGasToken: gasCostInTermsOfGasToken,
                };
            },
            calculateL1GasFees,
        };
    }
    estimateGas(routeWithValidQuote, gasPriceWei, chainId, providerConfig) {
        const hops = routeWithValidQuote.route.pairs.length;
        let gasUse = exports.BASE_SWAP_COST.add(exports.COST_PER_EXTRA_HOP.mul(hops - 1));
        if (providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.additionalGasOverhead) {
            gasUse = gasUse.add(providerConfig.additionalGasOverhead);
        }
        const totalGasCostWei = gasPriceWei.mul(gasUse);
        const weth = util_1.WRAPPED_NATIVE_CURRENCY[chainId];
        const gasCostInEth = amounts_1.CurrencyAmount.fromRawAmount(weth, totalGasCostWei.toString());
        return { gasCostInEth, gasUse };
    }
    async getEthPool(chainId, token, poolProvider, providerConfig) {
        const weth = util_1.WRAPPED_NATIVE_CURRENCY[chainId];
        const poolAccessor = await poolProvider.getPools([[weth, token]], providerConfig);
        const pool = poolAccessor.getPool(weth, token);
        if (!pool || pool.reserve0.equalTo(0) || pool.reserve1.equalTo(0)) {
            util_1.log.error({
                weth,
                token,
                reserve0: pool === null || pool === void 0 ? void 0 : pool.reserve0.toExact(),
                reserve1: pool === null || pool === void 0 ? void 0 : pool.reserve1.toExact(),
            }, `Could not find a valid WETH pool with ${token.symbol} for computing gas costs.`);
            return null;
        }
        return pool;
    }
    async getHighestLiquidityUSDPool(chainId, poolProvider, providerConfig) {
        const usdTokens = gas_model_1.usdGasTokensByChain[chainId];
        if (!usdTokens) {
            throw new Error(`Could not find a USD token for computing gas costs on ${chainId}`);
        }
        const usdPools = lodash_1.default.map(usdTokens, (usdToken) => [
            usdToken,
            util_1.WRAPPED_NATIVE_CURRENCY[chainId],
        ]);
        const poolAccessor = await poolProvider.getPools(usdPools, providerConfig);
        const poolsRaw = poolAccessor.getAllPools();
        const pools = lodash_1.default.filter(poolsRaw, (pool) => pool.reserve0.greaterThan(0) &&
            pool.reserve1.greaterThan(0) &&
            // this case should never happen in production, but when we mock the pool provider it may return non native pairs
            (pool.token0.equals(util_1.WRAPPED_NATIVE_CURRENCY[chainId]) ||
                pool.token1.equals(util_1.WRAPPED_NATIVE_CURRENCY[chainId])));
        if (pools.length == 0) {
            util_1.log.error({ pools }, `Could not find a USD/WETH pool for computing gas costs.`);
            throw new Error(`Can't find USD/WETH pool for computing gas costs.`);
        }
        const maxPool = lodash_1.default.maxBy(pools, (pool) => {
            if (pool.token0.equals(util_1.WRAPPED_NATIVE_CURRENCY[chainId])) {
                return parseFloat(pool.reserve0.toSignificant(2));
            }
            else {
                return parseFloat(pool.reserve1.toSignificant(2));
            }
        });
        return maxPool;
    }
}
exports.V2HeuristicGasModelFactory = V2HeuristicGasModelFactory;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidjItaGV1cmlzdGljLWdhcy1tb2RlbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9yb3V0ZXJzL2FscGhhLXJvdXRlci9nYXMtbW9kZWxzL3YyL3YyLWhldXJpc3RpYy1nYXMtbW9kZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsd0RBQXFEO0FBR3JELG9EQUF1QjtBQUl2QiwyQ0FBZ0U7QUFDaEUsc0RBQTBEO0FBQzFELDhFQUc4QztBQUU5Qyw0Q0FPc0I7QUFFdEIsd0RBQXdEO0FBQzNDLFFBQUEsY0FBYyxHQUFHLHFCQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsNkNBQTZDO0FBRW5HLHVDQUF1QztBQUMxQixRQUFBLGtCQUFrQixHQUFHLHFCQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsNENBQTRDO0FBRXJHOzs7Ozs7Ozs7Ozs7Ozs7O0dBZ0JHO0FBQ0gsTUFBYSwwQkFBMkIsU0FBUSw4QkFBa0I7SUFFaEU7UUFDRSxLQUFLLEVBQUUsQ0FBQztJQUNWLENBQUM7SUFFTSxLQUFLLENBQUMsYUFBYSxDQUFDLEVBQ3pCLE9BQU8sRUFDUCxXQUFXLEVBQ1gsWUFBWSxFQUNaLEtBQUssRUFDTCxjQUFjLEdBQ2E7UUFFM0IsTUFBTSxjQUFjLEdBQWtCLElBQUksQ0FBQywwQkFBMEIsQ0FDbkUsT0FBTyxFQUNQLFlBQVksRUFDWixjQUFjLENBQ2YsQ0FBQztRQUVGLCtHQUErRztRQUMvRyxNQUFNLHFDQUFxQyxHQUN6QyxDQUFBLGNBQWMsYUFBZCxjQUFjLHVCQUFkLGNBQWMsQ0FBRSxRQUFRO1lBQ3RCLENBQUMsQ0FBQSxjQUFjLGFBQWQsY0FBYyx1QkFBZCxjQUFjLENBQUUsUUFBUSxDQUFDLE1BQU0sQ0FBQyw4QkFBdUIsQ0FBQyxPQUFPLENBQUUsQ0FBQyxDQUFBO1lBQ25FLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUNmLE9B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