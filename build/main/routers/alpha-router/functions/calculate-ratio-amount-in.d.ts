import { Fraction } from '@surge/sdk-core';
import { CurrencyAmount } from '../../../util/amounts';
export declare function calculateRatioAmountIn(optimalRatio: Fraction, inputTokenPrice: Fraction, inputBalance: CurrencyAmount, outputBalance: CurrencyAmount): CurrencyAmount;
