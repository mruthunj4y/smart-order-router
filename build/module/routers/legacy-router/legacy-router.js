import { BigNumber } from '@ethersproject/bignumber';
import { Logger } from '@ethersproject/logger';
import { SwapRouter, Trade } from '@surge/router-sdk';
import { TradeType } from '@surge/sdk-core';
import { FeeAmount, Route } from '@surge/v3-sdk';
import _ from 'lodash';
import { DAI_XRPL_EVM_TESTNET, USDC_XRPL_EVM_TESTNET, } from '../../providers/token-provider';
import { SWAP_ROUTER_02_ADDRESSES } from '../../util';
import { CurrencyAmount } from '../../util/amounts';
import { log } from '../../util/log';
import { routeToString } from '../../util/routes';
import { V3RouteWithValidQuote } from '../alpha-router';
import { V3Route } from '../router';
import { ADDITIONAL_BASES, BASES_TO_CHECK_TRADES_AGAINST, CUSTOM_BASES, } from './bases';
// Interface defaults to 2.
const MAX_HOPS = 2;
/**
 * Replicates the router implemented in the V3 interface.
 * Code is mostly a copy from https://github.com/Uniswap/uniswap-interface/blob/0190b5a408c13016c87e1030ffc59326c085f389/src/hooks/useBestV3Trade.ts#L22-L23
 * with React/Redux hooks removed, and refactoring to allow re-use in other routers.
 */
