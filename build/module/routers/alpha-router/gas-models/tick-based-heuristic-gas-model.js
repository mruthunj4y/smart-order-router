import { BigNumber } from '@ethersproject/bignumber';
import { Price } from '@surge/sdk-core';
import { CurrencyAmount, log, WRAPPED_NATIVE_CURRENCY } from '../../../util';
import { calculateL1GasFeesHelper } from '../../../util/gas-factory-helpers';
import { BASE_SWAP_COST, COST_PER_HOP, COST_PER_INIT_TICK, COST_PER_UNINIT_TICK, SINGLE_HOP_OVERHEAD, TOKEN_OVERHEAD, } from './gas-costs';
import { getQuoteThroughNativePool, IOnChainGasModelFactory, } from './gas-model';
export class TickBasedHeuristicGasModelFactory extends IOnChainGasModelFactory {
    constructor(provider) {
        super();
        this.provider = provider;
    }
    async buildGasModelInternal({ chainId, gasPriceWei, pools, amountToken, quoteToken, providerConfig, }) {
        const usdPool = pools.usdPool;
        const calculateL1GasFees = async (route) => {
            return await calculateL1GasFeesHelper(route, chainId, usdPool, quoteToken, pools.nativeAndQuoteTokenV3Pool, this.provider);
        };
        const nativeCurrency = WRAPPED_NATIVE_CURRENCY[chainId];
        let nativeAmountPool = null;
        if (!amountToken.equals(nativeCurrency)) {
            nativeAmountPool = pools.nativeAndAmountTokenV3Pool;
        }
        const usdToken = usdPool.token0.equals(nativeCurrency)
            ? usdPool.token1
            : usdPool.token0;
        const estimateGasCost = (routeWithValidQuote) => {
            var _a;
            const { totalGasCostNativeCurrency, baseGasUse } = this.estimateGas(routeWithValidQuote, gasPriceWei, chainId, providerConfig);
            /** ------ MARK: USD logic  -------- */
            // We only need to go through V2 and V3 USD pools for now.
            // If one day, we see v3 usd pools have much deeper liquidity than v2/v3 usd pools, then we will add other pools for gas cost
            const gasCostInTermsOfUSD = getQuoteThroughNativePool(chainId, totalGasCostNativeCurrency, usdPool);
            /** ------ MARK: Conditional logic run if gasToken is specified  -------- */
            const nativeAndSpecifiedGasTokenPool = pools.nativeAndSpecifiedGasTokenV3Pool;
            let gasCostInTermsOfGasToken = undefined;
            // we don't want to fetch the gasToken pool if the gasToken is the native currency
            if (nativeAndSpecifiedGasTokenPool) {
                // We only need to go through V2 and V3 USD pools for now.
                // If one day, we see v3 usd pools have much deeper liquidity than v2/v3 usd pools, then we will add other pools for gas cost
                gasCostInTermsOfGasToken = getQuoteThroughNativePool(chainId, totalGasCostNativeCurrency, nativeAndSpecifiedGasTokenPool);
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
            // Since the quote token is not in the native currency, we convert the gas cost to be in terms of the quote token.
            // We do this by getting the highest liquidity <quoteToken>/<nativeCurrency> pool. eg. <quoteToken>/ETH pool.
            const nativeAndQuoteTokenPool = pools.nativeAndQuoteTokenV3Pool;
            let gasCostInTermsOfQuoteToken = null;
            if (nativeAndQuoteTokenPool) {
                // We only need to go through V2 and V3 USD pools for now.
                // If one day, we see v3 usd pools have much deeper liquidity than v2/v3 usd pools, then we will add other pools for gas cost
                gasCostInTermsOfQuoteToken = getQuoteThroughNativePool(chainId, totalGasCostNativeCurrency, nativeAndQuoteTokenPool);
            }
            // We may have a nativeAmountPool, but not a nativePool
            else {
                log.info(`Unable to find ${nativeCurrency.symbol} pool with the quote token, ${quoteToken.symbol} to produce gas adjusted costs. Using amountToken to calculate gas costs.`);
            }
            /** ------ MARK: (V3 ONLY) Logic for calculating synthetic gas cost in terms of amount token -------- */
            // TODO: evaluate effectiveness and potentially refactor
            // Highest liquidity pool for the non quote token / ETH
            // A pool with the non quote token / ETH should not be required and errors should be handled separately
            if (nativeAmountPool) {
                // get current execution price (amountToken / quoteToken)
                const executionPrice = new Price(routeWithValidQuote.amount.currency, routeWithValidQuote.quote.currency, routeWithValidQuote.amount.quotient, routeWithValidQuote.quote.quotient);
                const inputIsToken0 = nativeAmountPool.token0.address == nativeCurrency.address;
                // ratio of input / native
                const nativeAndAmountTokenPrice = inputIsToken0
                    ? nativeAmountPool.token0Price
                    : nativeAmountPool.token1Price;
                const gasCostInTermsOfAmountToken = nativeAndAmountTokenPrice.quote(totalGasCostNativeCurrency);
                // Convert gasCostInTermsOfAmountToken to quote token using execution price
                let syntheticGasCostInTermsOfQuoteToken;
                try {
                    syntheticGasCostInTermsOfQuoteToken = executionPrice.quote(gasCostInTermsOfAmountToken);
                }
                catch (err) {
                    if (err instanceof RangeError &&
                        err.message.includes('Division by zero')) {
                        // If the quote fails (division by zero), set syntheticGasCostInTermsOfQuoteToken to null
                        syntheticGasCostInTermsOfQuoteToken = null;
                    }
                    else {
                        // any other error, throw
                        throw err;
                    }
                }
                // Note that the syntheticGasCost being lessThan the original quoted value is not always strictly better
                // e.g. the scenario where the amountToken/ETH pool is very illiquid as well and returns an extremely small number
                // however, it is better to have the gasEstimation be almost 0 than almost infinity, as the user will still receive a quote
                if (syntheticGasCostInTermsOfQuoteToken !== null &&
                    (gasCostInTermsOfQuoteToken === null ||
                        syntheticGasCostInTermsOfQuoteToken.lessThan(gasCostInTermsOfQuoteToken.asFraction))) {
                    log.info({
                        nativeAndAmountTokenPrice: nativeAndAmountTokenPrice.toSignificant(6),
                        gasCostInTermsOfQuoteToken: gasCostInTermsOfQuoteToken
                            ? gasCostInTermsOfQuoteToken.toExact()
                            : 0,
                        gasCostInTermsOfAmountToken: gasCostInTermsOfAmountToken.toExact(),
                        executionPrice: executionPrice.toSignificant(6),
                        syntheticGasCostInTermsOfQuoteToken: syntheticGasCostInTermsOfQuoteToken === null || syntheticGasCostInTermsOfQuoteToken === void 0 ? void 0 : syntheticGasCostInTermsOfQuoteToken.toSignificant(6),
                    }, 'New gasCostInTermsOfQuoteToken calculated with synthetic quote token price is less than original');
                    gasCostInTermsOfQuoteToken = syntheticGasCostInTermsOfQuoteToken;
                }
            }
            // If gasCostInTermsOfQuoteToken is null, both attempts to calculate gasCostInTermsOfQuoteToken failed (nativePool and amountNativePool)
            if (gasCostInTermsOfQuoteToken === null) {
                log.info(`Unable to find ${nativeCurrency.symbol} pool with the quote token, ${quoteToken.symbol}, or amount Token, ${amountToken.symbol} to produce gas adjusted costs. Route will not account for gas.`);
                return {
                    gasEstimate: baseGasUse,
                    gasCostInToken: CurrencyAmount.fromRawAmount(quoteToken, 0),
                    gasCostInUSD: CurrencyAmount.fromRawAmount(usdToken, 0),
                };
            }
            return {
                gasEstimate: baseGasUse,
                gasCostInToken: gasCostInTermsOfQuoteToken,
                gasCostInUSD: gasCostInTermsOfUSD,
                gasCostInGasToken: gasCostInTermsOfGasToken,
            };
        };
        return {
            estimateGasCost: estimateGasCost.bind(this),
            calculateL1GasFees,
        };
    }
    estimateGas(routeWithValidQuote, gasPriceWei, chainId, providerConfig) {
        var _a;
        const totalInitializedTicksCrossed = this.totalInitializedTicksCrossed(routeWithValidQuote.initializedTicksCrossedList);
        const totalHops = BigNumber.from(routeWithValidQuote.route.pools.length);
        let hopsGasUse = COST_PER_HOP(chainId).mul(totalHops);
        // We have observed that this algorithm tends to underestimate single hop swaps.
        // We add a buffer in the case of a single hop swap.
        if (totalHops.eq(1)) {
            hopsGasUse = hopsGasUse.add(SINGLE_HOP_OVERHEAD(chainId));
        }
        // Some tokens have extremely expensive transferFrom functions, which causes
        // us to underestimate them by a large amount. For known tokens, we apply an
        // adjustment.
        const tokenOverhead = TOKEN_OVERHEAD(chainId);
        const tickGasUse = COST_PER_INIT_TICK(chainId).mul(totalInitializedTicksCrossed);
        const uninitializedTickGasUse = COST_PER_UNINIT_TICK.mul(0);
        /*
        // Eventually we can just use the quoter gas estimate for the base gas use
        // It will be more accurate than doing the offchain gas estimate like below
        // It will become more critical when we are going to support hookful routing,
        // where we have no idea how much gas the hook(s) will cost.
        // const baseGasUse = routeWithValidQuote.quoterGasEstimate
        */
        // base estimate gas used based on chainId estimates for hops and ticks gas useage
        const baseGasUse = BASE_SWAP_COST(chainId)
            .add(hopsGasUse)
            .add(tokenOverhead)
            .add(tickGasUse)
            .add(uninitializedTickGasUse)
            .add((_a = providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.additionalGasOverhead) !== null && _a !== void 0 ? _a : BigNumber.from(0));
        const baseGasCostWei = gasPriceWei.mul(baseGasUse);
        const wrappedCurrency = WRAPPED_NATIVE_CURRENCY[chainId];
        const totalGasCostNativeCurrency = CurrencyAmount.fromRawAmount(wrappedCurrency, baseGasCostWei.toString());
        return {
            totalGasCostNativeCurrency,
            totalInitializedTicksCrossed,
            baseGasUse,
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGljay1iYXNlZC1oZXVyaXN0aWMtZ2FzLW1vZGVsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3JvdXRlcnMvYWxwaGEtcm91dGVyL2dhcy1tb2RlbHMvdGljay1iYXNlZC1oZXVyaXN0aWMtZ2FzLW1vZGVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUVyRCxPQUFPLEVBQVcsS0FBSyxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFHakQsT0FBTyxFQUFFLGNBQWMsRUFBRSxHQUFHLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDN0UsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFHN0UsT0FBTyxFQUNMLGNBQWMsRUFDZCxZQUFZLEVBQ1osa0JBQWtCLEVBQ2xCLG9CQUFvQixFQUNwQixtQkFBbUIsRUFDbkIsY0FBYyxHQUNmLE1BQU0sYUFBYSxDQUFDO0FBQ3JCLE9BQU8sRUFHTCx5QkFBeUIsRUFFekIsdUJBQXVCLEdBQ3hCLE1BQU0sYUFBYSxDQUFDO0FBRXJCLE1BQU0sT0FBZ0IsaUNBRXBCLFNBQVEsdUJBQTZDO0lBR3JELFlBQXNCLFFBQXNCO1FBQzFDLEtBQUssRUFBRSxDQUFDO1FBQ1IsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7SUFDM0IsQ0FBQztJQUVTLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxFQUNwQyxPQUFPLEVBQ1AsV0FBVyxFQUNYLEtBQUssRUFDTCxXQUFXLEVBQ1gsVUFBVSxFQUNWLGNBQWMsR0FDa0I7UUFJaEMsTUFBTSxPQUFPLEdBQVMsS0FBSyxDQUFDLE9BQU8sQ0FBQztRQUVwQyxNQUFNLGtCQUFrQixHQUFHLEtBQUssRUFDOUIsS0FBNkIsRUFNNUIsRUFBRTtZQUNILE9BQU8sTUFBTSx3QkFBd0IsQ0FDbkMsS0FBSyxFQUNMLE9BQU8sRUFDUCxP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