"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateL1GasFeesHelper = exports.initSwapRouteFromExisting = exports.calculateGasUsed = exports.getL2ToL1GasUsed = exports.calculateOptimismToL1FeeFromCalldata = exports.calculateArbitrumToL1FeeFromCalldata = exports.getArbitrumBytes = exports.getGasCostInNativeCurrency = exports.getHighestLiquidityV3USDPool = exports.getHighestLiquidityV3NativePool = exports.getV2NativePool = void 0;
const bignumber_1 = require("@ethersproject/bignumber");
const router_sdk_1 = require("@surge/router-sdk");
const sdk_core_1 = require("@surge/sdk-core");
const brotli_1 = __importDefault(require("brotli"));
const jsbi_1 = __importDefault(require("jsbi"));
const lodash_1 = __importDefault(require("lodash"));
const provider_1 = require("../providers/provider");
const routers_1 = require("../routers");
const util_1 = require("../util");
const methodParameters_1 = require("./methodParameters");
async function getV2NativePool(token, poolProvider, providerConfig) {
    const chainId = token.chainId;
    const weth = util_1.WRAPPED_NATIVE_CURRENCY[chainId];
    if (!weth)
        throw new Error('No wrapped native token for this chain');
    const poolAccessor = await poolProvider.getPools([[weth, token]], providerConfig);
    const pool = poolAccessor.getPool(weth, token);
    if (!pool || pool.reserve0.equalTo(0) || pool.reserve1.equalTo(0)) {
        util_1.log.error({
            weth,
            token,
            reserve0: pool === null || pool === void 0 ? void 0 : pool.reserve0.toExact(),
            reserve1: pool === null || pool === void 0 ? void 0 : pool.reserve1.toExact(),
        }, `Could not find a valid WETH V2 pool with ${token.symbol} for computing gas costs.`);
        return null;
    }
    return pool;
}
exports.getV2NativePool = getV2NativePool;
async function getHighestLiquidityV3NativePool(token, poolProvider, providerConfig) {
    const nativeCurrency = util_1.WRAPPED_NATIVE_CURRENCY[token.chainId];
    if (!nativeCurrency)
        throw new Error('No wrapped native token for this chain');
    const feeAmounts = (0, util_1.getApplicableV3FeeAmounts)();
    const nativePools = (0, lodash_1.default)(feeAmounts)
        .map((feeAmount) => {
        return [nativeCurrency, token, feeAmount];
    })
        .value();
    const poolAccessor = await poolProvider.getPools(nativePools, providerConfig);
    const pools = (0, lodash_1.default)(feeAmounts)
        .map((feeAmount) => {
        return poolAccessor.getPool(nativeCurrency, token, feeAmount);
    })
        .compact()
        .value();
    if (pools.length == 0) {
        util_1.log.error({ pools }, `Could not find a ${nativeCurrency.symbol} pool with ${token.symbol} for computing gas costs.`);
        return null;
    }
    const maxPool = pools.reduce((prev, current) => {
        return jsbi_1.default.greaterThan(prev.liquidity, current.liquidity) ? prev : current;
    });
    return maxPool;
}
exports.getHighestLiquidityV3NativePool = getHighestLiquidityV3NativePool;
async function getHighestLiquidityV3USDPool(chainId, poolProvider, providerConfig) {
    const usdTokens = routers_1.usdGasTokensByChain[chainId];
    const wrappedCurrency = util_1.WRAPPED_NATIVE_CURRENCY[chainId];
    if (!wrappedCurrency)
        throw new Error('No wrapped native token for this chain');
    if (!usdTokens) {
        throw new Error(`Could not find a USD token for computing gas costs on ${chainId}`);
    }
    const feeAmounts = (0, util_1.getApplicableV3FeeAmounts)();
    const usdPools = (0, lodash_1.default)(feeAmounts)
        .flatMap((feeAmount) => {
        return lodash_1.default.map(usdTokens, (usdToken) => [
            wrappedCurrency,
            usdToken,
            feeAmount,
        ]);
    })
        .value();
    const poolAccessor = await poolProvider.getPools(usdPools, providerConfig);
    const pools = (0, lodash_1.default)(feeAmounts)
        .flatMap((feeAmount) => {
        const pools = [];
        for (const usdToken of usdTokens) {
            const pool = poolAccessor.getPool(wrappedCurrency, usdToken, feeAmount);
            if (pool) {
                pools.push(pool);
            }
        }
        return pools;
    })
        .compact()
        .value();
    if (pools.length == 0) {
        const message = `Could not find a USD/${wrappedCurrency.symbol} pool for computing gas costs.`;
        util_1.log.error({ pools }, message);
        throw new Error(message);
    }
    const maxPool = pools.reduce((prev, current) => {
        return jsbi_1.default.greaterThan(prev.liquidity, current.liquidity) ? prev : current;
    });
    return maxPool;
}
exports.getHighestLiquidityV3USDPool = getHighestLiquidityV3USDPool;
function getGasCostInNativeCurrency(nativeCurrency, gasCostInWei) {
    // wrap fee to native currency
    const costNativeCurrency = util_1.CurrencyAmount.fromRawAmount(nativeCurrency, gasCostInWei.toString());
    return costNativeCurrency;
}
exports.getGasCostInNativeCurrency = getGasCostInNativeCurrency;
function getArbitrumBytes(data) {
    if (data == '')
        return bignumber_1.BigNumber.from(0);
    const compressed = brotli_1.default.compress(Buffer.from(data.replace('0x', ''), 'hex'), {
        mode: 0,
        quality: 1,
        lgwin: 22,
    });
    // TODO: This is a rough estimate of the compressed size
    // Brotli 0 should be used, but this brotli library doesn't support it
    // https://github.com/foliojs/brotli.js/issues/38
    // There are other brotli libraries that do support it, but require async
    // We workaround by using Brotli 1 with a 20% bump in size
    return bignumber_1.BigNumber.from(compressed.length).mul(120).div(100);
}
exports.getArbitrumBytes = getArbitrumBytes;
function calculateArbitrumToL1FeeFromCalldata(calldata, gasData, chainId) {
    const { perL2TxFee, perL1CalldataFee, perArbGasTotal } = gasData;
    // calculates gas amounts based on bytes of calldata, use 0 as overhead.
    const l1GasUsed = getL2ToL1GasUsed(calldata, chainId);
    // multiply by the fee per calldata and add the flat l2 fee
    const l1Fee = l1GasUsed.mul(perL1CalldataFee).add(perL2TxFee);
    const gasUsedL1OnL2 = l1Fee.div(perArbGasTotal);
    return [l1GasUsed, l1Fee, gasUsedL1OnL2];
}
exports.calculateArbitrumToL1FeeFromCalldata = calculateArbitrumToL1FeeFromCalldata;
async function calculateOptimismToL1FeeFromCalldata() {
    // This logic is now unreachable since OPTIMISM is not supported
    throw new Error('Optimism is not supported in this environment.');
}
exports.calculateOptimismToL1FeeFromCalldata = calculateOptimismToL1FeeFromCalldata;
function getL2ToL1GasUsed(data, chainId) {
    switch (chainId) {
        case sdk_core_1.ChainId.ARBITRUM_SEPOLIA: {
            // calculates bytes of compressed calldata
            const l1ByteUsed = getArbitrumBytes(data);
            return l1ByteUsed.mul(16);
        }
        default:
            return bignumber_1.BigNumber.from(0);
    }
}
exports.getL2ToL1GasUsed = getL2ToL1GasUsed;
async function calculateGasUsed(chainId, route, simulatedGasUsed, v2PoolProvider, v3PoolProvider, providerConfig) {
    const quoteToken = route.quote.currency.wrapped;
    const gasPriceWei = route.gasPriceWei;
    // calculate L2 to L1 security fee if relevant
    let l2toL1FeeInWei = bignumber_1.BigNumber.from(0);
    // Arbitrum charges L2 gas for L1 calldata posting costs.
    // See https://github.com/Uniswap/smart-order-router/pull/464/files#r1441376802
    if (chainId === sdk_core_1.ChainId.ARBITRUM_SEPOLIA) {
        l2toL1FeeInWei = (calculateArbitrumToL1FeeFromCalldata((() => {
            if (!route.methodParameters || !route.methodParameters.calldata) {
                throw new Error('Missing methodParameters or calldata');
            }
            return route.methodParameters.calldata;
        })(), (providerConfig && 'l2GasData' in providerConfig ? providerConfig.l2GasData : undefined), chainId))[1];
    }
    // add l2 to l1 fee and wrap fee to native currency
    const nativeCurrency = util_1.WRAPPED_NATIVE_CURRENCY[chainId];
    if (!nativeCurrency)
        throw new Error('No wrapped native token for this chain');
    const gasCostInWei = gasPriceWei.mul(simulatedGasUsed).add(l2toL1FeeInWei);
    const costNativeCurrency = getGasCostInNativeCurrency(nativeCurrency, gasCostInWei);
    const usdPool = await getHighestLiquidityV3USDPool(chainId, v3PoolProvider, providerConfig);
    /** ------ MARK: USD logic  -------- */
    const gasCostUSD = (0, routers_1.getQuoteThroughNativePool)(chainId, costNativeCurrency, usdPool);
    /** ------ MARK: Conditional logic run if gasToken is specified  -------- */
    let gasCostInTermsOfGasToken = undefined;
    if (providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.gasToken) {
        if (providerConfig.gasToken.equals(nativeCurrency)) {
            gasCostInTermsOfGasToken = costNativeCurrency;
        }
        else {
            const nativeAndSpecifiedGasTokenPool = await getHighestLiquidityV3NativePool(providerConfig.gasToken, v3PoolProvider, providerConfig);
            if (nativeAndSpecifiedGasTokenPool) {
                gasCostInTermsOfGasToken = (0, routers_1.getQuoteThroughNativePool)(chainId, costNativeCurrency, nativeAndSpecifiedGasTokenPool);
            }
            else {
                util_1.log.info(`Could not find a V3 pool for gas token ${providerConfig.gasToken.symbol}`);
            }
        }
    }
    /** ------ MARK: Main gas logic in terms of quote token -------- */
    let gasCostQuoteToken = undefined;
    // shortcut if quote token is native currency
    if (quoteToken.equals(nativeCurrency)) {
        gasCostQuoteToken = costNativeCurrency;
    }
    // get fee in terms of quote token
    else {
        const nativePools = await Promise.all([
            getHighestLiquidityV3NativePool(quoteToken, v3PoolProvider, providerConfig),
            getV2NativePool(quoteToken, v2PoolProvider, providerConfig),
        ]);
        const nativePool = nativePools.find((pool) => pool !== null);
        if (!nativePool) {
            util_1.log.info('Could not find any V2 or V3 pools to convert the cost into the quote token');
            gasCostQuoteToken = util_1.CurrencyAmount.fromRawAmount(quoteToken, 0);
        }
        else {
            gasCostQuoteToken = (0, routers_1.getQuoteThroughNativePool)(chainId, costNativeCurrency, nativePool);
        }
    }
    // Adjust quote for gas fees
    let quoteGasAdjusted;
    if (route.trade.tradeType == sdk_core_1.TradeType.EXACT_OUTPUT) {
        // Exact output - need more of tokenIn to get the desired amount of tokenOut
        quoteGasAdjusted = route.quote.add(gasCostQuoteToken);
    }
    else {
        // Exact input - can get less of tokenOut due to fees
        quoteGasAdjusted = route.quote.subtract(gasCostQuoteToken);
    }
    return {
        estimatedGasUsedUSD: gasCostUSD,
        estimatedGasUsedQuoteToken: gasCostQuoteToken,
        estimatedGasUsedGasToken: gasCostInTermsOfGasToken,
        quoteGasAdjusted: quoteGasAdjusted,
    };
}
exports.calculateGasUsed = calculateGasUsed;
function initSwapRouteFromExisting(swapRoute, v2PoolProvider, v3PoolProvider, portionProvider, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedQuoteToken, estimatedGasUsedUSD, swapOptions, estimatedGasUsedGasToken, providerConfig) {
    const currencyIn = swapRoute.trade.inputAmount.currency;
    const currencyOut = swapRoute.trade.outputAmount.currency;
    const tradeType = swapRoute.trade.tradeType.valueOf()
        ? sdk_core_1.TradeType.EXACT_OUTPUT
        : sdk_core_1.TradeType.EXACT_INPUT;
    const routesWithValidQuote = swapRoute.route.map((route) => {
        switch (route.protocol) {
            case router_sdk_1.Protocol.V3:
                return new routers_1.V3RouteWithValidQuote({
                    amount: util_1.CurrencyAmount.fromFractionalAmount(route.amount.currency, route.amount.numerator, route.amount.denominator),
                    rawQuote: bignumber_1.BigNumber.from(route.rawQuote),
                    sqrtPriceX96AfterList: route.sqrtPriceX96AfterList.map((num) => bignumber_1.BigNumber.from(num)),
                    initializedTicksCrossedList: [...route.initializedTicksCrossedList],
                    quoterGasEstimate: bignumber_1.BigNumber.from(route.gasEstimate),
                    percent: route.percent,
                    route: route.route,
                    gasModel: route.gasModel,
                    quoteToken: new sdk_core_1.Token(currencyIn.chainId, route.quoteToken.address, route.quoteToken.decimals, route.quoteToken.symbol, route.quoteToken.name),
                    tradeType: tradeType,
                    v3PoolProvider: v3PoolProvider,
                });
            case router_sdk_1.Protocol.V2:
                return new routers_1.V2RouteWithValidQuote({
                    amount: util_1.CurrencyAmount.fromFractionalAmount(route.amount.currency, route.amount.numerator, route.amount.denominator),
                    rawQuote: bignumber_1.BigNumber.from(route.rawQuote),
                    percent: route.percent,
                    route: route.route,
                    gasModel: route.gasModel,
                    quoteToken: new sdk_core_1.Token(currencyIn.chainId, route.quoteToken.address, route.quoteToken.decimals, route.quoteToken.symbol, route.quoteToken.name),
                    tradeType: tradeType,
                    v2PoolProvider: v2PoolProvider,
                });
            case router_sdk_1.Protocol.MIXED:
                return new routers_1.MixedRouteWithValidQuote({
                    amount: util_1.CurrencyAmount.fromFractionalAmount(route.amount.currency, route.amount.numerator, route.amount.denominator),
                    rawQuote: bignumber_1.BigNumber.from(route.rawQuote),
                    sqrtPriceX96AfterList: route.sqrtPriceX96AfterList.map((num) => bignumber_1.BigNumber.from(num)),
                    initializedTicksCrossedList: [...route.initializedTicksCrossedList],
                    quoterGasEstimate: bignumber_1.BigNumber.from(route.gasEstimate),
                    percent: route.percent,
                    route: route.route,
                    mixedRouteGasModel: route.gasModel,
                    v2PoolProvider,
                    quoteToken: new sdk_core_1.Token(currencyIn.chainId, route.quoteToken.address, route.quoteToken.decimals, route.quoteToken.symbol, route.quoteToken.name),
                    tradeType: tradeType,
                    v3PoolProvider: v3PoolProvider,
                });
            default:
                throw new Error('Invalid protocol');
        }
    });
    const trade = (0, methodParameters_1.buildTrade)(currencyIn, currencyOut, tradeType, routesWithValidQuote);
    const quoteGasAndPortionAdjusted = swapRoute.portionAmount
        ? portionProvider.getQuoteGasAndPortionAdjusted(swapRoute.trade.tradeType, quoteGasAdjusted, swapRoute.portionAmount)
        : undefined;
    const routesWithValidQuotePortionAdjusted = portionProvider.getRouteWithQuotePortionAdjusted(swapRoute.trade.tradeType, routesWithValidQuote, swapOptions, providerConfig);
    return {
        quote: swapRoute.quote,
        quoteGasAdjusted,
        quoteGasAndPortionAdjusted,
        estimatedGasUsed,
        estimatedGasUsedQuoteToken,
        estimatedGasUsedGasToken,
        estimatedGasUsedUSD,
        gasPriceWei: bignumber_1.BigNumber.from(swapRoute.gasPriceWei),
        trade,
        route: routesWithValidQuotePortionAdjusted,
        blockNumber: bignumber_1.BigNumber.from(swapRoute.blockNumber),
        methodParameters: swapRoute.methodParameters
            ? {
                calldata: swapRoute.methodParameters.calldata,
                value: swapRoute.methodParameters.value,
                to: swapRoute.methodParameters.to,
            }
            : undefined,
        simulationStatus: swapRoute.simulationStatus,
        portionAmount: swapRoute.portionAmount,
    };
}
exports.initSwapRouteFromExisting = initSwapRouteFromExisting;
const calculateL1GasFeesHelper = async (route, chainId, usdPool, quoteToken, nativePool, providerConfig) => {
    const swapOptions = {
        type: routers_1.SwapType.UNIVERSAL_ROUTER,
        version: provider_1.UniversalRouterVersion.V1_2,
        recipient: '0x0000000000000000000000000000000000000001',
        deadlineOrPreviousBlockhash: 100,
        slippageTolerance: new sdk_core_1.Percent(5, 10000),
    };
    let mainnetGasUsed = bignumber_1.BigNumber.from(0);
    let mainnetFeeInWei = bignumber_1.BigNumber.from(0);
    let gasUsedL1OnL2 = bignumber_1.BigNumber.from(0);
    if (chainId === sdk_core_1.ChainId.ARBITRUM_SEPOLIA) {
        [mainnetGasUsed, mainnetFeeInWei, gasUsedL1OnL2] =
            calculateArbitrumToL1SecurityFee(route, swapOptions, (providerConfig && 'l2GasData' in providerConfig ? providerConfig.l2GasData : undefined), chainId);
    }
    // wrap fee to native currency
    const nativeCurrency = util_1.WRAPPED_NATIVE_CURRENCY[chainId];
    if (!nativeCurrency)
        throw new Error('No wrapped native token for this chain');
    const costNativeCurrency = util_1.CurrencyAmount.fromRawAmount(nativeCurrency, mainnetFeeInWei.toString());
    // convert fee into usd
    const gasCostL1USD = (0, routers_1.getQuoteThroughNativePool)(chainId, costNativeCurrency, usdPool);
    let gasCostL1QuoteToken = costNativeCurrency;
    // if the inputted token is not in the native currency, quote a native/quote token pool to get the gas cost in terms of the quote token
    if (!quoteToken.equals(nativeCurrency)) {
        if (!nativePool) {
            util_1.log.info('Could not find a pool to convert the cost into the quote token');
            gasCostL1QuoteToken = util_1.CurrencyAmount.fromRawAmount(quoteToken, 0);
        }
        else {
            const nativeTokenPrice = nativePool.token0.address == nativeCurrency.address
                ? nativePool.token0Price
                : nativePool.token1Price;
            gasCostL1QuoteToken = nativeTokenPrice.quote(costNativeCurrency);
        }
    }
    // gasUsedL1 is the gas units used calculated from the bytes of the calldata
    // gasCostL1USD and gasCostL1QuoteToken is the cost of gas in each of those tokens
    return {
        gasUsedL1: mainnetGasUsed,
        gasUsedL1OnL2,
        gasCostL1USD,
        gasCostL1QuoteToken,
    };
    function calculateArbitrumToL1SecurityFee(routes, swapConfig, gasData, chainId) {
        const route = routes[0];
        if (!route)
            throw new Error('No route provided');
        const amountToken = route.tradeType == sdk_core_1.TradeType.EXACT_INPUT
            ? route.amount.currency
            : route.quote.currency;
        const outputToken = route.tradeType == sdk_core_1.TradeType.EXACT_INPUT
            ? route.quote.currency
            : route.amount.currency;
        // build trade for swap calldata
        const trade = (0, methodParameters_1.buildTrade)(amountToken, outputToken, route.tradeType, routes);
        const data = (0, methodParameters_1.buildSwapMethodParameters)(trade, swapConfig, sdk_core_1.ChainId.ARBITRUM_SEPOLIA).calldata;
        if (!gasData)
            throw new Error('Missing ArbitrumGasData');
        return calculateArbitrumToL1FeeFromCalldata(data, gasData, chainId);
    }
};
exports.calculateL1GasFeesHelper = calculateL1GasFeesHelper;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FzLWZhY3RvcnktaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy91dGlsL2dhcy1mYWN0b3J5LWhlbHBlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsd0RBQXFEO0FBQ3JELGtEQUE2QztBQUM3Qyw4Q0FBcUU7QUFHckUsb0RBQTRCO0FBQzVCLGdEQUF3QjtBQUN4QixvREFBdUI7QUFJdkIsb0RBQStFO0FBRy9FLHdDQWFvQjtBQUNwQixrQ0FLaUI7QUFFakIseURBQTJFO0FBRXBFLEtBQUssVUFBVSxlQUFlLENBQ25DLEtBQVksRUFDWixZQUE2QixFQUM3QixjQUF1QztJQUV2QyxNQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsT0FBa0IsQ0FBQztJQUN6QyxNQUFNLElBQUksR0FBRyw4QkFBdUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUM5QyxJQUFJLENBQUMsSUFBSTtRQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsd0NBQXdDLENBQUMsQ0FBQztJQUVyRSxNQUFNLFlBQVksR0FBRyxNQUFNLFlBQVksQ0FBQyxRQUFRLENBQzlDLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsRUFDZixjQUFjLENBQ2YsQ0FBQztJQUNGLE1BQU0sSUFBSSxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBRS9DLElBQUksQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUU7UUFDakUsVUFBRyxDQUFDLEtBQUssQ0FDUDtZQUNFLElBQUk7WUFDSixLQUFLO1lBQ0wsUUFBUSxFQUFFLElBQUksYUFBSixJQUFJLHVCQUFKLElBQUksQ0FBRSxRQUFRLENBQUMsT0FBTyxFQUFFO1lBQ2xDLFFBQVEsRUFBRSxJQUFJLGFB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