export class LegacyRouter {
    constructor({ chainId, multicall2Provider, poolProvider, quoteProvider, tokenProvider, }) {
        this.chainId = chainId;
        this.multicall2Provider = multicall2Provider;
        this.poolProvider = poolProvider;
        this.quoteProvider = quoteProvider;
        this.tokenProvider = tokenProvider;
    }
    async route(amount, quoteCurrency, swapType, swapConfig, partialRoutingConfig) {
        if (swapType == TradeType.EXACT_INPUT) {
            return this.routeExactIn(amount.currency, quoteCurrency, amount, swapConfig, partialRoutingConfig);
        }
        return this.routeExactOut(quoteCurrency, amount.currency, amount, swapConfig, partialRoutingConfig);
    }
    async routeExactIn(currencyIn, currencyOut, amountIn, swapConfig, routingConfig) {
        const tokenIn = currencyIn.wrapped;
        const tokenOut = currencyOut.wrapped;
        const routes = await this.getAllRoutes(tokenIn, tokenOut, routingConfig);
        const routeQuote = await this.findBestRouteExactIn(amountIn, tokenOut, routes, routingConfig);
        if (!routeQuote) {
            return null;
        }
        const trade = this.buildTrade(currencyIn, currencyOut, TradeType.EXACT_INPUT, routeQuote);
        return {
            quote: routeQuote.quote,
            quoteGasAdjusted: routeQuote.quote,
            route: [routeQuote],
            estimatedGasUsed: BigNumber.from(0),
            estimatedGasUsedQuoteToken: CurrencyAmount.fromFractionalAmount(tokenOut, 0, 1),
            estimatedGasUsedUSD: CurrencyAmount.fromFractionalAmount(DAI_XRPL_EVM_TESTNET, 0, 1),
            gasPriceWei: BigNumber.from(0),
            trade,
            methodParameters: swapConfig
                ? {
                    ...this.buildMethodParameters(trade, swapConfig),
                    to: SWAP_ROUTER_02_ADDRESSES(this.chainId),
                }
                : undefined,
            blockNumber: BigNumber.from(0),
        };
    }
    async routeExactOut(currencyIn, currencyOut, amountOut, swapConfig, routingConfig) {
        const tokenIn = currencyIn.wrapped;
        const tokenOut = currencyOut.wrapped;
        const routes = await this.getAllRoutes(tokenIn, tokenOut, routingConfig);
        const routeQuote = await this.findBestRouteExactOut(amountOut, tokenIn, routes, routingConfig);
        if (!routeQuote) {
            return null;
        }
        const trade = this.buildTrade(currencyIn, currencyOut, TradeType.EXACT_OUTPUT, routeQuote);
        return {
            quote: routeQuote.quote,
            quoteGasAdjusted: routeQuote.quote,
            route: [routeQuote],
            estimatedGasUsed: BigNumber.from(0),
            estimatedGasUsedQuoteToken: CurrencyAmount.fromFractionalAmount(tokenIn, 0, 1),
            estimatedGasUsedUSD: CurrencyAmount.fromFractionalAmount(DAI_XRPL_EVM_TESTNET, 0, 1),
            gasPriceWei: BigNumber.from(0),
            trade,
            methodParameters: swapConfig
                ? {
                    ...this.buildMethodParameters(trade, swapConfig),
                    to: SWAP_ROUTER_02_ADDRESSES(this.chainId),
                }
                : undefined,
            blockNumber: BigNumber.from(0),
        };
    }
    async findBestRouteExactIn(amountIn, tokenOut, routes, routingConfig) {
        const { routesWithQuotes: quotesRaw } = await this.quoteProvider.getQuotesManyExactIn([amountIn], routes, {
            blockNumber: routingConfig === null || routingConfig === void 0 ? void 0 : routingConfig.blockNumber,
        });
        const quotes100Percent = _.map(quotesRaw, ([route, quotes]) => { var _a, _b; return `${routeToString(route)} : ${(_b = (_a = quotes[0]) === null || _a === void 0 ? void 0 : _a.quote) === null || _b === void 0 ? void 0 : _b.toString()}`; });
        log.info({ quotes100Percent }, '100% Quotes');
        const bestQuote = await this.getBestQuote(routes, quotesRaw, tokenOut, TradeType.EXACT_INPUT);
        return bestQuote;
    }
    async findBestRouteExactOut(amountOut, tokenIn, routes, routingConfig) {
        const { routesWithQuotes: quotesRaw } = await this.quoteProvider.getQuotesManyExactOut([amountOut], routes, {
            blockNumber: routingConfig === null || routingConfig === void 0 ? void 0 : routingConfig.blockNumber,
        });
        const bestQuote = await this.getBestQuote(routes, quotesRaw, tokenIn, TradeType.EXACT_OUTPUT);
        return bestQuote;
    }
    async getBestQuote(routes, quotesRaw, quoteToken, routeType) {
        log.debug(`Got ${_.filter(quotesRaw, ([_, quotes]) => !!quotes[0]).length} valid quotes from ${routes.length} possible routes.`);
        const routeQuotesRaw = [];
        for (let i = 0; i < quotesRaw.length; i++) {
            const [route, quotes] = quotesRaw[i];
            const { quote, amount } = quotes[0];
            if (!quote) {
                Logger.globalLogger().debug(`No quote for ${routeToString(route)}`);
                continue;
            }
            routeQuotesRaw.push({ route, quote, amount });
        }
        if (routeQuotesRaw.length == 0) {
            return null;
        }
        routeQuotesRaw.sort((routeQuoteA, routeQuoteB) => {
            if (routeType == TradeType.EXACT_INPUT) {
                return routeQuoteA.quote.gt(routeQuoteB.quote) ? -1 : 1;
            }
            else {
                return routeQuoteA.quote.lt(routeQuoteB.quote) ? -1 : 1;
            }
        });
        const routeQuotes = _.map(routeQuotesRaw, ({ route, quote, amount }) => {
            return new V3RouteWithValidQuote({
                route,
                rawQuote: quote,
                amount,
                percent: 100,
                gasModel: {
                    estimateGasCost: () => ({
                        gasCostInToken: CurrencyAmount.fromRawAmount(quoteToken, 0),
                        gasCostInUSD: CurrencyAmount.fromRawAmount(USDC_XRPL_EVM_TESTNET, 0),
                        gasEstimate: BigNumber.from(0),
                    }),
                },
                sqrtPriceX96AfterList: [],
                initializedTicksCrossedList: [],
                quoterGasEstimate: BigNumber.from(0),
                tradeType: routeType,
                quoteToken,
                v3PoolProvider: this.poolProvider,
            });
        });
        for (const rq of routeQuotes) {
            log.debug(`Quote: ${rq.amount.toFixed(Math.min(rq.amount.currency.decimals, 2))} Route: ${routeToString(rq.route)}`);
        }
        return routeQuotes[0];
    }
    async getAllRoutes(tokenIn, tokenOut, routingConfig) {
        const tokenPairs = await this.getAllPossiblePairings(tokenIn, tokenOut);
        const poolAccessor = await this.poolProvider.getPools(tokenPairs, {
            blockNumber: routingConfig === null || routingConfig === void 0 ? void 0 : routingConfig.blockNumber,
        });
        const pools = poolAccessor.getAllPools();
        const routes = this.computeAllRoutes(tokenIn, tokenOut, pools, this.chainId, [], [], tokenIn, MAX_HOPS);
        log.info({ routes: _.map(routes, routeToString) }, `Computed ${routes.length} possible routes.`);
        return routes;
    }
    async getAllPossiblePairings(tokenIn, tokenOut) {
        var _a, _b, _c, _d, _e;
        const common = (_a = BASES_TO_CHECK_TRADES_AGAINST()[this.chainId]) !== null && _a !== void 0 ? _a : [];
        const additionalA = (_c = (_b = (await ADDITIONAL_BASES())[this.chainId]) === null || _b === void 0 ? void 0 : _b[tokenIn.address]) !== null && _c !== void 0 ? _c : [];
        const additionalB = (_e = (_d = (await ADDITIONAL_BASES())[this.chainId]) === null || _d === void 0 ? void 0 : _d[tokenOut.address]) !== null && _e !== void 0 ? _e : [];
        const bases = [...common, ...additionalA, ...additionalB];
        const basePairs = _.flatMap(bases, (base) => bases.map((otherBase) => [base, otherBase]));
        const customBases = (await CUSTOM_BASES())[this.chainId];
        const allPairs = _([
            // the direct pair
            [tokenIn, tokenOut],
            // token A against all bases
            ...bases.map((base) => [tokenIn, base]),
            // token B against all bases
            ...bases.map((base) => [tokenOut, base]),
            // each base against all bases
            ...basePairs,
        ])
            .filter((tokens) => Boolean(tokens[0] && tokens[1]))
            .filter(([tokenA, tokenB]) => tokenA.address !== tokenB.address && !tokenA.equals(tokenB))
            .filter(([tokenA, tokenB]) => {
            const customBasesA = customBases === null || customBases === void 0 ? void 0 : customBases[tokenA.address];
            const customBasesB = customBases === null || customBases === void 0 ? void 0 : customBases[tokenB.address];
            if (!customBasesA && !customBasesB)
                return true;
            if (customBasesA && !customBasesA.find((base) => tokenB.equals(base)))
                return false;
            if (customBasesB && !customBasesB.find((base) => tokenA.equals(base)))
                return false;
            return true;
        })
            .flatMap(([tokenA, tokenB]) => {
            return [
                [tokenA, tokenB, FeeAmount.LOW],
                [tokenA, tokenB, FeeAmount.MEDIUM],
                [tokenA, tokenB, FeeAmount.HIGH],
            ];
        })
            .value();
        return allPairs;
    }
    computeAllRoutes(tokenIn, tokenOut, pools, chainId, currentPath = [], allPaths = [], startTokenIn = tokenIn, maxHops = 2) {
        for (const pool of pools) {
            if (currentPath.indexOf(pool) !== -1 || !pool.involvesToken(tokenIn))
                continue;
            const outputToken = pool.token0.equals(tokenIn)
                ? pool.token1
                : pool.token0;
            if (outputToken.equals(tokenOut)) {
                allPaths.push(new V3Route([...currentPath, pool], startTokenIn, tokenOut));
            }
            else if (maxHops > 1) {
                this.computeAllRoutes(outputToken, tokenOut, pools, chainId, [...currentPath, pool], allPaths, startTokenIn, maxHops - 1);
            }
        }
        return allPaths;
    }
    buildTrade(tokenInCurrency, tokenOutCurrency, tradeType, routeAmount) {
        const { route, amount, quote } = routeAmount;
        // The route, amount and quote are all in terms of wrapped tokens.
        // When constructing the Trade object the inputAmount/outputAmount must
        // use native currencies if necessary. This is so that the Trade knows to wrap/unwrap.
        if (tradeType == TradeType.EXACT_INPUT) {
            const amountCurrency = CurrencyAmount.fromFractionalAmount(tokenInCurrency, amount.numerator, amount.denominator);
            const quoteCurrency = CurrencyAmount.fromFractionalAmount(tokenOutCurrency, quote.numerator, quote.denominator);
            const routeCurrency = new Route(route.pools, amountCurrency.currency, quoteCurrency.currency);
            return new Trade({
                v3Routes: [
                    {
                        routev3: routeCurrency,
                        inputAmount: amountCurrency,
                        outputAmount: quoteCurrency,
                    },
                ],
                v2Routes: [],
                tradeType: tradeType,
            });
        }
        else {
            const quoteCurrency = CurrencyAmount.fromFractionalAmount(tokenInCurrency, quote.numerator, quote.denominator);
            const amountCurrency = CurrencyAmount.fromFractionalAmount(tokenOutCurrency, amount.numerator, amount.denominator);
            const routeCurrency = new Route(route.pools, quoteCurrency.currency, amountCurrency.currency);
            return new Trade({
                v3Routes: [
                    {
                        routev3: routeCurrency,
                        inputAmount: quoteCurrency,
                        outputAmount: amountCurrency,
                    },
                ],
                v2Routes: [],
                tradeType: tradeType,
            });
        }
    }
    buildMethodParameters(trade, swapConfig) {
        const { recipient, slippageTolerance, deadline } = swapConfig;
        const methodParameters = SwapRouter.swapCallParameters(trade, {
            recipient,
            slippageTolerance,
            deadlineOrPreviousBlockhash: deadline,
            // ...(signatureData
            //   ? {
            //       inputTokenPermit:
            //         'allowed' in signatureData
            //           ? {
            //               expiry: signatureData.deadline,
            //               nonce: signatureData.nonce,
            //               s: signatureData.s,
            //               r: signatureData.r,
            //               v: signatureData.v as any,
            //             }
            //           : {
            //               deadline: signatureData.deadline,
            //               amount: signatureData.amount,
            //               s: signatureData.s,
            //               r: signatureData.r,
            //               v: signatureData.v as any,
            //             },
            //     }
            //   : {}),
        });
        return methodParameters;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGVnYWN5LXJvdXRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9yb3V0ZXJzL2xlZ2FjeS1yb3V0ZXIvbGVnYWN5LXJvdXRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDckQsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQy9DLE9BQU8sRUFBRSxVQUFVLEVBQUUsS0FBSyxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDdEQsT0FBTyxFQUE0QixTQUFTLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUN0RSxPQUFPLEVBQUUsU0FBUyxFQUEwQixLQUFLLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDekUsT0FBTyxDQUFDLE1BQU0sUUFBUSxDQUFDO0FBSXZCLE9BQU8sRUFDTCxvQkFBb0IsRUFFcEIscUJBQXFCLEdBQ3RCLE1BQU0sZ0NBQWdDLENBQUM7QUFFeEMsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQ3RELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUNwRCxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDckMsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQ2xELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ3hELE9BQU8sRUFBc0MsT0FBTyxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBRXhFLE9BQU8sRUFDTCxnQkFBZ0IsRUFDaEIsNkJBQTZCLEVBQzdCLFlBQVksR0FDYixNQUFNLFNBQVMsQ0FBQztBQVVqQiwyQkFBMkI7QUFDM0IsTUFBTSxRQUFRLEdBQUcsQ0FBQyxDQUFDO0FBTW5COzs7O0dBSUc7QUFDSCxNQUFNLE9BQU8sWUFBWTtJQU92QixZQUFZLEVBQ1YsT0FBTyxFQUNQ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