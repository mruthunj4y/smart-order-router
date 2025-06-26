"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnChainTokenFeeFetcher = exports.DEFAULT_TOKEN_FEE_RESULT = void 0;
const bignumber_1 = require("@ethersproject/bignumber");
const sdk_core_1 = require("@surge/sdk-core");
const TokenFeeDetector__factory_1 = require("../types/other/factories/TokenFeeDetector__factory");
const util_1 = require("../util");
const DEFAULT_TOKEN_BUY_FEE_BPS = bignumber_1.BigNumber.from(0);
const DEFAULT_TOKEN_SELL_FEE_BPS = bignumber_1.BigNumber.from(0);
// on detector failure, assume no fee
exports.DEFAULT_TOKEN_FEE_RESULT = {
    buyFeeBps: DEFAULT_TOKEN_BUY_FEE_BPS,
    sellFeeBps: DEFAULT_TOKEN_SELL_FEE_BPS,
};
// address at which the FeeDetector lens is deployed
const FEE_DETECTOR_ADDRESS = (chainId) => {
    switch (chainId) {
        case sdk_core_1.ChainId.XRPL_EVM_TESTNET:
            return '0xbc708B192552e19A088b4C4B8772aEeA83bCf760';
        case sdk_core_1.ChainId.ARBITRUM_SEPOLIA:
            return '0x95aDC98A949dCD94645A8cD56830D86e4Cf34Eff';
        default:
            // just default to mainnet contract
            return '0xbc708B192552e19A088b4C4B8772aEeA83bCf760';
    }
};
// Amount has to be big enough to avoid rounding errors, but small enough that
// most v2 pools will have at least this many token units
// 100000 is the smallest number that avoids rounding errors in bps terms
// 10000 was not sufficient due to rounding errors for rebase token (e.g. stETH)
const AMOUNT_TO_FLASH_BORROW = '100000';
// 1M gas limit per validate call, should cover most swap cases
const GAS_LIMIT_PER_VALIDATE = 1000000;
class OnChainTokenFeeFetcher {
    constructor(chainId, rpcProvider, tokenFeeAddress = FEE_DETECTOR_ADDRESS(chainId), gasLimitPerCall = GAS_LIMIT_PER_VALIDATE, amountToFlashBorrow = AMOUNT_TO_FLASH_BORROW) {
        this.chainId = chainId;
        this.tokenFeeAddress = tokenFeeAddress;
        this.gasLimitPerCall = gasLimitPerCall;
        this.amountToFlashBorrow = amountToFlashBorrow;
        const wrapped = util_1.WRAPPED_NATIVE_CURRENCY[this.chainId];
        if (!wrapped) {
            throw new Error(`No wrapped native token for chainId: ${this.chainId}`);
        }
        this.BASE_TOKEN = wrapped.address;
        this.contract = TokenFeeDetector__factory_1.TokenFeeDetector__factory.connect(this.tokenFeeAddress, rpcProvider);
    }
    async fetchFees(addresses, providerConfig) {
        const tokenToResult = {};
        const addressesWithoutBaseToken = addresses.filter((address) => address.toLowerCase() !== this.BASE_TOKEN.toLowerCase());
        const functionParams = addressesWithoutBaseToken.map((address) => [
            address,
            this.BASE_TOKEN,
            this.amountToFlashBorrow,
        ]);
        const results = await Promise.all(functionParams.map(async ([address, baseToken, amountToBorrow]) => {
            try {
                // We use the validate function instead of batchValidate to avoid poison pill problem.
                // One token that consumes too much gas could cause the entire batch to fail.
                const feeResult = await this.contract.callStatic.validate(address, baseToken, amountToBorrow, {
                    gasLimit: this.gasLimitPerCall,
                    blockTag: providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber,
                });
                util_1.metric.putMetric('TokenFeeFetcherFetchFeesSuccess', 1, util_1.MetricLoggerUnit.Count);
                return Object.assign({ address }, feeResult);
            }
            catch (err) {
                util_1.log.error({ err }, `Error calling validate on-chain for token ${address}`);
                util_1.metric.putMetric('TokenFeeFetcherFetchFeesFailure', 1, util_1.MetricLoggerUnit.Count);
                // in case of FOT token fee fetch failure, we return null
                // so that they won't get returned from the token-fee-fetcher
                // and thus no fee will be applied, and the cache won't cache on FOT tokens with failed fee fetching
                return {
                    address,
                    buyFeeBps: undefined,
                    sellFeeBps: undefined,
                    feeTakenOnTransfer: false,
                    externalTransferFailed: false,
                    sellReverted: false,
                };
            }
        }));
        results.forEach(({ address, buyFeeBps, sellFeeBps, feeTakenOnTransfer, externalTransferFailed, sellReverted, }) => {
            if (buyFeeBps || sellFeeBps) {
                tokenToResult[address] = {
                    buyFeeBps,
                    sellFeeBps,
                    feeTakenOnTransfer,
                    externalTransferFailed,
                    sellReverted,
                };
            }
        });
        return tokenToResult;
    }
}
exports.OnChainTokenFeeFetcher = OnChainTokenFeeFetcher;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9rZW4tZmVlLWZldGNoZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcHJvdmlkZXJzL3Rva2VuLWZlZS1mZXRjaGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHdEQUFxRDtBQUVyRCw4Q0FBMEM7QUFHMUMsa0dBQStGO0FBQy9GLGtDQUtpQjtBQUlqQixNQUFNLHlCQUF5QixHQUFHLHFCQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BELE1BQU0sMEJBQTBCLEdBQUcscUJBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFFckQscUNBQXFDO0FBQ3hCLFFBQUEsd0JBQXdCLEdBQUc7SUFDdEMsU0FBUyxFQUFFLHlCQUF5QjtJQUNwQyxVQUFVLEVBQUUsMEJBQTBCO0NBQ3ZDLENBQUM7QUFhRixvREFBb0Q7QUFDcEQsTUFBTSxvQkFBb0IsR0FBRyxDQUFDLE9BQWdCLEVBQUUsRUFBRTtJQUNoRCxRQUFRLE9BQU8sRUFBRTtRQUNmLEtBQUssa0JBQU8sQ0FBQyxnQkFBZ0I7WUFDM0IsT0FBTyw0Q0FBNEMsQ0FBQztRQUN0RCxLQUFLLGtCQUFPLENBQUMsZ0JBQWdCO1lBQzNCLE9BQU8sNENBQTRDLENBQUM7UUFDdEQ7WUFDRSxtQ0FBbUM7WUFDbkMsT0FBTyw0Q0FBNEMsQ0FBQztLQUN2RDtBQUNILENBQUMsQ0FBQztBQUVGLDhFQUE4RTtBQUM5RSx5REFBeUQ7QUFDekQseUVBQXlFO0FBQ3pFLGdGQUFnRjtBQUNoRixNQUFNLHNCQUFzQixHQUFHLFFBQVEsQ0FBQztBQUN4QywrREFBK0Q7QUFDL0QsTUFBTSxzQkFBc0IsR0FBRyxPQUFTLENBQUM7QUFTekMsTUFBYSxzQkFBc0I7SUFJakMsWUFDVSxPQUFnQixFQUN4QixXQUF5QixFQUNqQixrQkFBa0Isb0JBQW9CLENBQUMsT0FBTyxDQUFDLEVBQy9DLGtCQUFrQixzQkFBc0IsRUFDeEMsc0JBQXNCLHNCQUFzQjtR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