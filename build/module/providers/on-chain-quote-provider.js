import { BigNumber } from '@ethersproject/bignumber';
import { encodeMixedRouteToPath, MixedRouteSDK, Protocol, } from '@surge/router-sdk';
import { ChainId } from '@surge/sdk-core';
import { encodeRouteToPath as encodeV3RouteToPath } from '@surge/v3-sdk';
import retry from 'async-retry';
import _ from 'lodash';
import stats from 'stats-lite';
import { IMixedRouteQuoterV1__factory } from '../types/IMixedRouteQuoterV1__factory';
import { IQuoterV2__factory } from '../types/IQuoterV2__factory';
import { ID_TO_NETWORK_NAME, metric, MetricLoggerUnit, NEW_QUOTER_V2_ADDRESSES, } from '../util';
import { log } from '../util/log';
import { DEFAULT_BLOCK_NUMBER_CONFIGS, DEFAULT_SUCCESS_RATE_FAILURE_OVERRIDES, } from '../util/onchainQuoteProviderConfigs';
import { routeToPools, routeToString } from '../util/routes';
export class BlockConflictError extends Error {
    constructor() {
        super(...arguments);
        this.name = 'BlockConflictError';
    }
}
export class SuccessRateError extends Error {
    constructor() {
        super(...arguments);
        this.name = 'SuccessRateError';
    }
}
export class ProviderBlockHeaderError extends Error {
    constructor() {
        super(...arguments);
        this.name = 'ProviderBlockHeaderError';
    }
}
export class ProviderTimeoutError extends Error {
    constructor() {
        super(...arguments);
        this.name = 'ProviderTimeoutError';
    }
}
/**
 * This error typically means that the gas used by the multicall has
 * exceeded the total call gas limit set by the node provider.
 *
 * This can be resolved by modifying BatchParams to request fewer
 * quotes per call, or to set a lower gas limit per quote.
 *
 * @export
 * @class ProviderGasError
 */
export class ProviderGasError extends Error {
    constructor() {
        super(...arguments);
        this.name = 'ProviderGasError';
    }
}
const DEFAULT_BATCH_RETRIES = 2;
// TEMP FIX: Define MIXED_ROUTE_QUOTER_V1_ADDRESSES as an empty object if not found elsewhere
const MIXED_ROUTE_QUOTER_V1_ADDRESSES = {};
/**
 * Computes on chain quotes for swaps. For pure V3 routes, quotes are computed on-chain using
 * the 'QuoterV2' smart contract. For exactIn mixed and V2 routes, quotes are computed using the 'MixedRouteQuoterV1' contract
 * This is because computing quotes off-chain would require fetching all the tick data for each pool, which is a lot of data.
 *
 * To minimize the number of requests for quotes we use a Multicall contract. Generally
 * the number of quotes to fetch exceeds the maximum we can fit in a single multicall
 * while staying under gas limits, so we also batch these quotes across multiple multicalls.
 *
 * The biggest challenge with the quote provider is dealing with various gas limits.
 * Each provider sets a limit on the amount of gas a call can consume (on Infura this
 * is approximately 10x the block max size), so we must ensure each multicall does not
 * exceed this limit. Additionally, each quote on V3 can consume a large number of gas if
 * the pool lacks liquidity and the swap would cause all the ticks to be traversed.
 *
 * To ensure we don't exceed the node's call limit, we limit the gas used by each quote to
 * a specific value, and we limit the number of quotes in each multicall request. Users of this
 * class should set BatchParams such that multicallChunk * gasLimitPerCall is less than their node
 * providers total gas limit per call.
 *
 * @export
 * @class OnChainQuoteProvider
 */
