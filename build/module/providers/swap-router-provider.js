const { SwapRouter02__factory, } = require('../types/other/factories/SwapRouter02__factory.js');
import { log, SWAP_ROUTER_02_ADDRESSES } from '../util';
export class SwapRouterProvider {
    constructor(multicall2Provider, chainId) {
        this.multicall2Provider = multicall2Provider;
        this.chainId = chainId;
    }
    async getApprovalType(tokenInAmount, tokenOutAmount) {
        var _a, _b;
        const functionParams = [
            [
                tokenInAmount.currency.wrapped.address,
                tokenInAmount.quotient.toString(),
            ],
            [
                tokenOutAmount.currency.wrapped.address,
                tokenOutAmount.quotient.toString(),
            ],
        ];
        const tx = await this.multicall2Provider.callSameFunctionOnContractWithMultipleParams({
            address: SWAP_ROUTER_02_ADDRESSES(this.chainId),
            contractInterface: SwapRouter02__factory.createInterface(),
            functionName: 'getApprovalType',
            functionParams,
        });
        if (!((_a = tx.results[0]) === null || _a === void 0 ? void 0 : _a.success) || !((_b = tx.results[1]) === null || _b === void 0 ? void 0 : _b.success)) {
            log.info({ results: tx.results }, 'Failed to get approval type from swap router for token in or token out');
            throw new Error('Failed to get approval type from swap router for token in or token out');
        }
        const { result: approvalTokenIn } = tx.results[0];
        const { result: approvalTokenOut } = tx.results[1];
        return {
            approvalTokenIn: approvalTokenIn[0],
            approvalTokenOut: approvalTokenOut[0],
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3dhcC1yb3V0ZXItcHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcHJvdmlkZXJzL3N3YXAtcm91dGVyLXByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUdBLE1BQU0sRUFDSixxQkFBcUIsR0FDdEIsR0FBRyxPQUFPLENBQUMsbURBQW1ELENBQUMsQ0FBQztBQUNqRSxPQUFPLEVBQUUsR0FBRyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sU0FBUyxDQUFDO0FBNkJ4RCxNQUFNLE9BQU8sa0JBQWtCO0lBQzdCLFlBQ1ksa0JBQXNDLEVBQ3RDLE9BQWdCO1FBRGhCLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBb0I7UUFDdEMsWUFBTyxHQUFQLE9BQU8sQ0FBUztJQUN6QixDQUFDO0lBRUcsS0FBSyxDQUFDLGVBQWUsQ0FDMUIsYUFBdUMsRUFDdkMsY0FBd0M7O1FBRXhDLE1BQU0sY0FBYyxHQUF1QjtZQUN6QztnQkFDRSxhQUFhLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPO2dCQUN0QyxhQUFhLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRTthQUNsQztZQUNEO2dCQUNFLGNBQWMsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLE9BQU87Z0JBQ3ZDLGNBQWMsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFO2FBQ25DO1NBQ0YsQ0FBQztRQUVGLE1BQU0sRUFBRSxHQUNOLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixDQUFDLDRDQUE0QyxDQUd4RTtZQUNBLE9BQU8sRUFBRSx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO1lBQy9DLGlCQUFpQixFQUFFLHFCQUFxQixDQUFDLGVBQWUsRUFBRTtZQUMxRCxZQUFZLEVBQUUsaUJBQWlCO1lBQy9CLGNBQWM7U0FDZixDQUFDLENBQUM7UUFFTCxJQUFJLENBQUMsQ0FBQSxNQUFBLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLDBDQUFFLE9BQU8sQ0FBQSxJQUFJLENBQUMsQ0FBQSxNQUFBLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLDBDQUFFLE9BQU8sQ0FBQSxFQUFFO1lBQ3RELEdBQUcsQ0FBQyxJQUFJLENBQ04sRUFBRSxPQUFPLEVBQUUsRUFBRSxDQUFDLE9BQU8sRUFBRSxFQUN2Qix3RUFBd0UsQ0FDekUsQ0FBQztZQUNGLE1BQU0sSUFBSSxLQUFLLENBQ2Isd0VBQXdFLENBQ3pFLENBQUM7U0FDSDtRQUVELE1BQU0sRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNuRCxNQUFNLEVBQUUsTUFBTSxFQUFFLGdCQUFnQixFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVwRCxPQUFPO1lBQ0wsZUFBZSxFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUM7WUFDbkMsZ0JBQWdCLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDO1NBQ3RDLENBQUM7SUFDSixDQUFDO0NBQ0YifQ==