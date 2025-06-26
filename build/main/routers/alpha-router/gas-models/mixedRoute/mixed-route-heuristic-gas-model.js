"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MixedRouteHeuristicGasModelFactory = void 0;
const bignumber_1 = require("@ethersproject/bignumber");
const router_sdk_1 = require("@surge/router-sdk");
const v2_sdk_1 = require("@surge/v2-sdk");
const v3_sdk_1 = require("@surge/v3-sdk");
const jsbi_1 = __importDefault(require("jsbi"));
const __1 = require("../../../..");
const util_1 = require("../../../../util");
const amounts_1 = require("../../../../util/amounts");
const gas_factory_helpers_1 = require("../../../../util/gas-factory-helpers");
const gas_costs_1 = require("../gas-costs");
const gas_model_1 = require("../gas-model");
const v2_heuristic_gas_model_1 = require("../v2/v2-heuristic-gas-model");
/**
 * Computes a gas estimate for a mixed route swap using heuristics.
 * Considers number of hops in the route, number of ticks crossed
 * and the typical base cost for a swap.
 *
 * We get the number of ticks crossed in a swap from the MixedRouteQuoterV1
 * contract.
 *
 * We compute gas estimates off-chain because
 *  1/ Calling eth_estimateGas for a swaps requires the caller to have
 *     the full balance token being swapped, and approvals.
 *  2/ Tracking gas used using a wrapper contract is not accurate with Multicall
 *     due to EIP-2929. We would have to make a request for every swap we wanted to estimate.
 *  3/ For V2 we simulate all our swaps off-chain so have no way to track gas used.
 *
 * @export
 * @class MixedRouteHeuristicGasModelFactory
 */
