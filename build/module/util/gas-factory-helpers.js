import { BigNumber } from '@ethersproject/bignumber';
import { Protocol } from '@surge/router-sdk';
import { ChainId, Percent, Token, TradeType } from '@surge/sdk-core';
import brotli from 'brotli';
import JSBI from 'jsbi';
import _ from 'lodash';
import { UniversalRouterVersion } from '../providers/provider';
import { getQuoteThroughNativePool, MixedRouteWithValidQuote, SwapType, usdGasTokensByChain, V2RouteWithValidQuote, V3RouteWithValidQuote, } from '../routers';
import { CurrencyAmount, getApplicableV3FeeAmounts, log, WRAPPED_NATIVE_CURRENCY, } from '../util';
import { buildSwapMethodParameters, buildTrade } from './methodParameters';
export async function getV2NativePool(token, poolProvider, providerConfig) {
    const chainId = token.chainId;
    const weth = WRAPPED_NATIVE_CURRENCY[chainId];
    if (!weth)
        throw new Error('No wrapped native token for this chain');
    const poolAccessor = await poolProvider.getPools([[weth, token]], providerConfig);
    const pool = poolAccessor.getPool(weth, token);
    if (!pool || pool.reserve0.equalTo(0) || pool.reserve1.equalTo(0)) {
        log.error({
            weth,
            token,
            reserve0: pool === null || pool === void 0 ? void 0 : pool.reserve0.toExact(),
            reserve1: pool === null || pool === void 0 ? void 0 : pool.reserve1.toExact(),
        }, `Could not find a valid WETH V2 pool with ${token.symbol} for computing gas costs.`);
        return null;
    }
    return pool;
}
export async function getHighestLiquidityV3NativePool(token, poolProvider, providerConfig) {
    const nativeCurrency = WRAPPED_NATIVE_CURRENCY[token.chainId];
    if (!nativeCurrency)
        throw new Error('No wrapped native token for this chain');
    const feeAmounts = getApplicableV3FeeAmounts();
    const nativePools = _(feeAmounts)
        .map((feeAmount) => {
        return [nativeCurrency, token, feeAmount];
    })
        .value();
    const poolAccessor = await poolProvider.getPools(nativePools, providerConfig);
    const pools = _(feeAmounts)
        .map((feeAmount) => {
        return poolAccessor.getPool(nativeCurrency, token, feeAmount);
    })
        .compact()
        .value();
    if (pools.length == 0) {
        log.error({ pools }, `Could not find a ${nativeCurrency.symbol} pool with ${token.symbol} for computing gas costs.`);
        return null;
    }
    const maxPool = pools.reduce((prev, current) => {
        return JSBI.greaterThan(prev.liquidity, current.liquidity) ? prev : current;
    });
    return maxPool;
}
export async function getHighestLiquidityV3USDPool(chainId, poolProvider, providerConfig) {
    const usdTokens = usdGasTokensByChain[chainId];
    const wrappedCurrency = WRAPPED_NATIVE_CURRENCY[chainId];
    if (!wrappedCurrency)
        throw new Error('No wrapped native token for this chain');
    if (!usdTokens) {
        throw new Error(`Could not find a USD token for computing gas costs on ${chainId}`);
    }
    const feeAmounts = getApplicableV3FeeAmounts();
    const usdPools = _(feeAmounts)
        .flatMap((feeAmount) => {
        return _.map(usdTokens, (usdToken) => [
            wrappedCurrency,
            usdToken,
            feeAmount,
        ]);
    })
        .value();
    const poolAccessor = await poolProvider.getPools(usdPools, providerConfig);
    const pools = _(feeAmounts)
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
        log.error({ pools }, message);
        throw new Error(message);
    }
    const maxPool = pools.reduce((prev, current) => {
        return JSBI.greaterThan(prev.liquidity, current.liquidity) ? prev : current;
    });
    return maxPool;
}
export function getGasCostInNativeCurrency(nativeCurrency, gasCostInWei) {
    // wrap fee to native currency
    const costNativeCurrency = CurrencyAmount.fromRawAmount(nativeCurrency, gasCostInWei.toString());
    return costNativeCurrency;
}
export function getArbitrumBytes(data) {
    if (data == '')
        return BigNumber.from(0);
    const compressed = brotli.compress(Buffer.from(data.replace('0x', ''), 'hex'), {
        mode: 0,
        quality: 1,
        lgwin: 22,
    });
    // TODO: This is a rough estimate of the compressed size
    // Brotli 0 should be used, but this brotli library doesn't support it
    // https://github.com/foliojs/brotli.js/issues/38
    // There are other brotli libraries that do support it, but require async
    // We workaround by using Brotli 1 with a 20% bump in size
    return BigNumber.from(compressed.length).mul(120).div(100);
}
export function calculateArbitrumToL1FeeFromCalldata(calldata, gasData, chainId) {
    const { perL2TxFee, perL1CalldataFee, perArbGasTotal } = gasData;
    // calculates gas amounts based on bytes of calldata, use 0 as overhead.
    const l1GasUsed = getL2ToL1GasUsed(calldata, chainId);
    // multiply by the fee per calldata and add the flat l2 fee
    const l1Fee = l1GasUsed.mul(perL1CalldataFee).add(perL2TxFee);
    const gasUsedL1OnL2 = l1Fee.div(perArbGasTotal);
    return [l1GasUsed, l1Fee, gasUsedL1OnL2];
}
export async function calculateOptimismToL1FeeFromCalldata() {
    // This logic is now unreachable since OPTIMISM is not supported
    throw new Error('Optimism is not supported in this environment.');
}
export function getL2ToL1GasUsed(data, chainId) {
    switch (chainId) {
        case ChainId.ARBITRUM_SEPOLIA: {
            // calculates bytes of compressed calldata
            const l1ByteUsed = getArbitrumBytes(data);
            return l1ByteUsed.mul(16);
        }
        default:
            return BigNumber.from(0);
    }
}
export async function calculateGasUsed(chainId, route, simulatedGasUsed, v2PoolProvider, v3PoolProvider, providerConfig) {
    const quoteToken = route.quote.currency.wrapped;
    const gasPriceWei = route.gasPriceWei;
    // calculate L2 to L1 security fee if relevant
    let l2toL1FeeInWei = BigNumber.from(0);
    // Arbitrum charges L2 gas for L1 calldata posting costs.
    // See https://github.com/Uniswap/smart-order-router/pull/464/files#r1441376802
    if (chainId === ChainId.ARBITRUM_SEPOLIA) {
        l2toL1FeeInWei = (calculateArbitrumToL1FeeFromCalldata((() => {
            if (!route.methodParameters || !route.methodParameters.calldata) {
                throw new Error('Missing methodParameters or calldata');
            }
            return route.methodParameters.calldata;
        })(), (providerConfig && 'l2GasData' in providerConfig ? providerConfig.l2GasData : undefined), chainId))[1];
    }
    // add l2 to l1 fee and wrap fee to native currency
    const nativeCurrency = WRAPPED_NATIVE_CURRENCY[chainId];
    if (!nativeCurrency)
        throw new Error('No wrapped native token for this chain');
    const gasCostInWei = gasPriceWei.mul(simulatedGasUsed).add(l2toL1FeeInWei);
    const costNativeCurrency = getGasCostInNativeCurrency(nativeCurrency, gasCostInWei);
    const usdPool = await getHighestLiquidityV3USDPool(chainId, v3PoolProvider, providerConfig);
    /** ------ MARK: USD logic  -------- */
    const gasCostUSD = getQuoteThroughNativePool(chainId, costNativeCurrency, usdPool);
    /** ------ MARK: Conditional logic run if gasToken is specified  -------- */
    let gasCostInTermsOfGasToken = undefined;
    if (providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.gasToken) {
        if (providerConfig.gasToken.equals(nativeCurrency)) {
            gasCostInTermsOfGasToken = costNativeCurrency;
        }
        else {
            const nativeAndSpecifiedGasTokenPool = await getHighestLiquidityV3NativePool(providerConfig.gasToken, v3PoolProvider, providerConfig);
            if (nativeAndSpecifiedGasTokenPool) {
                gasCostInTermsOfGasToken = getQuoteThroughNativePool(chainId, costNativeCurrency, nativeAndSpecifiedGasTokenPool);
            }
            else {
                log.info(`Could not find a V3 pool for gas token ${providerConfig.gasToken.symbol}`);
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
            log.info('Could not find any V2 or V3 pools to convert the cost into the quote token');
            gasCostQuoteToken = CurrencyAmount.fromRawAmount(quoteToken, 0);
        }
        else {
            gasCostQuoteToken = getQuoteThroughNativePool(chainId, costNativeCurrency, nativePool);
        }
    }
    // Adjust quote for gas fees
    let quoteGasAdjusted;
    if (route.trade.tradeType == TradeType.EXACT_OUTPUT) {
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
export function initSwapRouteFromExisting(swapRoute, v2PoolProvider, v3PoolProvider, portionProvider, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedQuoteToken, estimatedGasUsedUSD, swapOptions, estimatedGasUsedGasToken, providerConfig) {
    const currencyIn = swapRoute.trade.inputAmount.currency;
    const currencyOut = swapRoute.trade.outputAmount.currency;
    const tradeType = swapRoute.trade.tradeType.valueOf()
        ? TradeType.EXACT_OUTPUT
        : TradeType.EXACT_INPUT;
    const routesWithValidQuote = swapRoute.route.map((route) => {
        switch (route.protocol) {
            case Protocol.V3:
                return new V3RouteWithValidQuote({
                    amount: CurrencyAmount.fromFractionalAmount(route.amount.currency, route.amount.numerator, route.amount.denominator),
                    rawQuote: BigNumber.from(route.rawQuote),
                    sqrtPriceX96AfterList: route.sqrtPriceX96AfterList.map((num) => BigNumber.from(num)),
                    initializedTicksCrossedList: [...route.initializedTicksCrossedList],
                    quoterGasEstimate: BigNumber.from(route.gasEstimate),
                    percent: route.percent,
                    route: route.route,
                    gasModel: route.gasModel,
                    quoteToken: new Token(currencyIn.chainId, route.quoteToken.address, route.quoteToken.decimals, route.quoteToken.symbol, route.quoteToken.name),
                    tradeType: tradeType,
                    v3PoolProvider: v3PoolProvider,
                });
            case Protocol.V2:
                return new V2RouteWithValidQuote({
                    amount: CurrencyAmount.fromFractionalAmount(route.amount.currency, route.amount.numerator, route.amount.denominator),
                    rawQuote: BigNumber.from(route.rawQuote),
                    percent: route.percent,
                    route: route.route,
                    gasModel: route.gasModel,
                    quoteToken: new Token(currencyIn.chainId, route.quoteToken.address, route.quoteToken.decimals, route.quoteToken.symbol, route.quoteToken.name),
                    tradeType: tradeType,
                    v2PoolProvider: v2PoolProvider,
                });
            case Protocol.MIXED:
                return new MixedRouteWithValidQuote({
                    amount: CurrencyAmount.fromFractionalAmount(route.amount.currency, route.amount.numerator, route.amount.denominator),
                    rawQuote: BigNumber.from(route.rawQuote),
                    sqrtPriceX96AfterList: route.sqrtPriceX96AfterList.map((num) => BigNumber.from(num)),
                    initializedTicksCrossedList: [...route.initializedTicksCrossedList],
                    quoterGasEstimate: BigNumber.from(route.gasEstimate),
                    percent: route.percent,
                    route: route.route,
                    mixedRouteGasModel: route.gasModel,
                    v2PoolProvider,
                    quoteToken: new Token(currencyIn.chainId, route.quoteToken.address, route.quoteToken.decimals, route.quoteToken.symbol, route.quoteToken.name),
                    tradeType: tradeType,
                    v3PoolProvider: v3PoolProvider,
                });
            default:
                throw new Error('Invalid protocol');
        }
    });
    const trade = buildTrade(currencyIn, currencyOut, tradeType, routesWithValidQuote);
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
        gasPriceWei: BigNumber.from(swapRoute.gasPriceWei),
        trade,
        route: routesWithValidQuotePortionAdjusted,
        blockNumber: BigNumber.from(swapRoute.blockNumber),
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
export const calculateL1GasFeesHelper = async (route, chainId, usdPool, quoteToken, nativePool, providerConfig) => {
    const swapOptions = {
        type: SwapType.UNIVERSAL_ROUTER,
        version: UniversalRouterVersion.V1_2,
        recipient: '0x0000000000000000000000000000000000000001',
        deadlineOrPreviousBlockhash: 100,
        slippageTolerance: new Percent(5, 10000),
    };
    let mainnetGasUsed = BigNumber.from(0);
    let mainnetFeeInWei = BigNumber.from(0);
    let gasUsedL1OnL2 = BigNumber.from(0);
    if (chainId === ChainId.ARBITRUM_SEPOLIA) {
        [mainnetGasUsed, mainnetFeeInWei, gasUsedL1OnL2] =
            calculateArbitrumToL1SecurityFee(route, swapOptions, (providerConfig && 'l2GasData' in providerConfig ? providerConfig.l2GasData : undefined), chainId);
    }
    // wrap fee to native currency
    const nativeCurrency = WRAPPED_NATIVE_CURRENCY[chainId];
    if (!nativeCurrency)
        throw new Error('No wrapped native token for this chain');
    const costNativeCurrency = CurrencyAmount.fromRawAmount(nativeCurrency, mainnetFeeInWei.toString());
    // convert fee into usd
    const gasCostL1USD = getQuoteThroughNativePool(chainId, costNativeCurrency, usdPool);
    let gasCostL1QuoteToken = costNativeCurrency;
    // if the inputted token is not in the native currency, quote a native/quote token pool to get the gas cost in terms of the quote token
    if (!quoteToken.equals(nativeCurrency)) {
        if (!nativePool) {
            log.info('Could not find a pool to convert the cost into the quote token');
            gasCostL1QuoteToken = CurrencyAmount.fromRawAmount(quoteToken, 0);
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
        const amountToken = route.tradeType == TradeType.EXACT_INPUT
            ? route.amount.currency
            : route.quote.currency;
        const outputToken = route.tradeType == TradeType.EXACT_INPUT
            ? route.quote.currency
            : route.amount.currency;
        // build trade for swap calldata
        const trade = buildTrade(amountToken, outputToken, route.tradeType, routes);
        const data = buildSwapMethodParameters(trade, swapConfig, ChainId.ARBITRUM_SEPOLIA).calldata;
        if (!gasData)
            throw new Error('Missing ArbitrumGasData');
        return calculateArbitrumToL1FeeFromCalldata(data, gasData, chainId);
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FzLWZhY3RvcnktaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy91dGlsL2dhcy1mYWN0b3J5LWhlbHBlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3JELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUM3QyxPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFHckUsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sSUFBSSxNQUFNLE1BQU0sQ0FBQztBQUN4QixPQUFPLENBQUMsTUFBTSxRQUFRLENBQUM7QUFJdkIsT0FBTyxFQUFrQixzQkFBc0IsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBRy9FLE9BQU8sRUFFTCx5QkFBeUIsRUFFekIsd0JBQXdCLEVBS3hCLFFBQVEsRUFDUixtQkFBbUIsRUFDbkIscUJBQXFCLEVBQ3JCLHFCQUFxQixHQUN0QixNQUFNLFlBQVksQ0FBQztBQUNwQixPQUFPLEVBQ0wsY0FBYyxFQUNkLHlCQUF5QixFQUN6QixHQUFHLEVBQ0gsdUJBQXVCLEdBQ3hCLE1BQU0sU0FBUyxDQUFDO0FBRWpCLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxVQUFVLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUUzRSxNQUFNLENBQUMsS0FBSyxVQUFVLGVBQWUsQ0FDbkMsS0FBWSxFQUNaLFlBQTZCLEVBQzdCLGNBQXVDO0lBRXZDLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxPQUFrQixDQUFDO0lBQ3pDLE1BQU0sSUFBSSxHQUFHLHVCQUF1QixDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQzlDLElBQUksQ0FBQyxJQUFJO1FBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyx3Q0FBd0MsQ0FBQyxDQUFDO0lBRXJFLE1B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