export class OnChainQuoteProvider {
    /**
     * Creates an instance of OnChainQuoteProvider.
     *
     * @param chainId The chain to get quotes for.
     * @param provider The web 3 provider.
     * @param multicall2Provider The multicall provider to use to get the quotes on-chain.
     * Only supports the Uniswap Multicall contract as it needs the gas limitting functionality.
     * @param retryOptions The retry options for each call to the multicall.
     * @param batchParams The parameters for each batched call to the multicall.
     * @param gasErrorFailureOverride The gas and chunk parameters to use when retrying a batch that failed due to out of gas.
     * @param successRateFailureOverrides The parameters for retries when we fail to get quotes.
     * @param blockNumberConfig Parameters for adjusting which block we get quotes from, and how to handle block header not found errors.
     * @param [quoterAddressOverride] Overrides the address of the quoter contract to use.
     * @param metricsPrefix metrics prefix to differentiate between different instances of the quote provider.
     */
    constructor(chainId, provider, 
    // Only supports Uniswap Multicall as it needs the gas limitting functionality.
    multicall2Provider, 
    // retryOptions, batchParams, and gasErrorFailureOverride are always override in alpha-router
    // so below default values are always not going to be picked up in prod.
    // So we will not extract out below default values into constants.
    retryOptions = {
        retries: DEFAULT_BATCH_RETRIES,
        minTimeout: 25,
        maxTimeout: 250,
    }, batchParams = (_optimisticCachedRoutes, _useMixedRouteQuoter) => {
        return {
            multicallChunk: 150,
            gasLimitPerCall: 1000000,
            quoteMinSuccessRate: 0.2,
        };
    }, gasErrorFailureOverride = {
        gasLimitOverride: 1500000,
        multicallChunk: 100,
    }, 
    // successRateFailureOverrides and blockNumberConfig are not always override in alpha-router.
    // So we will extract out below default values into constants.
    // In alpha-router default case, we will also define the constants with same values as below.
    successRateFailureOverrides = DEFAULT_SUCCESS_RATE_FAILURE_OVERRIDES, blockNumberConfig = DEFAULT_BLOCK_NUMBER_CONFIGS, quoterAddressOverride, metricsPrefix = (chainId, useMixedRouteQuoter, optimisticCachedRoutes) => useMixedRouteQuoter
        ? `ChainId_${chainId}_MixedQuoter_OptimisticCachedRoutes${optimisticCachedRoutes}_`
        : `ChainId_${chainId}_V3Quoter_OptimisticCachedRoutes${optimisticCachedRoutes}_`) {
        this.chainId = chainId;
        this.provider = provider;
        this.multicall2Provider = multicall2Provider;
        this.retryOptions = retryOptions;
        this.batchParams = batchParams;
        this.gasErrorFailureOverride = gasErrorFailureOverride;
        this.successRateFailureOverrides = successRateFailureOverrides;
        this.blockNumberConfig = blockNumberConfig;
        this.quoterAddressOverride = quoterAddressOverride;
        this.metricsPrefix = metricsPrefix;
    }
    getQuoterAddress(useMixedRouteQuoter, protocol) {
        if (this.quoterAddressOverride) {
            const quoterAddress = this.quoterAddressOverride(useMixedRouteQuoter, protocol);
            if (!quoterAddress) {
                throw new Error(`No address for the quoter contract on chain id: ${this.chainId}`);
            }
            return quoterAddress;
        }
        const quoterAddress = useMixedRouteQuoter
            ? MIXED_ROUTE_QUOTER_V1_ADDRESSES[this.chainId]
            : protocol === Protocol.V3
                ? NEW_QUOTER_V2_ADDRESSES[this.chainId]
                : undefined;
        if (!quoterAddress) {
            throw new Error(`No address for the quoter contract on chain id: ${this.chainId}`);
        }
        return quoterAddress;
    }
    async getQuotesManyExactIn(amountIns, routes, providerConfig) {
        return this.getQuotesManyData(amountIns, routes, 'quoteExactInput', providerConfig);
    }
    async getQuotesManyExactOut(amountOuts, routes, providerConfig) {
        return this.getQuotesManyData(amountOuts, routes, 'quoteExactOutput', providerConfig);
    }
    encodeRouteToPath(route, functionName) {
        switch (route.protocol) {
            case Protocol.V3:
                return encodeV3RouteToPath(route, functionName == 'quoteExactOutput' // For exactOut must be true to ensure the routes are reversed.
                );
            // We don't have onchain V2 quoter, but we do have a mixed quoter that can quote against v2 routes onchain
            // Hence in case of V2 or mixed, we explicitly encode into mixed routes.
            case Protocol.V2:
                // For V2Route, encodeMixedRouteToPath will handle the conversion, no need to access .pairs, .input, or .output here.
                // FIX: Pass pools, input, output to MixedRouteSDK
                return encodeMixedRouteToPath(new MixedRouteSDK(route.pairs, route.input, route.output));
            case Protocol.MIXED:
                return encodeMixedRouteToPath(route);
            default:
                throw new Error(`Unsupported protocol for the route: ${JSON.stringify(route)}`);
        }
    }
    getContractInterface(useMixedRouteQuoter, protocol) {
        if (useMixedRouteQuoter) {
            return IMixedRouteQuoterV1__factory.createInterface();
        }
        switch (protocol) {
            case Protocol.V3:
                return IQuoterV2__factory.createInterface();
            default:
                throw new Error(`Unsupported protocol: ${protocol}`);
        }
    }
    async consolidateResults(protocol, useMixedRouteQuoter, functionName, inputs, providerConfig, gasLimitOverride) {
        return await this.multicall2Provider.callSameFunctionOnContractWithMultipleParams({
            address: this.getQuoterAddress(useMixedRouteQuoter, protocol),
            contractInterface: this.getContractInterface(useMixedRouteQuoter, protocol),
            functionName,
            functionParams: inputs,
            providerConfig,
            additionalConfig: {
                gasLimitPerCallOverride: gasLimitOverride,
            },
        });
    }
    async getQuotesManyData(amounts, routes, functionName, _providerConfig) {
        var _a, _b;
        const useMixedRouteQuoter = routes.some((route) => route.protocol === Protocol.V2) ||
            routes.some((route) => route.protocol === Protocol.MIXED);
        const optimisticCachedRoutes = (_a = _providerConfig === null || _providerConfig === void 0 ? void 0 : _providerConfig.optimisticCachedRoutes) !== null && _a !== void 0 ? _a : false;
        /// Validate that there are no incorrect routes / function combinations
        this.validateRoutes(routes, functionName, useMixedRouteQuoter);
        let multicallChunk = this.batchParams(optimisticCachedRoutes, useMixedRouteQuoter).multicallChunk;
        let gasLimitOverride = this.batchParams(optimisticCachedRoutes, useMixedRouteQuoter).gasLimitPerCall;
        const { baseBlockOffset, rollback } = this.blockNumberConfig;
        // Apply the base block offset if provided
        const originalBlockNumber = await this.provider.getBlockNumber();
        const providerConfig = {
            ..._providerConfig,
            blockNumber: (_b = _providerConfig === null || _providerConfig === void 0 ? void 0 : _providerConfig.blockNumber) !== null && _b !== void 0 ? _b : originalBlockNumber + baseBlockOffset,
        };
        const inputs = _(routes)
            .flatMap((route) => {
            const encodedRoute = this.encodeRouteToPath(route, functionName);
            const routeInputs = amounts.map((amount) => {
                switch (route.protocol) {
                    case Protocol.MIXED:
                        return [
                            encodedRoute,
                            {
                                nonEncodableData: routeToPools(route).map((_pool) => {
                                    return {
                                        hookData: '0x',
                                    };
                                }),
                            },
                            amount.quotient.toString(),
                        ];
                    default:
                        return [
                            encodedRoute,
                            `0x${amount.quotient.toString(16)}`,
                        ];
                }
            });
            return routeInputs;
        })
            .value();
        const normalizedChunk = Math.ceil(inputs.length / Math.ceil(inputs.length / multicallChunk));
        const inputsChunked = _.chunk(inputs, normalizedChunk);
        let quoteStates = _.map(inputsChunked, (inputChunk) => {
            return {
                status: 'pending',
                inputs: inputChunk,
            };
        });
        log.info(`About to get ${inputs.length} quotes in chunks of ${normalizedChunk} [${_.map(inputsChunked, (i) => i.length).join(',')}] ${gasLimitOverride
            ? `with a gas limit override of ${gasLimitOverride}`
            : ''} and block number: ${await providerConfig.blockNumber} [Original before offset: ${originalBlockNumber}].`);
        metric.putMetric(`${this.metricsPrefix(this.chainId, useMixedRouteQuoter, optimisticCachedRoutes)}QuoteBatchSize`, inputs.length, MetricLoggerUnit.Count);
        metric.putMetric(`${this.metricsPrefix(this.chainId, useMixedRouteQuoter, optimisticCachedRoutes)}QuoteBatchSize_${ID_TO_NETWORK_NAME(this.chainId)}`, inputs.length, MetricLoggerUnit.Count);
        const startTime = Date.now();
        let haveRetriedForSuccessRate = false;
        let haveRetriedForBlockHeader = false;
        let blockHeaderRetryAttemptNumber = 0;
        let haveIncrementedBlockHeaderFailureCounter = false;
        let blockHeaderRolledBack = false;
        let haveRetriedForBlockConflictError = false;
        let haveRetriedForOutOfGas = false;
        let haveRetriedForTimeout = false;
        let haveRetriedForUnknownReason = false;
        let finalAttemptNumber = 1;
        const expectedCallsMade = quoteStates.length;
        let totalCallsMade = 0;
        const { results: quoteResults, blockNumber, approxGasUsedPerSuccessCall, } = await retry(async (_bail, attemptNumber) => {
            haveIncrementedBlockHeaderFailureCounter = false;
            finalAttemptNumber = attemptNumber;
            const [success, failed, pending] = this.partitionQuotes(quoteStates);
            log.info(`Starting attempt: ${attemptNumber}.
          Currently ${success.length} success, ${failed.length} failed, ${pending.length} pending.
          Gas limit override: ${gasLimitOverride} Block number override: ${providerConfig.blockNumber}.`);
            quoteStates = await Promise.all(_.map(quoteStates, async (quoteState, idx) => {
                if (quoteState.status == 'success') {
                    return quoteState;
                }
                // QuoteChunk is pending or failed, so we try again
                const { inputs } = quoteState;
                try {
                    totalCallsMade = totalCallsMade + 1;
                    const protocol = useMixedRouteQuoter
                        ? Protocol.MIXED
                        : Protocol.V3;
                    const results = await this.consolidateResults(protocol, useMixedRouteQuoter, functionName, inputs, providerConfig, gasLimitOverride);
                    const successRateError = this.validateSuccessRate(results.results, haveRetriedForSuccessRate, useMixedRouteQuoter, optimisticCachedRoutes);
                    if (successRateError) {
                        return {
                            status: 'failed',
                            inputs,
                            reason: successRateError,
                            results,
                        };
                    }
                    return {
                        status: 'success',
                        inputs,
                        results,
                    };
                }
                catch (err) {
                    // Error from providers have huge messages that include all the calldata and fill the logs.
                    // Catch them and rethrow with shorter message.
                    if (err.message.includes('header not found')) {
                        return {
                            status: 'failed',
                            inputs,
                            reason: new ProviderBlockHeaderError(err.message.slice(0, 500)),
                        };
                    }
                    if (err.message.includes('timeout')) {
                        return {
                            status: 'failed',
                            inputs,
                            reason: new ProviderTimeoutError(`Req ${idx}/${quoteStates.length}. Request had ${inputs.length} inputs. ${err.message.slice(0, 500)}`),
                        };
                    }
                    if (err.message.includes('out of gas')) {
                        return {
                            status: 'failed',
                            inputs,
                            reason: new ProviderGasError(err.message.slice(0, 500)),
                        };
                    }
                    return {
                        status: 'failed',
                        inputs,
                        reason: new Error(`Unknown error from provider: ${err.message.slice(0, 500)}`),
                    };
                }
            }));
            const [successfulQuoteStates, failedQuoteStates, pendingQuoteStates] = this.partitionQuotes(quoteStates);
            if (pendingQuoteStates.length > 0) {
                throw new Error('Pending quote after waiting for all promises.');
            }
            let retryAll = false;
            const blockNumberError = this.validateBlockNumbers(successfulQuoteStates, inputsChunked.length, gasLimitOverride);
            // If there is a block number conflict we retry all the quotes.
            if (blockNumberError) {
                retryAll = true;
            }
            const reasonForFailureStr = _.map(failedQuoteStates, (failedQuoteState) => failedQuoteState.reason.name).join(', ');
            if (failedQuoteStates.length > 0) {
                log.info(`On attempt ${attemptNumber}: ${failedQuoteStates.length}/${quoteStates.length} quotes failed. Reasons: ${reasonForFailureStr}`);
                for (const failedQuoteState of failedQuoteStates) {
                    const { reason: error } = failedQuoteState;
                    log.info({ error }, `[QuoteFetchError] Attempt ${attemptNumber}. ${error.message}`);
                    if (error instanceof BlockConflictError) {
                        if (!haveRetriedForBlockConflictError) {
                            metric.putMetric(`${this.metricsPrefix(this.chainId, useMixedRouteQuoter, optimisticCachedRoutes)}QuoteBlockConflictErrorRetry`, 1, MetricLoggerUnit.Count);
                            haveRetriedForBlockConflictError = true;
                        }
                        retryAll = true;
                    }
                    else if (error instanceof ProviderBlockHeaderError) {
                        if (!haveRetriedForBlockHeader) {
                            metric.putMetric(`${this.metricsPrefix(this.chainId, useMixedRouteQuoter, optimisticCachedRoutes)}QuoteBlockHeaderNotFoundRetry`, 1, MetricLoggerUnit.Count);
                            haveRetriedForBlockHeader = true;
                        }
                        // Ensure that if multiple calls fail due to block header in the current pending batch,
                        // we only count once.
                        if (!haveIncrementedBlockHeaderFailureCounter) {
                            blockHeaderRetryAttemptNumber =
                                blockHeaderRetryAttemptNumber + 1;
                            haveIncrementedBlockHeaderFailureCounter = true;
                        }
                        if (rollback.enabled) {
                            const { rollbackBlockOffset, attemptsBeforeRollback } = rollback;
                            if (blockHeaderRetryAttemptNumber >= attemptsBeforeRollback &&
                                !blockHeaderRolledBack) {
                                log.info(`Attempt ${attemptNumber}. Have failed due to block header ${blockHeaderRetryAttemptNumber - 1} times. Rolling back block number by ${rollbackBlockOffset} for next retry`);
                                providerConfig.blockNumber = providerConfig.blockNumber
                                    ? (await providerConfig.blockNumber) + rollbackBlockOffset
                                    : (await this.provider.getBlockNumber()) +
                                        rollbackBlockOffset;
                                retryAll = true;
                                blockHeaderRolledBack = true;
                            }
                        }
                    }
                    else if (error instanceof ProviderTimeoutError) {
                        if (!haveRetriedForTimeout) {
                            metric.putMetric(`${this.metricsPrefix(this.chainId, useMixedRouteQuoter, optimisticCachedRoutes)}QuoteTimeoutRetry`, 1, MetricLoggerUnit.Count);
                            haveRetriedForTimeout = true;
                        }
                    }
                    else if (error instanceof ProviderGasError) {
                        if (!haveRetriedForOutOfGas) {
                            metric.putMetric(`${this.metricsPrefix(this.chainId, useMixedRouteQuoter, optimisticCachedRoutes)}QuoteOutOfGasExceptionRetry`, 1, MetricLoggerUnit.Count);
                            haveRetriedForOutOfGas = true;
                        }
                        gasLimitOverride = this.gasErrorFailureOverride.gasLimitOverride;
                        multicallChunk = this.gasErrorFailureOverride.multicallChunk;
                        retryAll = true;
                    }
                    else if (error instanceof SuccessRateError) {
                        if (!haveRetriedForSuccessRate) {
                            metric.putMetric(`${this.metricsPrefix(this.chainId, useMixedRouteQuoter, optimisticCachedRoutes)}QuoteSuccessRateRetry`, 1, MetricLoggerUnit.Count);
                            haveRetriedForSuccessRate = true;
                            // Low success rate can indicate too little gas given to each call.
                            gasLimitOverride =
                                this.successRateFailureOverrides.gasLimitOverride;
                            multicallChunk =
                                this.successRateFailureOverrides.multicallChunk;
                            retryAll = true;
                        }
                    }
                    else {
                        if (!haveRetriedForUnknownReason) {
                            metric.putMetric(`${this.metricsPrefix(this.chainId, useMixedRouteQuoter, optimisticCachedRoutes)}QuoteUnknownReasonRetry`, 1, MetricLoggerUnit.Count);
                            haveRetriedForUnknownReason = true;
                        }
                    }
                }
            }
            if (retryAll) {
                log.info(`Attempt ${attemptNumber}. Resetting all requests to pending for next attempt.`);
                const normalizedChunk = Math.ceil(inputs.length / Math.ceil(inputs.length / multicallChunk));
                const inputsChunked = _.chunk(inputs, normalizedChunk);
                quoteStates = _.map(inputsChunked, (inputChunk) => {
                    return {
                        status: 'pending',
                        inputs: inputChunk,
                    };
                });
            }
            if (failedQuoteStates.length > 0) {
                // TODO: Work with Arbitrum to find a solution for making large multicalls with gas limits that always
                // successfully.
                //
                // On Arbitrum we can not set a gas limit for every call in the multicall and guarantee that
                // we will not run out of gas on the node. This is because they have a different way of accounting
                // for gas, that seperates storage and compute gas costs, and we can not cover both in a single limit.
                //
                // To work around this and avoid throwing errors when really we just couldn't get a quote, we catch this
                // case and return 0 quotes found.
                if ((this.chainId == ChainId.ARBITRUM_ONE ||
                    this.chainId == ChainId.ARBITRUM_GOERLI) &&
                    _.every(failedQuoteStates, (failedQuoteState) => failedQuoteState.reason instanceof ProviderGasError) &&
                    attemptNumber == this.retryOptions.retries) {
                    log.error(`Failed to get quotes on Arbitrum due to provider gas error issue. Overriding error to return 0 quotes.`);
                    return {
                        results: [],
                        blockNumber: BigNumber.from(0),
                        approxGasUsedPerSuccessCall: 0,
                    };
                }
                throw new Error(`Failed to get ${failedQuoteStates.length} quotes. Reasons: ${reasonForFailureStr}`);
            }
            const callResults = _.map(successfulQuoteStates, (quoteState) => quoteState.results);
            return {
                results: _.flatMap(callResults, (result) => result.results),
                blockNumber: BigNumber.from(callResults[0].blockNumber),
                approxGasUsedPerSuccessCall: stats.percentile(_.map(callResults, (result) => result.approxGasUsedPerSuccessCall), 100),
            };
        }, {
            retries: DEFAULT_BATCH_RETRIES,
            ...this.retryOptions,
        });
        const routesQuotes = this.processQuoteResults(quoteResults, routes, amounts, BigNumber.from(gasLimitOverride));
        const endTime = Date.now();
        metric.putMetric(`${this.metricsPrefix(this.chainId, useMixedRouteQuoter, optimisticCachedRoutes)}QuoteLatency`, endTime - startTime, MetricLoggerUnit.Milliseconds);
        metric.putMetric(`${this.metricsPrefix(this.chainId, useMixedRouteQuoter, optimisticCachedRoutes)}QuoteApproxGasUsedPerSuccessfulCall`, approxGasUsedPerSuccessCall, MetricLoggerUnit.Count);
        metric.putMetric(`${this.metricsPrefix(this.chainId, useMixedRouteQuoter, optimisticCachedRoutes)}QuoteNumRetryLoops`, finalAttemptNumber - 1, MetricLoggerUnit.Count);
        metric.putMetric(`${this.metricsPrefix(this.chainId, useMixedRouteQuoter, optimisticCachedRoutes)}QuoteTotalCallsToProvider`, totalCallsMade, MetricLoggerUnit.Count);
        metric.putMetric(`${this.metricsPrefix(this.chainId, useMixedRouteQuoter, optimisticCachedRoutes)}QuoteExpectedCallsToProvider`, expectedCallsMade, MetricLoggerUnit.Count);
        metric.putMetric(`${this.metricsPrefix(this.chainId, useMixedRouteQuoter, optimisticCachedRoutes)}QuoteNumRetriedCalls`, totalCallsMade - expectedCallsMade, MetricLoggerUnit.Count);
        const [successfulQuotes, failedQuotes] = _(routesQuotes)
            .flatMap((routeWithQuotes) => routeWithQuotes[1])
            .partition((quote) => quote.quote != null)
            .value();
        log.info(`Got ${successfulQuotes.length} successful quotes, ${failedQuotes.length} failed quotes. Took ${finalAttemptNumber - 1} attempt loops. Total calls made to provider: ${totalCallsMade}. Have retried for timeout: ${haveRetriedForTimeout}`);
        return {
            routesWithQuotes: routesQuotes,
            blockNumber,
        };
    }
    partitionQuotes(quoteStates) {
        const successfulQuoteStates = _.filter(quoteStates, (quoteState) => quoteState.status == 'success');
        const failedQuoteStates = _.filter(quoteStates, (quoteState) => quoteState.status == 'failed');
        const pendingQuoteStates = _.filter(quoteStates, (quoteState) => quoteState.status == 'pending');
        return [successfulQuoteStates, failedQuoteStates, pendingQuoteStates];
    }
    processQuoteResults(quoteResults, routes, amounts, gasLimit) {
        const routesQuotes = [];
        const quotesResultsByRoute = _.chunk(quoteResults, amounts.length);
        const debugFailedQuotes = [];
        for (let i = 0; i < quotesResultsByRoute.length; i++) {
            const route = routes[i];
            const quoteResults = quotesResultsByRoute[i];
            const quotes = _.map(quoteResults, (quoteResult, index) => {
                var _a;
                const amount = amounts[index];
                if (!quoteResult.success) {
                    const percent = (100 / amounts.length) * (index + 1);
                    const amountStr = amount.toFixed(Math.min(amount.currency.decimals, 2));
                    const routeStr = routeToString(route);
                    debugFailedQuotes.push({
                        route: routeStr,
                        percent,
                        amount: amountStr,
                    });
                    return {
                        amount,
                        quote: null,
                        sqrtPriceX96AfterList: null,
                        gasEstimate: (_a = quoteResult.gasUsed) !== null && _a !== void 0 ? _a : null,
                        gasLimit: gasLimit,
                        initializedTicksCrossedList: null,
                    };
                }
                return {
                    amount,
                    quote: quoteResult.result[0],
                    sqrtPriceX96AfterList: quoteResult.result[1],
                    initializedTicksCrossedList: quoteResult.result[2],
                    gasEstimate: quoteResult.result[3],
                    gasLimit: gasLimit,
                };
            });
            routesQuotes.push([route, quotes]);
        }
        // For routes and amounts that we failed to get a quote for, group them by route
        // and batch them together before logging to minimize number of logs.
        const debugChunk = 80;
        _.forEach(_.chunk(debugFailedQuotes, debugChunk), (quotes, idx) => {
            const failedQuotesByRoute = _.groupBy(quotes, (q) => q.route);
            const failedFlat = _.mapValues(failedQuotesByRoute, (f) => _(f)
                .map((f) => `${f.percent}%[${f.amount}]`)
                .join(','));
            log.info({
                failedQuotes: _.map(failedFlat, (amounts, routeStr) => `${routeStr} : ${amounts}`),
            }, `Failed on chain quotes for routes Part ${idx}/${Math.ceil(debugFailedQuotes.length / debugChunk)}`);
        });
        return routesQuotes;
    }
    validateBlockNumbers(successfulQuoteStates, totalCalls, gasLimitOverride) {
        if (successfulQuoteStates.length <= 1) {
            return null;
        }
        const results = _.map(successfulQuoteStates, (quoteState) => quoteState.results);
        const blockNumbers = _.map(results, (result) => result.blockNumber);
        const uniqBlocks = _(blockNumbers)
            .map((blockNumber) => blockNumber.toNumber())
            .uniq()
            .value();
        if (uniqBlocks.length == 1) {
            return null;
        }
        /* if (
          uniqBlocks.length == 2 &&
          Math.abs(uniqBlocks[0]! - uniqBlocks[1]!) <= 1
        ) {
          return null;
        } */
        return new BlockConflictError(`Quotes returned from different blocks. ${uniqBlocks}. ${totalCalls} calls were made with gas limit ${gasLimitOverride}`);
    }
    validateSuccessRate(allResults, haveRetriedForSuccessRate, useMixedRouteQuoter, optimisticCachedRoutes) {
        const numResults = allResults.length;
        const numSuccessResults = allResults.filter((result) => result.success).length;
        const successRate = (1.0 * numSuccessResults) / numResults;
        const { quoteMinSuccessRate } = this.batchParams(optimisticCachedRoutes, useMixedRouteQuoter);
        if (successRate < quoteMinSuccessRate) {
            if (haveRetriedForSuccessRate) {
                log.info(`Quote success rate still below threshold despite retry. Continuing. ${quoteMinSuccessRate}: ${successRate}`);
                metric.putMetric(`${this.metricsPrefix(this.chainId, useMixedRouteQuoter, optimisticCachedRoutes)}QuoteRetriedSuccessRateLow`, successRate, MetricLoggerUnit.Percent);
                return;
            }
            metric.putMetric(`${this.metricsPrefix(this.chainId, useMixedRouteQuoter, optimisticCachedRoutes)}QuoteSuccessRateLow`, successRate, MetricLoggerUnit.Percent);
            return new SuccessRateError(`Quote success rate below threshold of ${quoteMinSuccessRate}: ${successRate}`);
        }
    }
    /**
     * Throw an error for incorrect routes / function combinations
     * @param routes Any combination of V3, V2, and Mixed routes.
     * @param functionName
     * @param useMixedRouteQuoter true if there are ANY V2Routes or MixedRoutes in the routes parameter
     */
    validateRoutes(routes, functionName, useMixedRouteQuoter) {
        /// We do not send any V3Routes to new qutoer becuase it is not deployed on chains besides mainnet
        if (routes.some((route) => route.protocol === Protocol.V3) &&
            useMixedRouteQuoter) {
            throw new Error(`Cannot use mixed route quoter with V3 routes`);
        }
        /// We cannot call quoteExactOutput with V2 or Mixed routes
        if (functionName === 'quoteExactOutput' && useMixedRouteQuoter) {
            throw new Error('Cannot call quoteExactOutput with V2 or Mixed routes');
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib24tY2hhaW4tcXVvdGUtcHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcHJvdmlkZXJzL29uLWNoYWluLXF1b3RlLXByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFBRSxTQUFTLEVBQWdCLE1BQU0sMEJBQTBCLENBQUM7QUFHbkUsT0FBTyxFQUNMLHNCQUFzQixFQUN0QixhQUFhLEVBQ2IsUUFBUSxHQUNULE1BQU0sbUJBQW1CLENBQUM7QUFDM0IsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzFDLE9BQU8sRUFBRSxpQkFBaUIsSUFBSSxtQkFBbUIsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUN6RSxPQUFPLEtBQWtDLE1BQU0sYUFBYSxDQUFDO0FBQzdELE9BQU8sQ0FBQyxNQUFNLFFBQVEsQ0FBQztBQUN2QixPQUFPLEtBQUssTUFBTSxZQUFZLENBQUM7QUFRL0IsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDckYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDakUsT0FBTyxFQUNMLGtCQUFrQixFQUNsQixNQUFNLEVBQ04sZ0JBQWdCLEVBQ2hCLHVCQUF1QixHQUN4QixNQUFNLFNBQVMsQ0FBQztBQUVqQixPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBQ2xDLE9BQU8sRUFDTCw0QkFBNEIsRUFDNUIsc0NBQXNDLEdBQ3ZDLE1BQU0scUNBQXFDLENBQUM7QUFDN0MsT0FBTyxFQUFFLFlBQVksRUFBRSxhQUFhLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQW1FN0QsTUFBTSxPQUFPLGtCQUFtQixTQUFRLEtBQUs7SUFBN0M7O1FBQ1MsU0FBSSxHQUFHLG9CQUFvQixDQUFDO0lBQ3JDLENBQUM7Q0FBQTtBQUVELE1BQU0sT0FBTyxnQkFBaUIsU0FBUSxLQUFLO0lBQTNDOztR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