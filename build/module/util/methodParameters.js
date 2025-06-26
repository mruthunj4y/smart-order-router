import { MixedRouteSDK, Protocol, SwapRouter as SwapRouter02, Trade, } from '@surge/router-sdk';
import { TradeType } from '@surge/sdk-core';
import { UNIVERSAL_ROUTER_ADDRESS, SwapRouter as UniversalRouter, } from '@surge/universal-router-sdk';
import { Route as V2RouteRaw } from '@surge/v2-sdk';
import { Route as V3RouteRaw } from '@surge/v3-sdk';
import _ from 'lodash';
import { CurrencyAmount, SWAP_ROUTER_02_ADDRESSES, SwapType, } from '..';
export function buildTrade(tokenInCurrency, tokenOutCurrency, tradeType, routeAmounts) {
    /// Removed partition because of new mixedRoutes
    const v3RouteAmounts = _.filter(routeAmounts, (routeAmount) => routeAmount.protocol === Protocol.V3);
    const v2RouteAmounts = _.filter(routeAmounts, (routeAmount) => routeAmount.protocol === Protocol.V2);
    const mixedRouteAmounts = _.filter(routeAmounts, (routeAmount) => routeAmount.protocol === Protocol.MIXED);
    const v3Routes = _.map(v3RouteAmounts, (routeAmount) => {
        const { route, amount, quote } = routeAmount;
        // The route, amount and quote are all in terms of wrapped tokens.
        // When constructing the Trade object the inputAmount/outputAmount must
        // use native currencies if specified by the user. This is so that the Trade knows to wrap/unwrap.
        if (tradeType == TradeType.EXACT_INPUT) {
            const amountCurrency = CurrencyAmount.fromFractionalAmount(tokenInCurrency, amount.numerator, amount.denominator);
            const quoteCurrency = CurrencyAmount.fromFractionalAmount(tokenOutCurrency, quote.numerator, quote.denominator);
            const routeRaw = new V3RouteRaw(route.pools, amountCurrency.currency, quoteCurrency.currency);
            return {
                routev3: routeRaw,
                inputAmount: amountCurrency,
                outputAmount: quoteCurrency,
            };
        }
        else {
            const quoteCurrency = CurrencyAmount.fromFractionalAmount(tokenInCurrency, quote.numerator, quote.denominator);
            const amountCurrency = CurrencyAmount.fromFractionalAmount(tokenOutCurrency, amount.numerator, amount.denominator);
            const routeCurrency = new V3RouteRaw(route.pools, quoteCurrency.currency, amountCurrency.currency);
            return {
                routev3: routeCurrency,
                inputAmount: quoteCurrency,
                outputAmount: amountCurrency,
            };
        }
    });
    const v2Routes = _.map(v2RouteAmounts, (routeAmount) => {
        const { route, amount, quote } = routeAmount;
        // The route, amount and quote are all in terms of wrapped tokens.
        // When constructing the Trade object the inputAmount/outputAmount must
        // use native currencies if specified by the user. This is so that the Trade knows to wrap/unwrap.
        if (tradeType == TradeType.EXACT_INPUT) {
            const amountCurrency = CurrencyAmount.fromFractionalAmount(tokenInCurrency, amount.numerator, amount.denominator);
            const quoteCurrency = CurrencyAmount.fromFractionalAmount(tokenOutCurrency, quote.numerator, quote.denominator);
            const routeV2SDK = new V2RouteRaw(route.pairs, amountCurrency.currency, quoteCurrency.currency);
            return {
                routev2: routeV2SDK,
                inputAmount: amountCurrency,
                outputAmount: quoteCurrency,
            };
        }
        else {
            const quoteCurrency = CurrencyAmount.fromFractionalAmount(tokenInCurrency, quote.numerator, quote.denominator);
            const amountCurrency = CurrencyAmount.fromFractionalAmount(tokenOutCurrency, amount.numerator, amount.denominator);
            const routeV2SDK = new V2RouteRaw(route.pairs, quoteCurrency.currency, amountCurrency.currency);
            return {
                routev2: routeV2SDK,
                inputAmount: quoteCurrency,
                outputAmount: amountCurrency,
            };
        }
    });
    const mixedRoutes = _.map(mixedRouteAmounts, (routeAmount) => {
        const { route, amount, quote } = routeAmount;
        if (tradeType != TradeType.EXACT_INPUT) {
            throw new Error('Mixed routes are only supported for exact input trades');
        }
        // The route, amount and quote are all in terms of wrapped tokens.
        // When constructing the Trade object the inputAmount/outputAmount must
        // use native currencies if specified by the user. This is so that the Trade knows to wrap/unwrap.
        const amountCurrency = CurrencyAmount.fromFractionalAmount(tokenInCurrency, amount.numerator, amount.denominator);
        const quoteCurrency = CurrencyAmount.fromFractionalAmount(tokenOutCurrency, quote.numerator, quote.denominator);
        const routeRaw = new MixedRouteSDK(route.pools, amountCurrency.currency, quoteCurrency.currency);
        return {
            mixedRoute: routeRaw,
            inputAmount: amountCurrency,
            outputAmount: quoteCurrency,
        };
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const trade = new Trade({
        v2Routes,
        v3Routes,
        mixedRoutes,
        tradeType,
    });
    return trade;
}
export function buildSwapMethodParameters(trade, swapConfig, chainId) {
    if (swapConfig.type == SwapType.UNIVERSAL_ROUTER) {
        return {
            ...UniversalRouter.swapERC20CallParameters(trade, swapConfig),
            to: UNIVERSAL_ROUTER_ADDRESS(chainId),
        };
    }
    else if (swapConfig.type == SwapType.SWAP_ROUTER_02) {
        const { recipient, slippageTolerance, deadline, inputTokenPermit } = swapConfig;
        return {
            ...SwapRouter02.swapCallParameters(trade, {
                recipient,
                slippageTolerance,
                deadlineOrPreviousBlockhash: deadline,
                inputTokenPermit,
            }),
            to: SWAP_ROUTER_02_ADDRESSES(chainId),
        };
    }
    throw new Error(`Unsupported swap type ${swapConfig}`);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0aG9kUGFyYW1ldGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy91dGlsL21ldGhvZFBhcmFtZXRlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUNMLGFBQWEsRUFDYixRQUFRLEVBQ1IsVUFBVSxJQUFJLFlBQVksRUFDMUIsS0FBSyxHQUNOLE1BQU0sbUJBQW1CLENBQUM7QUFDM0IsT0FBTyxFQUFxQixTQUFTLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMvRCxPQUFPLEVBQ0wsd0JBQXdCLEVBQ3hCLFVBQVUsSUFBSSxlQUFlLEdBQzlCLE1BQU0sNkJBQTZCLENBQUM7QUFDckMsT0FBTyxFQUFFLEtBQUssSUFBSSxVQUFVLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDcEQsT0FBTyxFQUFFLEtBQUssSUFBSSxVQUFVLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDcEQsT0FBTyxDQUFDLE1BQU0sUUFBUSxDQUFDO0FBRXZCLE9BQU8sRUFDTCxjQUFjLEVBSWQsd0JBQXdCLEVBRXhCLFFBQVEsR0FHVCxNQUFNLElBQUksQ0FBQztBQUVaLE1BQU0sVUFBVSxVQUFVLENBQ3hCLGVBQXlCLEVBQ3pCLGdCQUEwQixFQUMxQixTQUFxQixFQUNyQixZQUFtQztJQUVuQyxnREFBZ0Q7SUFDaEQsTUFBTSxjQUFjLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FDN0IsWUFBWSxFQUNaLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsUUFBUSxLQUFLLFFBQVEsQ0FBQyxFQUFFLENBQ3RELENBQUM7SUFDRixNQUFNLGNBQWMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUM3QixZQUFZLEVBQ1osQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxRQUFRLEtBQUssUUFBUSxDQUFDLEVBQUUsQ0FDdEQsQ0FBQztJQUNGLE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FDaEMsWUFBWSxF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