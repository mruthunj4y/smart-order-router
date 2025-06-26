import { BigNumber } from '@ethersproject/bignumber';
import _ from 'lodash';
import { log, WRAPPED_NATIVE_CURRENCY } from '../../../../util';
import { CurrencyAmount } from '../../../../util/amounts';
import { calculateL1GasFeesHelper, getV2NativePool, } from '../../../../util/gas-factory-helpers';
import { getQuoteThroughNativePool, IV2GasModelFactory, usdGasTokensByChain, } from '../gas-model';
// Constant cost for doing any swap regardless of pools.
export const BASE_SWAP_COST = BigNumber.from(135000); // 115000, bumped up by 20_000 @eric 7/8/2022
// Constant per extra hop in the route.
export const COST_PER_EXTRA_HOP = BigNumber.from(50000); // 20000, bumped up by 30_000 @eric 7/8/2022
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
export class V2HeuristicGasModelFactory extends IV2GasModelFactory {
    constructor() {
        super();
    }
    async buildGasModel({ chainId, gasPriceWei, poolProvider, token, providerConfig, }) {
        const usdPoolPromise = this.getHighestLiquidityUSDPool(chainId, poolProvider, providerConfig);
        // Only fetch the native gasToken pool if specified by the config AND the gas token is not the native currency.
        const nativeAndSpecifiedGasTokenPoolPromise = (providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.gasToken) &&
            !(providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.gasToken.equals(WRAPPED_NATIVE_CURRENCY[chainId]))
            ? this.getEthPool(chainId, providerConfig.gasToken, poolProvider, providerConfig)
            : Promise.resolve(null);
        const [usdPool, nativeAndSpecifiedGasTokenPool] = await Promise.all([
            usdPoolPromise,
            nativeAndSpecifiedGasTokenPoolPromise,
        ]);
        let ethPool = null;
        if (!token.equals(WRAPPED_NATIVE_CURRENCY[chainId])) {
            ethPool = await this.getEthPool(chainId, token, poolProvider, providerConfig);
        }
        const usdToken = usdPool.token0.address == WRAPPED_NATIVE_CURRENCY[chainId].address
            ? usdPool.token1
            : usdPool.token0;
        const calculateL1GasFees = async (route) => {
            // Ensure token is not undefined
            const wrappedNative = WRAPPED_NATIVE_CURRENCY[chainId];
            const nativePool = !token.equals(wrappedNative)
                ? await getV2NativePool(token, poolProvider, providerConfig)
                : null;
            // calculateL1GasFeesHelper expects: route, chainId, usdPool, quoteToken, nativePool, providerConfig?
            return await calculateL1GasFeesHelper(route, chainId, usdPool, token, nativePool, providerConfig);
        };
        return {
            estimateGasCost: (routeWithValidQuote) => {
                var _a;
                const { gasCostInEth, gasUse } = this.estimateGas(routeWithValidQuote, gasPriceWei, chainId, providerConfig);
                /** ------ MARK: USD logic  -------- */
                const gasCostInTermsOfUSD = getQuoteThroughNativePool(chainId, gasCostInEth, usdPool);
                /** ------ MARK: Conditional logic run if gasToken is specified  -------- */
                let gasCostInTermsOfGasToken = undefined;
                if (nativeAndSpecifiedGasTokenPool) {
                    gasCostInTermsOfGasToken = getQuoteThroughNativePool(chainId, gasCostInEth, nativeAndSpecifiedGasTokenPool);
                }
                // if the gasToken is the native currency, we can just use the gasCostInEth
                else if ((_a = providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.gasToken) === null || _a === void 0 ? void 0 : _a.equals(WRAPPED_NATIVE_CURRENCY[chainId])) {
                    gasCostInTermsOfGasToken = gasCostInEth;
                }
                /** ------ MARK: return early if quoteToken is wrapped native currency ------- */
                if (token.equals(WRAPPED_NATIVE_CURRENCY[chainId])) {
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
                    log.info('Unable to find ETH pool with the quote token to produce gas adjusted costs. Route will not account for gas.');
                    return {
                        gasEstimate: gasUse,
                        gasCostInToken: CurrencyAmount.fromRawAmount(token, 0),
                        gasCostInUSD: CurrencyAmount.fromRawAmount(usdToken, 0),
                    };
                }
                const gasCostInTermsOfQuoteToken = getQuoteThroughNativePool(chainId, gasCostInEth, ethPool);
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
        let gasUse = BASE_SWAP_COST.add(COST_PER_EXTRA_HOP.mul(hops - 1));
        if (providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.additionalGasOverhead) {
            gasUse = gasUse.add(providerConfig.additionalGasOverhead);
        }
        const totalGasCostWei = gasPriceWei.mul(gasUse);
        const weth = WRAPPED_NATIVE_CURRENCY[chainId];
        const gasCostInEth = CurrencyAmount.fromRawAmount(weth, totalGasCostWei.toString());
        return { gasCostInEth, gasUse };
    }
    async getEthPool(chainId, token, poolProvider, providerConfig) {
        const weth = WRAPPED_NATIVE_CURRENCY[chainId];
        const poolAccessor = await poolProvider.getPools([[weth, token]], providerConfig);
        const pool = poolAccessor.getPool(weth, token);
        if (!pool || pool.reserve0.equalTo(0) || pool.reserve1.equalTo(0)) {
            log.error({
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
        const usdTokens = usdGasTokensByChain[chainId];
        if (!usdTokens) {
            throw new Error(`Could not find a USD token for computing gas costs on ${chainId}`);
        }
        const usdPools = _.map(usdTokens, (usdToken) => [
            usdToken,
            WRAPPED_NATIVE_CURRENCY[chainId],
        ]);
        const poolAccessor = await poolProvider.getPools(usdPools, providerConfig);
        const poolsRaw = poolAccessor.getAllPools();
        const pools = _.filter(poolsRaw, (pool) => pool.reserve0.greaterThan(0) &&
            pool.reserve1.greaterThan(0) &&
            // this case should never happen in production, but when we mock the pool provider it may return non native pairs
            (pool.token0.equals(WRAPPED_NATIVE_CURRENCY[chainId]) ||
                pool.token1.equals(WRAPPED_NATIVE_CURRENCY[chainId])));
        if (pools.length == 0) {
            log.error({ pools }, `Could not find a USD/WETH pool for computing gas costs.`);
            throw new Error(`Can't find USD/WETH pool for computing gas costs.`);
        }
        const maxPool = _.maxBy(pools, (pool) => {
            if (pool.token0.equals(WRAPPED_NATIVE_CURRENCY[chainId])) {
                return parseFloat(pool.reserve0.toSignificant(2));
            }
            else {
                return parseFloat(pool.reserve1.toSignificant(2));
            }
        });
        return maxPool;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidjItaGV1cmlzdGljLWdhcy1tb2RlbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9yb3V0ZXJzL2FscGhhLXJvdXRlci9nYXMtbW9kZWxzL3YyL3YyLWhldXJpc3RpYy1nYXMtbW9kZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBR3JELE9BQU8sQ0FBQyxNQUFNLFFBQVEsQ0FBQztBQUl2QixPQUFPLEVBQUUsR0FBRyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDaEUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzFELE9BQU8sRUFDTCx3QkFBd0IsRUFDeEIsZUFBZSxHQUNoQixNQUFNLHNDQUFzQyxDQUFDO0FBRTlDLE9BQU8sRUFHTCx5QkFBeUIsRUFFekIsa0JBQWtCLEVBQ2xCLG1CQUFtQixHQUNwQixNQUFNLGNBQWMsQ0FBQztBQUV0Qix3REFBd0Q7QUFDeEQsTUFBTSxDQUFDLE1BQU0sY0FBYyxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyw2Q0FBNkM7QUFFbkcsdUNBQXVDO0FBQ3ZDLE1BQU0sQ0FBQyxNQUFNLGtCQUFrQixHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyw0Q0FBNEM7QUFFckc7Ozs7Ozs7Ozs7Ozs7Ozs7R0FnQkc7QUFDSCxNQUFNLE9BQU8sMEJBQTJCLFNBQVEsa0JBQWtCO0lBRWhFO1FBQ0UsS0FBSyxFQUFFLENBQUM7SUFDVixDQUFDO0lBRU0sS0FBSyxDQUFDLGFBQWEsQ0FBQyxFQUN6QixPQUFPLEVBQ1AsV0FBVyxFQUNYLFlBQVksRUFDWixLQUFLLEVBQ0wsY0FBYyxHQUNhO1FBRTNCLE1BQU0sY0FBYyxHQUFrQixJQUFJLENBQUMsMEJBQTBCLENBQ25FLE9BQU8sRUFDUCxZ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