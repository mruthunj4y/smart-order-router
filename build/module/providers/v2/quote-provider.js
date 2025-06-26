import { BigNumber } from '@ethersproject/bignumber';
import { TradeType } from '@surge/sdk-core';
import { InsufficientInputAmountError, InsufficientReservesError, } from '@surge/v2-sdk';
import { log } from '../../util/log';
import { routeToString } from '../../util/routes';
/**
 * Computes quotes for V2 off-chain. Quotes are computed using the balances
 * of the pools within each route provided.
 *
 * @export
 * @class V2QuoteProvider
 */
export class V2QuoteProvider {
    /* eslint-disable @typescript-eslint/no-empty-function */
    constructor() { }
    /* eslint-enable @typescript-eslint/no-empty-function */
    async getQuotesManyExactIn(amountIns, routes) {
        return this.getQuotes(amountIns, routes, TradeType.EXACT_INPUT);
    }
    async getQuotesManyExactOut(amountOuts, routes) {
        return this.getQuotes(amountOuts, routes, TradeType.EXACT_OUTPUT);
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
                    if (tradeType == TradeType.EXACT_INPUT) {
                        let outputAmount = amount.wrapped;
                        for (const pair of route.pairs) {
                            [outputAmount] = pair.getOutputAmount(outputAmount);
                        }
                        amountQuotes.push({
                            amount,
                            quote: BigNumber.from(outputAmount.quotient.toString()),
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
                            quote: BigNumber.from(inputAmount.quotient.toString()),
                        });
                    }
                }
                catch (err) {
                    // Can fail to get quotes, e.g. throws InsufficientReservesError or InsufficientInputAmountError.
                    if (err instanceof InsufficientInputAmountError) {
                        insufficientInputAmountErrorCount =
                            insufficientInputAmountErrorCount + 1;
                        amountQuotes.push({ amount, quote: null });
                    }
                    else if (err instanceof InsufficientReservesError) {
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
                    routeToString(route),
                ]} Input: ${insufficientInputAmountErrorCount} Reserves: ${insufficientReservesErrorCount} }`);
            }
            routesWithQuotes.push([route, amountQuotes]);
        }
        if (debugStrs.length > 0) {
            log.info({ debugStrs }, `Failed quotes for V2 routes`);
        }
        return {
            routesWithQuotes,
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVvdGUtcHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcHJvdmlkZXJzL3YyL3F1b3RlLXByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNyRCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDNUMsT0FBTyxFQUNMLDRCQUE0QixFQUM1Qix5QkFBeUIsR0FDMUIsTUFBTSxlQUFlLENBQUM7QUFJdkIsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQ3JDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQXlCbEQ7Ozs7OztHQU1HO0FBQ0gsTUFBTSxPQUFPLGVBQWU7SUFDMUIseURBQXlEO0lBQ3pELGdCQUFlLENBQUM7SUFFaEIsd0RBQXdEO0lBRWpELEtBQUssQ0FBQyxvQkFBb0IsQ0FDL0IsU0FBMkIsRUFDM0IsTUFBaUI7UUFFakIsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUNuQixTQUFTLEVBQ1QsTUFBTSxFQUNOLFNBQVMsQ0FBQyxXQUFXLENBQ3RCLENBQUM7SUFDSixDQUFDO0lBRU0sS0FBSyxDQUFDLHFCQUFxQixDQUNoQyxVQUE0QixFQUM1QixNQUFpQjtRQUVqQixPQUFPLElBQUksQ0FBQyxTQUFTLENBQ25CLFVBQVUsRUFDVixNQUFNLEVBQ04sU0FBUyxDQUFDLFlBQVksQ0FDdkIsQ0FBQztJQUNKLENBQUM7SUFFTyxLQUFLLENBQUMsU0FBUyxDQUNyQixPQUF5QixFQUN6QixNQUFpQixFQUNqQixTQUFvQjtRQUVwQixNQUFNLGdCQUFnQixHQUF3QixFQUFFLENBQUM7UUFFakQsTUFBTSxTQUFTLEdBQWEsRUFBRSxDQUFDO1FBQy9CLEtBQUssTUFBTSxLQUFLLElBQUksTUFBTSxFQUFFO1lBQzFCLE1BQU0sWUFBWSxHQUFvQixFQUFF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