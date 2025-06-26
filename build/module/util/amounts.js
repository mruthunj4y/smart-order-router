import { parseUnits } from '@ethersproject/units';
import { CurrencyAmount as CurrencyAmountRaw, } from '@surge/sdk-core';
import { FeeAmount } from '@surge/v3-sdk';
import JSBI from 'jsbi';
export class CurrencyAmount extends CurrencyAmountRaw {
}
export const MAX_UINT160 = '0xffffffffffffffffffffffffffffffffffffffff';
// Try to parse a user entered amount for a given token
export function parseAmount(value, currency) {
    const typedValueParsed = parseUnits(value, currency.decimals).toString();
    return CurrencyAmount.fromRawAmount(currency, JSBI.BigInt(typedValueParsed));
}
export function parseFeeAmount(feeAmountStr) {
    switch (feeAmountStr) {
        case '10000':
            return FeeAmount.HIGH;
        case '3000':
            return FeeAmount.MEDIUM;
        case '500':
            return FeeAmount.LOW;
        case '100':
            return FeeAmount.LOWEST;
        default:
            throw new Error(`Fee amount ${feeAmountStr} not supported.`);
    }
}
export function unparseFeeAmount(feeAmount) {
    switch (feeAmount) {
        case FeeAmount.HIGH:
            return '10000';
        case FeeAmount.MEDIUM:
            return '3000';
        case FeeAmount.LOW:
            return '500';
        case FeeAmount.LOWEST:
            return '100';
        default:
            throw new Error(`Fee amount ${feeAmount} not supported.`);
    }
}
export function getApplicableV3FeeAmounts() {
    const feeAmounts = [
        FeeAmount.HIGH,
        FeeAmount.MEDIUM,
        FeeAmount.LOW,
        FeeAmount.LOWEST,
    ];
    return feeAmounts;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW1vdW50cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy91dGlsL2Ftb3VudHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQ2xELE9BQU8sRUFFTCxjQUFjLElBQUksaUJBQWlCLEdBQ3BDLE1BQU0saUJBQWlCLENBQUM7QUFDekIsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUMxQyxPQUFPLElBQUksTUFBTSxNQUFNLENBQUM7QUFFeEIsTUFBTSxPQUFPLGNBQWUsU0FBUSxpQkFBMkI7Q0FBSTtBQUVuRSxNQUFNLENBQUMsTUFBTSxXQUFXLEdBQUcsNENBQTRDLENBQUM7QUFFeEUsdURBQXVEO0FBQ3ZELE1BQU0sVUFBVSxXQUFXLENBQUMsS0FBYSxFQUFFLFFBQWtCO0lBQzNELE1BQU0sZ0JBQWdCLEdBQUcsVUFBVSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDekUsT0FBTyxjQUFjLENBQUMsYUFBYSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQztBQUMvRSxDQUFDO0FBRUQsTUFBTSxVQUFVLGNBQWMsQ0FBQyxZQUFvQjtJQUNqRCxRQUFRLFlBQVksRUFBRTtRQUNwQixLQUFLLE9BQU87WUFDVixPQUFPLFNBQVMsQ0FBQyxJQUFJLENBQUM7UUFDeEIsS0FBSyxNQUFNO1lBQ1QsT0FBTyxTQUFTLENBQUMsTUFBTSxDQUFDO1FBQzFCLEtBQUssS0FBSztZQUNSLE9BQU8sU0FBUyxDQUFDLEdBQUcsQ0FBQztRQUN2QixLQUFLLEtBQUs7WUFDUixPQUFPLFNBQVMsQ0FBQyxNQUFNLENBQUM7UUFDMUI7WUFDRSxNQUFNLElBQUksS0FBSyxDQUFDLGNBQWMsWUFBWSxpQkFBaUIsQ0FBQyxDQUFDO0tBQ2hFO0FBQ0gsQ0FBQztBQUVELE1BQU0sVUFBVSxnQkFBZ0IsQ0FBQyxTQUFvQjtJQUNuRCxRQUFRLFNBQVMsRUFBRTtRQUNqQixLQUFLLFNBQVMsQ0FBQyxJQUFJO1lBQ2pCLE9BQU8sT0FBTyxDQUFDO1FBQ2pCLEtBQUssU0FBUyxDQUFDLE1BQU07WUFDbkIsT0FBTyxNQUFNLENBQUM7UUFDaEIsS0FBSyxTQUFTLENBQUMsR0FBRztZQUNoQixPQUFPLEtBQUssQ0FBQztRQUNmLEtBQUssU0FBUyxDQUFDLE1BQU07WUFDbkIsT0FBTyxLQUFLLENBQUM7UUFDZjtZQUNFLE1BQU0sSUFBSSxLQUFLLENBQUMsY0FBYyxTQUFTLGlCQUFpQixDQUFDLENBQUM7S0FDN0Q7QUFDSCxDQUFDO0FBRUQsTUFBTSxVQUFVLHlCQUF5QjtJQUN2QyxNQUFNLFVBQVUsR0FBRztRQUNqQixTQUFTLENBQUMsSUFBSTtRQUNkLFNBQVMsQ0FBQyxNQUFNO1FBQ2hCLFNBQVMsQ0FBQyxHQUFHO1FBQ2IsU0FBUyxDQUFDLE1BQU07S0FDakIsQ0FBQztJQUNGLE9BQU8sVUFBVSxDQUFDO0FBQ3BCLENBQUMifQ==