"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EthEstimateGasSimulator = void 0;
const bignumber_1 = require("@ethersproject/bignumber");
// Locally define BEACON_CHAIN_DEPOSIT_ADDRESS since it's not exported from util
const routers_1 = require("../routers");
const util_1 = require("../util");
const gas_factory_helpers_1 = require("../util/gas-factory-helpers");
const simulation_provider_1 = require("./simulation-provider");
// We multiply eth estimate gas by this to add a buffer for gas limits
const DEFAULT_ESTIMATE_MULTIPLIER = 1.2;
class EthEstimateGasSimulator extends simulation_provider_1.Simulator {
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
        if (swapOptions.type == routers_1.SwapType.UNIVERSAL_ROUTER) {
            // The MAINNET check is not valid in this codebase, so we remove it and always use the provided fromAddress
            // If you need chain-specific logic, add it for XRPL_EVM_TESTNET or ARBITRUM_SEPOLIA
            util_1.log.info({ addr: fromAddress, methodParameters: route.methodParameters }, 'Simulating using eth_estimateGas on Universal Router');
            try {
                estimatedGasUsed = await this.provider.estimateGas({
                    data: (_b = (_a = route.methodParameters) === null || _a === void 0 ? void 0 : _a.calldata) !== null && _b !== void 0 ? _b : '',
                    to: (_d = (_c = route.methodParameters) === null || _c === void 0 ? void 0 : _c.to) !== null && _d !== void 0 ? _d : '',
                    from: fromAddress,
                    value: bignumber_1.BigNumber.from(currencyIn.isNative ? (_f = (_e = route.methodParameters) === null || _e === void 0 ? void 0 : _e.value) !== null && _f !== void 0 ? _f : '0' : '0'),
                });
            }
            catch (e) {
                util_1.log.error({ e }, 'Error estimating gas');
                return Object.assign(Object.assign({}, route), { simulationStatus: simulation_provider_1.SimulationStatus.Failed });
            }
        }
        else if (swapOptions.type == routers_1.SwapType.SWAP_ROUTER_02) {
            try {
                estimatedGasUsed = await this.provider.estimateGas({
                    data: (_h = (_g = route.methodParameters) === null || _g === void 0 ? void 0 : _g.calldata) !== null && _h !== void 0 ? _h : '',
                    to: (_k = (_j = route.methodParameters) === null || _j === void 0 ? void 0 : _j.to) !== null && _k !== void 0 ? _k : '',
                    from: fromAddress,
                    value: bignumber_1.BigNumber.from(currencyIn.isNative ? (_m = (_l = route.methodParameters) === null || _l === void 0 ? void 0 : _l.value) !== null && _m !== void 0 ? _m : '0' : '0'),
                });
            }
            catch (e) {
                util_1.log.error({ e }, 'Error estimating gas');
                return Object.assign(Object.assign({}, route), { simulationStatus: simulation_provider_1.SimulationStatus.Failed });
            }
        }
        else {
            throw new Error(`Unsupported swap type ${swapOptions}`);
        }
        estimatedGasUsed = this.adjustGasEstimate(estimatedGasUsed);
        util_1.log.info({
            methodParameters: route.methodParameters,
            estimatedGasUsed: estimatedGasUsed.toString(),
        }, 'Simulated using eth_estimateGas on SwapRouter02');
        const { estimatedGasUsedUSD, estimatedGasUsedQuoteToken, estimatedGasUsedGasToken, quoteGasAdjusted, } = await (0, gas_factory_helpers_1.calculateGasUsed)(route.quote.currency.chainId, route, estimatedGasUsed, this.v2PoolProvider, this.v3PoolProvider, providerConfig);
        return Object.assign(Object.assign({}, (0, gas_factory_helpers_1.initSwapRouteFromExisting)(route, this.v2PoolProvider, this.v3PoolProvider, this.portionProvider, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedQuoteToken, estimatedGasUsedUSD, swapOptions, estimatedGasUsedGasToken, providerConfig)), { simulationStatus: simulation_provider_1.SimulationStatus.Succeeded });
    }
    adjustGasEstimate(gasLimit) {
        var _a;
        const estimateMultiplier = (_a = this.overrideEstimateMultiplier[this.chainId]) !== null && _a !== void 0 ? _a : DEFAULT_ESTIMATE_MULTIPLIER;
        const adjustedGasEstimate = bignumber_1.BigNumber.from(gasLimit)
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
            util_1.log.info('Token not approved, skipping simulation');
            return Object.assign(Object.assign({}, swapRoute), { simulationStatus: simulation_provider_1.SimulationStatus.NotApproved });
        }
    }
}
exports.EthEstimateGasSimulator = EthEstimateGasSimulator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXRoLWVzdGltYXRlLWdhcy1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9wcm92aWRlcnMvZXRoLWVzdGltYXRlLWdhcy1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx3REFBcUQ7QUFJckQsZ0ZBQWdGO0FBRWhGLHdDQUtvQjtBQUNwQixrQ0FBOEI7QUFDOUIscUVBR3FDO0FBSXJDLCtEQUFvRTtBQUlwRSxzRUFBc0U7QUFDdEUsTUFBTSwyQkFBMkIsR0FBRyxHQUFHLENBQUM7QUFFeEMsTUFBYSx1QkFBd0IsU0FBUSwrQkFBUztJQUtwRCxZQUNFLE9BQWdCLEVBQ2hCLFFBQXlCLEVBQ3pCLGNBQStCLEVBQy9CLGNBQStCLEVBQy9CLGVBQWlDLEVBQ2pDLDBCQUE4RDtRQUU5RCxLQUFLLENBQUMsUUFBUSxFQUFFLGVBQWUsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUMxQyxJQUFJLENBQUMsY0FBYyxHQUFHLGNBQWMsQ0FBQztRQUNyQyxJQUFJLENBQUMsY0FBYyxHQUFHLGNBQWMsQ0FBQztRQUNyQyxJQUFJLENBQUMsMEJBQTBCLEdBQUcsMEJBQTBCLGFBQTFCLDBCQUEwQixjQUExQiwwQkFBMEIsR0FBSSxFQUFFLENBQUM7SUFDckUsQ0FBQztJQUVELEtBQUssQ0FBQyxjQUFjLENBQ2xCLFdBQW1CLEVBQ25CLFdBQXdCLEVBQ3hCLEtBQWdCLEVBQ2hCLGNBQStCOztRQUUvQixNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUM7UUFDcEQsSUFBSSxnQkFBMkIsQ0FBQztRQUNoQyxJQUFJLFdBQVcsQ0FBQyxJQUFJLElBQUksa0JBQVEsQ0FBQyxnQkFBZ0IsRUFBRTtZQUNqRCwyR0FBMkc7WUFDM0csb0ZBQW9GO1lBQ3BGLFVBQUcsQ0FBQyxJQUFJLENBQ04sRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLGdCQUFnQixFQUFFLEtBQUss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