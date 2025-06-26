"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortionProvider = void 0;
const router_sdk_1 = require("@surge/router-sdk");
const sdk_core_1 = require("@surge/sdk-core");
const routers_1 = require("../routers");
const util_1 = require("../util");
class PortionProvider {
    getPortionAmount(tokenOutAmount, tradeType, externalTransferFailed, feeTakenOnTransfer, swapConfig) {
        if (externalTransferFailed ||
            feeTakenOnTransfer ||
            (swapConfig === null || swapConfig === void 0 ? void 0 : swapConfig.type) !== routers_1.SwapType.UNIVERSAL_ROUTER) {
            return undefined;
        }
        const swapConfigUniversalRouter = swapConfig;
        switch (tradeType) {
            case sdk_core_1.TradeType.EXACT_INPUT:
                if (swapConfigUniversalRouter.fee &&
                    swapConfigUniversalRouter.fee.fee.greaterThan(router_sdk_1.ZERO)) {
                    return tokenOutAmount.multiply(swapConfigUniversalRouter.fee.fee);
                }
                return undefined;
            case sdk_core_1.TradeType.EXACT_OUTPUT:
                if (swapConfigUniversalRouter.fee &&
                    swapConfigUniversalRouter.fee.fee.greaterThan(router_sdk_1.ZERO)) {
                    return tokenOutAmount.multiply(swapConfigUniversalRouter.fee.fee);
                }
                return undefined;
            default:
                throw new Error(`Unknown trade type ${tradeType}`);
        }
    }
    getPortionQuoteAmount(tradeType, quote, portionAdjustedAmount, portionAmount) {
        if (!portionAmount) {
            return undefined;
        }
        // this method can only be called for exact out
        // for exact in, there is no need to compute the portion quote amount, since portion is always against token out amount
        if (tradeType !== sdk_core_1.TradeType.EXACT_OUTPUT) {
            return undefined;
        }
        // 1. then we know portion amount and portion adjusted exact out amount,
        //    we can get a ratio
        //    i.e. portionToPortionAdjustedAmountRatio = portionAmountToken / portionAdjustedAmount
        const portionToPortionAdjustedAmountRatio = new sdk_core_1.Fraction(portionAmount.quotient, portionAdjustedAmount.quotient);
        // 2. we have the portionAmountToken / portionAdjustedAmount ratio
        //    then we can estimate the portion amount for quote, i.e. what is the estimated token in amount deducted for the portion
        //    this amount will be portionQuoteAmountToken = portionAmountToken / portionAdjustedAmount * quote
        //    CAVEAT: we prefer to use the quote currency amount OVER quote gas adjusted currency amount for the formula
        //    because the portion amount calculated from the exact out has no way to account for the gas units.
        return util_1.CurrencyAmount.fromRawAmount(quote.currency, portionToPortionAdjustedAmountRatio.multiply(quote).quotient);
    }
    getRouteWithQuotePortionAdjusted(tradeType, routeWithQuotes, swapConfig, providerConfig) {
        // the route with quote portion adjustment is only needed for exact in routes with quotes
        // because the route with quotes does not know the output amount needs to subtract the portion amount
        if (tradeType !== sdk_core_1.TradeType.EXACT_INPUT) {
            return routeWithQuotes;
        }
        // the route with quote portion adjustment is only needed for universal router
        // for swap router 02, it doesn't have portion-related commands
        if ((swapConfig === null || swapConfig === void 0 ? void 0 : swapConfig.type) !== routers_1.SwapType.UNIVERSAL_ROUTER) {
            return routeWithQuotes;
        }
        return routeWithQuotes.map((routeWithQuote) => {
            const portionAmount = this.getPortionAmount(routeWithQuote.quote, tradeType, providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.externalTransferFailed, providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.feeTakenOnTransfer, swapConfig);
            // This is a sub-optimal solution agreed among the teams to work around the exact in
            // portion amount issue for universal router.
            // The most optimal solution is to update router-sdk https://github.com/Uniswap/router-sdk/blob/main/src/entities/trade.ts#L215
            // `minimumAmountOut` to include portionBips as well, `public minimumAmountOut(slippageTolerance: Percent, amountOut = this.outputAmount, portionBips: Percent)
            // but this will require a new release of router-sdk, and bump router-sdk versions in across downstream dependencies across the stack.
            // We opt to use this sub-optimal solution for now, and revisit the optimal solution in the future.
            // Since SOR subtracts portion amount from EACH route output amount (note the routeWithQuote.quote above),
            // SOR will have as accurate ouput amount per route as possible, which helps with the final `minimumAmountOut`
            if (portionAmount) {
                routeWithQuote.quote = routeWithQuote.quote.subtract(portionAmount);
            }
            return routeWithQuote;
        });
    }
    getQuote(tradeType, quote, portionQuoteAmount) {
        switch (tradeType) {
            case sdk_core_1.TradeType.EXACT_INPUT:
                return quote;
            case sdk_core_1.TradeType.EXACT_OUTPUT:
                return portionQuoteAmount ? quote.subtract(portionQuoteAmount) : quote;
            default:
                throw new Error(`Unknown trade type ${tradeType}`);
        }
    }
    getQuoteGasAdjusted(tradeType, quoteGasAdjusted, portionQuoteAmount) {
        switch (tradeType) {
            case sdk_core_1.TradeType.EXACT_INPUT:
                return quoteGasAdjusted;
            case sdk_core_1.TradeType.EXACT_OUTPUT:
                return portionQuoteAmount
                    ? quoteGasAdjusted.subtract(portionQuoteAmount)
                    : quoteGasAdjusted;
            default:
                throw new Error(`Unknown trade type ${tradeType}`);
        }
    }
    getQuoteGasAndPortionAdjusted(tradeType, quoteGasAdjusted, portionAmount) {
        if (!portionAmount) {
            return undefined;
        }
        switch (tradeType) {
            case sdk_core_1.TradeType.EXACT_INPUT:
                return quoteGasAdjusted.subtract(portionAmount);
            case sdk_core_1.TradeType.EXACT_OUTPUT:
                return quoteGasAdjusted;
            default:
                throw new Error(`Unknown trade type ${tradeType}`);
        }
    }
}
exports.PortionProvider = PortionProvider;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9ydGlvbi1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9wcm92aWRlcnMvcG9ydGlvbi1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxrREFBeUM7QUFDekMsOENBQXNEO0FBRXRELHdDQUtvQjtBQUNwQixrQ0FBeUM7QUFnSHpDLE1BQWEsZUFBZTtJQUMxQixnQkFBZ0IsQ0FDZCxjQUE4QixFQUM5QixTQUFvQixFQUNwQixzQkFBZ0MsRUFDaEMsa0JBQTRCLEVBQzVCLFVBQXdCO1FBRXhCLElBQ0Usc0JBQXNCO1lBQ3RCLGtCQUFrQjtZQUNsQixDQUFBLFVBQVUsYUFBVixVQUFVLHVCQUFWLFVBQVUsQ0FBRSxJQUFJLE1BQUssa0JBQVEsQ0FBQyxnQkFBZ0IsRUFDOUM7WUFDQSxPQUFPLFNBQVMsQ0FBQztTQUNsQjtRQUVELE1BQU0seUJBQXlCLEdBQUcsVUFBd0MsQ0FBQztRQUMzRSxRQUFRLFNBQVMsRUFBRTtZQUNqQixLQUFLLG9CQUFTLENBQUMsV0FBVztnQkFDeEIsSUFDRSx5QkFBeUIsQ0FBQyxHQUFHO29CQUM3Qix5QkFBeUIsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxpQkFBSSxDQUFDLEVBQ25EO29CQUNBLE9BQU8sY0FBYyxDQUFDLFFBQVEsQ0FBQyx5QkFBeUIsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7aUJBQ25FO2dCQUVELE9BQU8sU0FBUyxDQUFDO1lBQ25CLEtBQUssb0JBQVMsQ0FBQyxZQUFZO2dCQUN6QixJQUNFLHlCQUF5QixDQUFDLEdBQUc7b0JBQzdCLHlCQUF5QixDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLGlCQUFJLENBQUMsRUFDbkQ7b0JBQ0EsT0FBTyxjQUFjLENBQUMsUUFBUSxDQUFDLHlCQUF5QixDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztpQkFDbkU7Z0JBRUQsT0FBTyxTQUFT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