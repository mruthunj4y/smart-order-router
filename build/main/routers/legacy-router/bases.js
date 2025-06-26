"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CUSTOM_BASES = exports.ADDITIONAL_BASES = exports.BASES_TO_CHECK_TRADES_AGAINST = void 0;
/* eslint-disable @typescript-eslint/no-non-null-assertion */
const sdk_core_1 = require("@surge/sdk-core");
const token_provider_1 = require("../../providers/token-provider");
const chains_1 = require("../../util/chains");
const BASES_TO_CHECK_TRADES_AGAINST = () => {
    return {
        [sdk_core_1.ChainId.XRPL_EVM_TESTNET]: [
            chains_1.WRAPPED_NATIVE_CURRENCY[sdk_core_1.ChainId.XRPL_EVM_TESTNET],
            token_provider_1.DAI_XRPL_EVM_TESTNET,
            token_provider_1.USDC_XRPL_EVM_TESTNET,
            token_provider_1.USDT_XRPL_EVM_TESTNET,
            token_provider_1.BNB_XRPL_EVM_TESTNET,
            token_provider_1.AVAX_XRPL_EVM_TESTNET,
            token_provider_1.MATIC_XRPL_EVM_TESTNET,
            token_provider_1.RLUSD_XRPL_EVM_TESTNET,
            token_provider_1.SOL_XRPL_EVM_TESTNET,
            token_provider_1.TON_XRPL_EVM_TESTNET,
            token_provider_1.TRON_XRPL_EVM_TESTNET,
            token_provider_1.AXL_XRPL_EVM_TESTNET,
            token_provider_1.WETH_XRPL_EVM_TESTNET,
        ],
        [sdk_core_1.ChainId.ARBITRUM_SEPOLIA]: [
            chains_1.WRAPPED_NATIVE_CURRENCY[sdk_core_1.ChainId.ARBITRUM_SEPOLIA],
            token_provider_1.DAI_ARBITRUM_SEPOLIA,
            token_provider_1.USDC_ARBITRUM_SEPOLIA,
        ],
    };
};
exports.BASES_TO_CHECK_TRADES_AGAINST = BASES_TO_CHECK_TRADES_AGAINST;
const ADDITIONAL_BASES = async () => {
    return {
    // No additional bases for supported chains
    };
};
exports.ADDITIONAL_BASES = ADDITIONAL_BASES;
/**
 * Some tokens can only be swapped via certain pairs, so we override the list of bases that are considered for these
 * tokens.
 */
const CUSTOM_BASES = async () => {
    return {
    // No custom bases for supported chains
    };
};
exports.CUSTOM_BASES = CUSTOM_BASES;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcm91dGVycy9sZWdhY3ktcm91dGVyL2Jhc2VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZEQUE2RDtBQUM3RCw4Q0FBaUQ7QUFFakQsbUVBZXdDO0FBQ3hDLDhDQUE0RDtBQU1yRCxNQUFNLDZCQUE2QixHQUFHLEdBQW1CLEVBQUU7SUFDaEUsT0FBTztRQUNMLENBQUMsa0JBQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO1lBQzFCLGdDQUF1QixDQUFDLGtCQUFPLENBQUMsZ0JBQWdCLENBQUU7WUFDbEQscUNBQW9CO1lBQ3BCLHNDQUFxQjtZQUNyQixzQ0FBcUI7WUFDckIscUNBQW9CO1lBQ3BCLHNDQUFxQjtZQUNyQix1Q0FBc0I7WUFDdEIsdUNBQXNCO1lBQ3RCLHFDQUFvQjtZQUNwQixxQ0FBb0I7WUFDcEIsc0NBQXFCO1lBQ3JCLHFDQUFvQjtZQUNwQixzQ0FBcUI7U0FDdEI7UUFDRCxDQUFDLGtCQUFPLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtZQUMxQixnQ0FBdUIsQ0FBQyxrQkFBTyxDQUFDLGdCQUFnQixDQUFFO1lBQ2xELHFDQUFvQjtZQUNwQixzQ0FBcUI7U0FDdEI7S0FDRixDQUFDO0FBQ0osQ0FBQyxDQUFDO0FBdkJXLFFBQUEsNkJBQTZCLGlDQXVCeEM7QUFFSyxNQUFNLGdCQUFnQixHQUFHLEtBQUssSUFFbEMsRUFBRTtJQUNILE9BQU87SUFDTCwyQ0FBMkM7S0FDNUMsQ0FBQztBQUNKLENBQUMsQ0FBQztBQU5XLFFBQUEsZ0JBQWdCLG9CQU0zQjtBQUVGOzs7R0FHRztBQUNJLE1BQU0sWUFBWSxHQUFHLEtBQUssSUFFOUIsRUFBRTtJQUNILE9BQU87SUFDTCx1Q0FBdUM7S0FDeEMsQ0FBQztBQUNKLENBQUMsQ0FBQztBQU5XLFFBQUEsWUFBWSxnQkFNdkIifQ==