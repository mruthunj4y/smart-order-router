import { BigNumber } from '@ethersproject/bignumber';
// Locally define BEACON_CHAIN_DEPOSIT_ADDRESS since it's not exported from util
import { SwapType, } from '../routers';
import { log } from '../util';
import { calculateGasUsed, initSwapRouteFromExisting, } from '../util/gas-factory-helpers';
import { SimulationStatus, Simulator } from './simulation-provider';
// We multiply eth estimate gas by this to add a buffer for gas limits
const DEFAULT_ESTIMATE_MULTIPLIER = 1.2;
export class EthEstimateGasSimulator extends Simulator {
    constructor(chainId, provider, v2PoolProvider, v3PoolProvider, portionProvider, overrideEstimateMultiplier) {
        super(provider, portionProvider, chainId);
        this.v2PoolProvider = v2PoolProvider;
        this.v3PoolProvider = v3PoolProvider;
        this.overrideEstimateMultiplier = overrideEstimateMultiplier !== null && overrideEstimateMultiplier !== void 0 ? overrideEstimateMultiplier : {};
    }
    async ethEstimateGas(fromAddress, swapOptions, route, providerConfig) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const currencyIn = route.trade.inputAmount.currency;
        let estimatedGasUsed;
        if (swapOptions.type == SwapType.UNIVERSAL_ROUTER) {
            // The MAINNET check is not valid in this codebase, so we remove it and always use the provided fromAddress
            // If you need chain-specific logic, add it for XRPL_EVM_TESTNET or ARBITRUM_SEPOLIA
            log.info({ addr: fromAddress, methodParameters: route.methodParameters }, 'Simulating using eth_estimateGas on Universal Router');
            try {
                estimatedGasUsed = await this.provider.estimateGas({
                    data: (_b = (_a = route.methodParameters) === null || _a === void 0 ? void 0 : _a.calldata) !== null && _b !== void 0 ? _b : '',
                    to: (_d = (_c = route.methodParameters) === null || _c === void 0 ? void 0 : _c.to) !== null && _d !== void 0 ? _d : '',
                    from: fromAddress,
                    value: BigNumber.from(currencyIn.isNative ? (_f = (_e = route.methodParameters) === null || _e === void 0 ? void 0 : _e.value) !== null && _f !== void 0 ? _f : '0' : '0'),
                });
            }
            catch (e) {
                log.error({ e }, 'Error estimating gas');
                return {
                    ...route,
                    simulationStatus: SimulationStatus.Failed,
                };
            }
        }
        else if (swapOptions.type == SwapType.SWAP_ROUTER_02) {
            try {
                estimatedGasUsed = await this.provider.estimateGas({
                    data: (_h = (_g = route.methodParameters) === null || _g === void 0 ? void 0 : _g.calldata) !== null && _h !== void 0 ? _h : '',
                    to: (_k = (_j = route.methodParameters) === null || _j === void 0 ? void 0 : _j.to) !== null && _k !== void 0 ? _k : '',
                    from: fromAddress,
                    value: BigNumber.from(currencyIn.isNative ? (_m = (_l = route.methodParameters) === null || _l === void 0 ? void 0 : _l.value) !== null && _m !== void 0 ? _m : '0' : '0'),
                });
            }
            catch (e) {
                log.error({ e }, 'Error estimating gas');
                return {
                    ...route,
                    simulationStatus: SimulationStatus.Failed,
                };
            }
        }
        else {
            throw new Error(`Unsupported swap type ${swapOptions}`);
        }
        estimatedGasUsed = this.adjustGasEstimate(estimatedGasUsed);
        log.info({
            methodParameters: route.methodParameters,
            estimatedGasUsed: estimatedGasUsed.toString(),
        }, 'Simulated using eth_estimateGas on SwapRouter02');
        const { estimatedGasUsedUSD, estimatedGasUsedQuoteToken, estimatedGasUsedGasToken, quoteGasAdjusted, } = await calculateGasUsed(route.quote.currency.chainId, route, estimatedGasUsed, this.v2PoolProvider, this.v3PoolProvider, providerConfig);
        return {
            ...initSwapRouteFromExisting(route, this.v2PoolProvider, this.v3PoolProvider, this.portionProvider, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedQuoteToken, estimatedGasUsedUSD, swapOptions, estimatedGasUsedGasToken, providerConfig),
            simulationStatus: SimulationStatus.Succeeded,
        };
    }
    adjustGasEstimate(gasLimit) {
        var _a;
        const estimateMultiplier = (_a = this.overrideEstimateMultiplier[this.chainId]) !== null && _a !== void 0 ? _a : DEFAULT_ESTIMATE_MULTIPLIER;
        const adjustedGasEstimate = BigNumber.from(gasLimit)
            .mul(estimateMultiplier * 100)
            .div(100);
        return adjustedGasEstimate;
    }
    async simulateTransaction(fromAddress, swapOptions, swapRoute, _providerConfig) {
        const inputAmount = swapRoute.trade.inputAmount;
        if (inputAmount.currency.isNative ||
            (await this.checkTokenApproved(fromAddress, inputAmount, swapOptions, this.provider))) {
            return await this.ethEstimateGas(fromAddress, swapOptions, swapRoute, _providerConfig);
        }
        else {
            log.info('Token not approved, skipping simulation');
            return {
                ...swapRoute,
                simulationStatus: SimulationStatus.NotApproved,
            };
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXRoLWVzdGltYXRlLWdhcy1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9wcm92aWRlcnMvZXRoLWVzdGltYXRlLWdhcy1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFJckQsZ0ZBQWdGO0FBRWhGLE9BQU8sRUFJTCxRQUFRLEdBQ1QsTUFBTSxZQUFZLENBQUM7QUFDcEIsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLFNBQVMsQ0FBQztBQUM5QixPQUFPLEVBQ0wsZ0JBQWdCLEVBQ2hCLHlCQUF5QixHQUMxQixNQUFNLDZCQUE2QixDQUFDO0FBSXJDLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxTQUFTLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUlwRSxzRUFBc0U7QUFDdEUsTUFBTSwyQkFBMkIsR0FBRyxHQUFHLENBQUM7QUFFeEMsTUFBTSxPQUFPLHVCQUF3QixTQUFRLFNBQVM7SUFLcEQsWUFDRSxPQUFnQixFQUNoQixRQUF5QixFQUN6QixjQUErQixFQUMvQixjQUErQixFQUMvQixlQUFpQyxFQUNqQywwQkFBOEQ7UUFFOUQsS0FBSyxDQUFDLFFBQVEsRUFBRSxlQUFlLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDMUMsSUFBSSxDQUFDLGNBQWMsR0FBRyxjQUFjLENBQUM7UUFDckMsSUFBSSxDQUFDLGNBQWMsR0FBRyxjQUFjLENBQUM7UUFDckMsSUFBSSxDQUFDLDBCQUEwQixHQUFHLDBCQUEwQixhQUExQiwwQkFBMEIsY0FBMUIsMEJBQTBCLEdBQUksRUFBRSxDQUFDO0lBQ3JFLENBQUM7SUFFRCxLQUFLLENBQUMsY0FBYyxDQUNsQixXQUFtQixFQUNuQixXQUF3QixFQUN4QixLQUFnQixFQUNoQixjQUErQjs7UUFFL0IsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsUUFBUSxD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