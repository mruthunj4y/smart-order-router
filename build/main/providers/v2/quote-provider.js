"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.V2QuoteProvider = void 0;
const bignumber_1 = require("@ethersproject/bignumber");
const sdk_core_1 = require("@surge/sdk-core");
const v2_sdk_1 = require("@surge/v2-sdk");
const log_1 = require("../../util/log");
const routes_1 = require("../../util/routes");
/**
 * Computes quotes for V2 off-chain. Quotes are computed using the balances
 * of the pools within each route provided.
 *
 * @export
 * @class V2QuoteProvider
 */
class V2QuoteProvider {
    /* eslint-disable @typescript-eslint/no-empty-function */
    constructor() { }
    /* eslint-enable @typescript-eslint/no-empty-function */
    async getQuotesManyExactIn(amountIns, routes) {
        return this.getQuotes(amountIns, routes, sdk_core_1.TradeType.EXACT_INPUT);
    }
    async getQuotesManyExactOut(amountOuts, routes) {
        return this.getQuotes(amountOuts, routes, sdk_core_1.TradeType.EXACT_OUTPUT);
    }
    async getQuotes(amounts, routes, tradeType) {
        const routesWithQuotes = [];
        const debugStrs = [];
        for (const route of routes) {
            const amountQuotes = [];
            let insufficientInputAmountErrorCount = 0;
            let insufficientReservesErrorCount = 0;
            for (const amount of amounts) {
                try {
                    if (tradeType == sdk_core_1.TradeType.EXACT_INPUT) {
                        let outputAmount = amount.wrapped;
                        for (const pair of route.pairs) {
                            [outputAmount] = pair.getOutputAmount(outputAmount);
                        }
                        amountQuotes.push({
                            amount,
                            quote: bignumber_1.BigNumber.from(outputAmount.quotient.toString()),
                        });
                    }
                    else {
                        let inputAmount = amount.wrapped;
                        for (let i = route.pairs.length - 1; i >= 0; i--) {
                            const pair = route.pairs[i];
                            [inputAmount] = pair.getInputAmount(inputAmount);
                        }
                        amountQuotes.push({
                            amount,
                            quote: bignumber_1.BigNumber.from(inputAmount.quotient.toString()),
                        });
                    }
                }
                catch (err) {
                    // Can fail to get quotes, e.g. throws InsufficientReservesError or InsufficientInputAmountError.
                    if (err instanceof v2_sdk_1.InsufficientInputAmountError) {
                        insufficientInputAmountErrorCount =
                            insufficientInputAmountErrorCount + 1;
                        amountQuotes.push({ amount, quote: null });
                    }
                    else if (err instanceof v2_sdk_1.InsufficientReservesError) {
                        insufficientReservesErrorCount = insufficientReservesErrorCount + 1;
                        amountQuotes.push({ amount, quote: null });
                    }
                    else {
                        throw err;
                    }
                }
            }
            if (insufficientInputAmountErrorCount > 0 ||
                insufficientReservesErrorCount > 0) {
                debugStrs.push(`${[
                    (0, routes_1.routeToString)(route),
                ]} Input: ${insufficientInputAmountErrorCount} Reserves: ${insufficientReservesErrorCount} }`);
            }
            routesWithQuotes.push([route, amountQuotes]);
        }
        if (debugStrs.length > 0) {
            log_1.log.info({ debugStrs }, `Failed quotes for V2 routes`);
        }
        return {
            routesWithQuotes,
        };
    }
}
exports.V2QuoteProvider = V2QuoteProvider;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVvdGUtcHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcHJvdmlkZXJzL3YyL3F1b3RlLXByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHdEQUFxRDtBQUNyRCw4Q0FBNEM7QUFDNUMsMENBR3VCO0FBSXZCLHdDQUFxQztBQUNyQyw4Q0FBa0Q7QUF5QmxEOzs7Ozs7R0FNRztBQUNILE1BQWEsZUFBZTtJQUMxQix5REFBeUQ7SUFDekQsZ0JBQWUsQ0FBQztJQUVoQix3REFBd0Q7SUFFakQsS0FBSyxDQUFDLG9CQUFvQixDQUMvQixTQUEyQixFQUMzQixNQUFpQjtRQUVqQixPQUFPLElBQUksQ0FBQyxTQUFTLENBQ25CLFNBQVMsRUFDVCxNQUFNLEVBQ04sb0JBQVMsQ0FBQyxXQUFXLENBQ3RCLENBQUM7SUFDSixDQUFDO0lBRU0sS0FBSyxDQUFDLHFCQUFxQixDQUNoQyxVQUE0QixFQUM1QixNQUFpQjtRQUVqQixPQUFPLElBQUksQ0FBQyxTQUFTLENBQ25CLFVBQVUsRUFDVixNQUFNLEVBQ04sb0JBQVMsQ0FBQyxZQUFZLENBQ3ZCLENBQUM7SUFDSixDQUFDO0lBRU8sS0FBSyxDQUFDLFNBQVMsQ0FDckIsT0FBeUIsRUFDekIsTUFBaUIsRUFDakIsU0FBb0I7UUFFcEIsTUFBTSxnQkFBZ0IsR0FBd0IsRUFBRSxDQUFDO1FBRWpELE1BQU0sU0FBUyxHQUFhLEVBQUUsQ0FBQztRQUMvQixLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sRUFBRTtZQUMxQixNQUFNLFlBQVksR0FBb0IsRUFBRSxDQUFDO1lBRXpDLElBQUksaUNBQWlDLEdBQUcsQ0FBQyxDQUFDO1lBQzFDLElBQUksOEJBQThCLEdBQUcsQ0FBQyxDQUFDO1lBQ3ZDLEtBQUssTUFBTSxNQUFNLElBQUksT0FBTyxFQUFFO2dCQUM1QixJQUFJO29CQUNGLElBQUksU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVyxFQUFFO3dC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