class MixedRouteHeuristicGasModelFactory extends gas_model_1.IOnChainGasModelFactory {
    async buildGasModel({ chainId, gasPriceWei, pools, quoteToken, v2poolProvider: V2poolProvider, providerConfig, }) {
        const nativeCurrency = __1.WRAPPED_NATIVE_CURRENCY[chainId];
        const usdPool = pools.usdPool;
        const usdToken = usdPool.token0.equals(nativeCurrency)
            ? usdPool.token1
            : usdPool.token0;
        let nativeV2Pool;
        // Avoid fetching for a (WETH,WETH) pool here, we handle the quoteToken = wrapped native case in estimateGasCost
        if (!quoteToken.equals(nativeCurrency) && V2poolProvider) {
            /// MixedRoutes
            nativeV2Pool = await (0, gas_factory_helpers_1.getV2NativePool)(quoteToken, V2poolProvider, providerConfig);
        }
        const estimateGasCost = (routeWithValidQuote) => {
            var _a;
            const { totalGasCostNativeCurrency, baseGasUse } = this.estimateGas(routeWithValidQuote, gasPriceWei, chainId, providerConfig);
            /** ------ MARK: USD Logic -------- */
            const gasCostInTermsOfUSD = (0, gas_model_1.getQuoteThroughNativePool)(chainId, totalGasCostNativeCurrency, usdPool);
            /** ------ MARK: Conditional logic run if gasToken is specified  -------- */
            const nativeAndSpecifiedGasTokenPool = pools.nativeAndSpecifiedGasTokenV3Pool;
            let gasCostInTermsOfGasToken = undefined;
            if (nativeAndSpecifiedGasTokenPool) {
                gasCostInTermsOfGasToken = (0, gas_model_1.getQuoteThroughNativePool)(chainId, totalGasCostNativeCurrency, nativeAndSpecifiedGasTokenPool);
            }
            // if the gasToken is the native currency, we can just use the totalGasCostNativeCurrency
            else if ((_a = providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.gasToken) === null || _a === void 0 ? void 0 : _a.equals(nativeCurrency)) {
                gasCostInTermsOfGasToken = totalGasCostNativeCurrency;
            }
            /** ------ MARK: return early if quoteToken is wrapped native currency ------- */
            if (quoteToken.equals(nativeCurrency)) {
                return {
                    gasEstimate: baseGasUse,
                    gasCostInToken: totalGasCostNativeCurrency,
                    gasCostInUSD: gasCostInTermsOfUSD,
                    gasCostInGasToken: gasCostInTermsOfGasToken,
                };
            }
            /** ------ MARK: Main gas logic in terms of quote token -------- */
            // If the quote token is not in the native currency, we convert the gas cost to be in terms of the quote token.
            // We do this by getting the highest liquidity <quoteToken>/<nativeCurrency> pool. eg. <quoteToken>/ETH pool.
            const nativeV3Pool = pools.nativeAndQuoteTokenV3Pool;
            if (!nativeV3Pool && !nativeV2Pool) {
                util_1.log.info(`Unable to find ${nativeCurrency.symbol} pool with the quote token, ${quoteToken.symbol} to produce gas adjusted costs. Route will not account for gas.`);
                return {
                    gasEstimate: baseGasUse,
                    gasCostInToken: amounts_1.CurrencyAmount.fromRawAmount(quoteToken, 0),
                    gasCostInUSD: amounts_1.CurrencyAmount.fromRawAmount(usdToken, 0),
                };
            }
            /// we will use nativeV2Pool for fallback if nativeV3 does not exist or has 0 liquidity
            /// can use ! here because we return above if v3Pool and v2Pool are null
            const nativePool = (!nativeV3Pool || jsbi_1.default.equal(nativeV3Pool.liquidity, jsbi_1.default.BigInt(0))) &&
                nativeV2Pool
                ? nativeV2Pool
                : nativeV3Pool;
            const gasCostInTermsOfQuoteToken = (0, gas_model_1.getQuoteThroughNativePool)(chainId, totalGasCostNativeCurrency, nativePool);
            return {
                gasEstimate: baseGasUse,
                gasCostInToken: gasCostInTermsOfQuoteToken,
                gasCostInUSD: gasCostInTermsOfUSD,
                gasCostInGasToken: gasCostInTermsOfGasToken,
            };
        };
        return {
            estimateGasCost: estimateGasCost.bind(this),
        };
    }
    estimateGas(routeWithValidQuote, gasPriceWei, chainId, providerConfig) {
        const totalInitializedTicksCrossed = this.totalInitializedTicksCrossed(routeWithValidQuote.initializedTicksCrossedList);
        /**
         * Since we must make a separate call to multicall for each v3 and v2 section, we will have to
         * add the BASE_SWAP_COST to each section.
         */
        let baseGasUseV2Only = bignumber_1.BigNumber.from(0);
        let baseGasUseV3Only = bignumber_1.BigNumber.from(0);
        let baseGasUse = bignumber_1.BigNumber.from(0);
        const route = routeWithValidQuote.route;
        const res = (0, router_sdk_1.partitionMixedRouteByProtocol)(route);
        res.map((section) => {
            if (section.every((pool) => pool instanceof v3_sdk_1.Pool)) {
                baseGasUseV3Only = baseGasUseV3Only.add((0, gas_costs_1.BASE_SWAP_COST)(chainId));
                baseGasUseV3Only = baseGasUseV3Only.add((0, gas_costs_1.COST_PER_HOP)(chainId).mul(section.length));
                baseGasUse = baseGasUse.add(baseGasUseV3Only);
            }
            else if (section.every((pool) => pool instanceof v2_sdk_1.Pair)) {
                baseGasUseV2Only = baseGasUseV2Only.add(v2_heuristic_gas_model_1.BASE_SWAP_COST);
                baseGasUseV2Only = baseGasUseV2Only.add(
                /// same behavior in v2 heuristic gas model factory
                v2_heuristic_gas_model_1.COST_PER_EXTRA_HOP.mul(section.length - 1));
                baseGasUse = baseGasUse.add(baseGasUseV2Only);
            }
        });
        const tickGasUse = (0, gas_costs_1.COST_PER_INIT_TICK)(chainId).mul(totalInitializedTicksCrossed);
        const uninitializedTickGasUse = gas_costs_1.COST_PER_UNINIT_TICK.mul(0);
        // base estimate gas used based on chainId estimates for hops and ticks gas useage
        baseGasUse = baseGasUse.add(tickGasUse).add(uninitializedTickGasUse);
        if (providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.additionalGasOverhead) {
            baseGasUse = baseGasUse.add(providerConfig.additionalGasOverhead);
        }
        const baseGasCostWei = gasPriceWei.mul(baseGasUse);
        const wrappedCurrency = __1.WRAPPED_NATIVE_CURRENCY[chainId];
        const totalGasCostNativeCurrency = amounts_1.CurrencyAmount.fromRawAmount(wrappedCurrency, baseGasCostWei.toString());
        return {
            totalGasCostNativeCurrency,
            totalInitializedTicksCrossed,
            baseGasUse,
        };
    }
}
exports.MixedRouteHeuristicGasModelFactory = MixedRouteHeuristicGasModelFactory;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWl4ZWQtcm91dGUtaGV1cmlzdGljLWdhcy1tb2RlbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9yb3V0ZXJzL2FscGhhLXJvdXRlci9nYXMtbW9kZWxzL21peGVkUm91dGUvbWl4ZWQtcm91dGUtaGV1cmlzdGljLWdhcy1tb2RlbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSx3REFBcUQ7QUFDckQsa0RBQWtFO0FBRWxFLDBDQUFxQztBQUNyQywwQ0FBK0M7QUFDL0MsZ0RBQXdCO0FBRXhCLG1DQUFzRDtBQUN0RCwyQ0FBOEM7QUFDOUMsc0RBQTBEO0FBQzFELDhFQUF1RTtBQUV2RSw0Q0FLc0I7QUFDdEIsNENBTXNCO0FBQ3RCLHlFQUdzQztBQUV0Qzs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FpQkc7QUFDSCxNQUFhLGtDQUFtQyxTQUFRLG1DQUFpRDtJQUNoRyxLQUFLLENBQUMsYUFBYSxDQUFDLEVBQ3pCLE9BQU8sRUFDUCxXQUFXLEVBQ1gsS0FBSyxFQUNMLFVBQVUsRUFDVixjQUFjLEVBQUUsY0FBYyxFQUM5QixjQUFjLEdBQ2tCO1FBR2hDLE1BQU0sY0FBYyxHQUFHLDJCQUF1QixDQUFDLE9BQU8sQ0FBRSxDQUFDO1FBQ3pELE1BQU0sT0FBTyxHQUFXLEtBQUssQ0FBQyxPQUFPLENBQUM7UUFDdEMsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDO1lBQ3BELENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTTtZQUNoQixDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztRQUVuQixJQUFJLFlBQXlCLENBQUM7UUFDOUIsZ0hBQWdIO1FBQ2hILElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLGNBQWMsRUFBRTtZQUN4RCxlQUFlO1lBQ2YsWUFBWSxHQUFHLE1BQU0sSUFBQSxxQ0FBZSxFQUNsQyxVQUFVLEVB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