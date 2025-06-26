"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnChainGasPriceProvider = void 0;
const sdk_core_1 = require("@surge/sdk-core");
const l2FeeChains_1 = require("../util/l2FeeChains");
const gas_price_provider_1 = require("./gas-price-provider");
const DEFAULT_EIP_1559_SUPPORTED_CHAINS = [
    sdk_core_1.ChainId.XRPL_EVM_TESTNET,
    sdk_core_1.ChainId.ARBITRUM_SEPOLIA,
    ...l2FeeChains_1.opStackChains,
];
/**
 * Gets gas prices on chain. If the chain supports EIP-1559 and has the feeHistory API,
 * uses the EIP1559 provider. Otherwise it will use a legacy provider that uses eth_gasPrice
 *
 * @export
 * @class OnChainGasPriceProvider
 */
class OnChainGasPriceProvider extends gas_price_provider_1.IGasPriceProvider {
    constructor(chainId, eip1559GasPriceProvider, legacyGasPriceProvider, eipChains = DEFAULT_EIP_1559_SUPPORTED_CHAINS) {
        super();
        this.chainId = chainId;
        this.eip1559GasPriceProvider = eip1559GasPriceProvider;
        this.legacyGasPriceProvider = legacyGasPriceProvider;
        this.eipChains = eipChains;
    }
    async getGasPrice(latestBlockNumber, requestBlockNumber) {
        if (this.eipChains.includes(this.chainId)) {
            return this.eip1559GasPriceProvider.getGasPrice(latestBlockNumber, requestBlockNumber);
        }
        return this.legacyGasPriceProvider.getGasPrice(latestBlockNumber, requestBlockNumber);
    }
}
exports.OnChainGasPriceProvider = OnChainGasPriceProvider;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib24tY2hhaW4tZ2FzLXByaWNlLXByb3ZpZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3Byb3ZpZGVycy9vbi1jaGFpbi1nYXMtcHJpY2UtcHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsOENBQTBDO0FBRTFDLHFEQUFvRDtBQUdwRCw2REFBbUU7QUFHbkUsTUFBTSxpQ0FBaUMsR0FBRztJQUN4QyxrQkFBTyxDQUFDLGdCQUFnQjtJQUN4QixrQkFBTyxDQUFDLGdCQUFnQjtJQUN4QixHQUFHLDJCQUFhO0NBQ2pCLENBQUM7QUFFRjs7Ozs7O0dBTUc7QUFDSCxNQUFhLHVCQUF3QixTQUFRLHNDQUFpQjtJQUM1RCxZQUNZLE9BQWdCLEVBQ2hCLHVCQUFnRCxFQUNoRCxzQkFBOEMsRUFDOUMsWUFBdUIsaUNBQWlDO1FBRWxFLEtBQUssRUFBRSxDQUFDO1FBTEUsWUFBTyxHQUFQLE9BQU8sQ0FBUztRQUNoQiw0QkFBdUIsR0FBdkIsdUJBQXVCLENBQXlCO1FBQ2hELDJCQUFzQixHQUF0QixzQkFBc0IsQ0FBd0I7UUFDOUMsY0FBUyxHQUFULFNBQVMsQ0FBK0M7SUFHcEUsQ0FBQztJQUVlLEtBQUssQ0FBQyxXQUFXLENBQy9CLGlCQUF5QixFQUN6QixrQkFBMkI7UUFFM0IsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDekMsT0FBTyxJQUFJLENBQUMsdUJBQXVCLENBQUMsV0FBVyxDQUM3QyxpQkFBaUIsRUFDakIsa0JBQWtCLENBQ25CLENBQUM7U0FDSDtRQUVELE9BQU8sSUFBSSxDQUFDLHNCQUFzQixDQUFDLFdBQVcsQ0FDNUMsaUJBQWlCLEVBQ2pCLGtCQUFrQixDQUNuQixDQUFDO0lBQ0osQ0FBQztDQUNGO0FBMUJELDBEQTBCQyJ9