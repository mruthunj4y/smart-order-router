"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMixedRouteCandidatePools = exports.getV2CandidatePools = exports.getV3CandidatePools = exports.getMixedCrossLiquidityCandidatePools = void 0;
const router_sdk_1 = require("@surge/router-sdk");
const sdk_core_1 = require("@surge/sdk-core");
const lodash_1 = __importDefault(require("lodash"));
const token_provider_1 = require("../../../providers/token-provider");
const util_1 = require("../../../util");
const log_1 = require("../../../util/log");
const metric_1 = require("../../../util/metric");
const baseTokensByChain = {
    [sdk_core_1.ChainId.XRPL_EVM_TESTNET]: [
        token_provider_1.WETH_XRPL_EVM_TESTNET,
        token_provider_1.DAI_XRPL_EVM_TESTNET,
        token_provider_1.TON_XRPL_EVM_TESTNET,
        token_provider_1.TRON_XRPL_EVM_TESTNET,
        token_provider_1.SOL_XRPL_EVM_TESTNET,
        token_provider_1.USDC_XRPL_EVM_TESTNET,
        token_provider_1.RLUSD_XRPL_EVM_TESTNET,
        token_provider_1.MATIC_XRPL_EVM_TESTNET,
        token_provider_1.AXL_XRPL_EVM_TESTNET,
        token_provider_1.AVAX_XRPL_EVM_TESTNET,
        token_provider_1.USDT_XRPL_EVM_TESTNET,
        token_provider_1.BNB_XRPL_EVM_TESTNET,
    ],
    [sdk_core_1.ChainId.ARBITRUM_SEPOLIA]: [
        token_provider_1.USDC_ARBITRUM_SEPOLIA,
        token_provider_1.DAI_ARBITRUM_SEPOLIA,
    ],
};
class SubcategorySelectionPools {
    constructor(pools, poolsNeeded) {
        this.pools = pools;
        this.poolsNeeded = poolsNeeded;
    }
    hasEnoughPools() {
        return this.pools.length >= this.poolsNeeded;
    }
}
/**
 * Function that finds any missing pools that were not selected by the heuristic but that would
 *   create a route with the topPool by TVL with either tokenIn or tokenOut across protocols.
 *
 *   e.g. In V2CandidatePools we found that wstETH/DOG is the most liquid pool,
 *        then in V3CandidatePools ETH/wstETH is *not* the most liquid pool, so it is not selected
 *        This process will look for that pool in order to complete the route.
 *
 */
async function getMixedCrossLiquidityCandidatePools({ tokenIn, tokenOut, blockNumber, v2SubgraphProvider, v3SubgraphProvider, v2Candidates, v3Candidates, }) {
    const v2Pools = (await v2SubgraphProvider.getPools(tokenIn, tokenOut, {
        blockNumber,
    })).sort((a, b) => b.reserve - a.reserve);
    const v3Pools = (await v3SubgraphProvider.getPools(tokenIn, tokenOut, {
        blockNumber,
    })).sort((a, b) => b.tvlUSD - a.tvlUSD);
    const tokenInAddress = tokenIn.address.toLowerCase();
    const tokenOutAddress = tokenOut.address.toLowerCase();
    const v2SelectedPools = findCrossProtocolMissingPools(tokenInAddress, tokenOutAddress, v2Pools, v2Candidates, v3Candidates);
    const v3SelectedPools = findCrossProtocolMissingPools(tokenInAddress, tokenOutAddress, v3Pools, v3Candidates, v2Candidates);
    const selectedV2Pools = [
        v2SelectedPools.forTokenIn,
        v2SelectedPools.forTokenOut,
    ].filter((pool) => pool !== undefined);
    const selectedV3Pools = [
        v3SelectedPools.forTokenIn,
        v3SelectedPools.forTokenOut,
    ].filter((pool) => pool !== undefined);
    return {
        v2Pools: selectedV2Pools,
        v3Pools: selectedV3Pools,
    };
}
exports.getMixedCrossLiquidityCandidatePools = getMixedCrossLiquidityCandidatePools;
function findCrossProtocolMissingPools(tokenInAddress, tokenOutAddress, pools, candidatesInProtocolToSearch, candidatesInContextProtocol) {
    var _a;
    const selectedPools = {};
    const previouslySelectedPools = new Set((_a = candidatesInProtocolToSearch === null || candidatesInProtocolToSearch === void 0 ? void 0 : candidatesInProtocolToSearch.subgraphPools.map((pool) => pool.id)) !== null && _a !== void 0 ? _a : []);
    const topPoolByTvlWithTokenOut = candidatesInContextProtocol === null || candidatesInContextProtocol === void 0 ? void 0 : candidatesInContextProtocol.candidatePools.selections.topByTVLUsingTokenOut[0];
    const crossTokenAgainstTokenOut = (topPoolByTvlWithTokenOut === null || topPoolByTvlWithTokenOut === void 0 ? void 0 : topPoolByTvlWithTokenOut.token0.id.toLowerCase()) === tokenOutAddress
        ? topPoolByTvlWithTokenOut === null || topPoolByTvlWithTokenOut === void 0 ? void 0 : topPoolByTvlWithTokenOut.token1.id.toLowerCase()
        : topPoolByTvlWithTokenOut === null || topPoolByTvlWithTokenOut === void 0 ? void 0 : topPoolByTvlWithTokenOut.token0.id.toLowerCase();
    const topPoolByTvlWithTokenIn = candidatesInContextProtocol === null || candidatesInContextProtocol === void 0 ? void 0 : candidatesInContextProtocol.candidatePools.selections.topByTVLUsingTokenIn[0];
    const crossTokenAgainstTokenIn = (topPoolByTvlWithTokenIn === null || topPoolByTvlWithTokenIn === void 0 ? void 0 : topPoolByTvlWithTokenIn.token0.id.toLowerCase()) === tokenInAddress
        ? topPoolByTvlWithTokenIn === null || topPoolByTvlWithTokenIn === void 0 ? void 0 : topPoolByTvlWithTokenIn.token1.id.toLowerCase()
        : topPoolByTvlWithTokenIn === null || topPoolByTvlWithTokenIn === void 0 ? void 0 : topPoolByTvlWithTokenIn.token0.id.toLowerCase();
    for (const pool of pools) {
        // If we already found both pools for tokenIn and tokenOut. break out of this for loop.
        if (selectedPools.forTokenIn !== undefined &&
            selectedPools.forTokenOut !== undefined) {
            break;
        }
        // If the pool has already been selected. continue to the next pool.
        if (previouslySelectedPools.has(pool.id)) {
            continue;
        }
        const poolToken0Address = pool.token0.id.toLowerCase();
        const poolToken1Address = pool.token1.id.toLowerCase();
        // If we haven't selected the pool for tokenIn, and we found a pool matching the tokenOut, and the intermediateToken, select this pool
        if (selectedPools.forTokenIn === undefined &&
            ((poolToken0Address === tokenOutAddress &&
                poolToken1Address === crossTokenAgainstTokenIn) ||
                (poolToken1Address === tokenOutAddress &&
                    poolToken0Address === crossTokenAgainstTokenIn))) {
            selectedPools.forTokenIn = pool;
        }
        // If we haven't selected the pool for tokenOut, and we found a pool matching the tokenIn, and the intermediateToken, select this pool
        if (selectedPools.forTokenOut === undefined &&
            ((poolToken0Address === tokenInAddress &&
                poolToken1Address === crossTokenAgainstTokenOut) ||
                (poolToken1Address === tokenInAddress &&
                    poolToken0Address === crossTokenAgainstTokenOut))) {
            selectedPools.forTokenOut = pool;
        }
    }
    return selectedPools;
}
async function getV3CandidatePools({ tokenIn, tokenOut, routeType, routingConfig, subgraphProvider, poolProvider, chainId, }) {
    var _a, _b, _c, _d, _e, _f, _g;
    const { blockNumber, v3PoolSelection: { topN, topNDirectSwaps, topNTokenInOut, topNSecondHop, topNSecondHopForTokenAddress, tokensToAvoidOnSecondHops, topNWithEachBaseToken, topNWithBaseToken, }, } = routingConfig;
    const tokenInAddress = tokenIn.address.toLowerCase();
    const tokenOutAddress = tokenOut.address.toLowerCase();
    const beforeSubgraphPools = Date.now();
    const allPools = await subgraphProvider.getPools(tokenIn, tokenOut, {
        blockNumber,
    });
    log_1.log.info({ samplePools: allPools.slice(0, 3) }, 'Got all pools from V3 subgraph provider');
    // Although this is less of an optimization than the V2 equivalent,
    // save some time copying objects by mutating the underlying pool directly.
    for (const pool of allPools) {
        pool.token0.id = pool.token0.id.toLowerCase();
        pool.token1.id = pool.token1.id.toLowerCase();
    }
    metric_1.metric.putMetric('V3SubgraphPoolsLoad', Date.now() - beforeSubgraphPools, metric_1.MetricLoggerUnit.Milliseconds);
    const beforePoolsFiltered = Date.now();
    // Sort by tvlUSD in descending order
    const subgraphPoolsSorted = allPools.sort((a, b) => b.tvlUSD - a.tvlUSD);
    log_1.log.info(`After filtering blocked tokens went from ${allPools.length} to ${subgraphPoolsSorted.length}.`);
    const poolAddressesSoFar = new Set();
    const addToAddressSet = (pools) => {
        (0, lodash_1.default)(pools)
            .map((pool) => pool.id)
            .forEach((poolAddress) => poolAddressesSoFar.add(poolAddress));
    };
    const baseTokens = (_a = baseTokensByChain[chainId]) !== null && _a !== void 0 ? _a : [];
    const topByBaseWithTokenIn = (0, lodash_1.default)(baseTokens)
        .flatMap((token) => {
        return (0, lodash_1.default)(subgraphPoolsSorted)
            .filter((subgraphPool) => {
            const tokenAddress = token.address.toLowerCase();
            return ((subgraphPool.token0.id == tokenAddress &&
                subgraphPool.token1.id == tokenInAddress) ||
                (subgraphPool.token1.id == tokenAddress &&
                    subgraphPool.token0.id == tokenInAddress));
        })
            .sortBy((tokenListPool) => -tokenListPool.tvlUSD)
            .slice(0, topNWithEachBaseToken)
            .value();
    })
        .sortBy((tokenListPool) => -tokenListPool.tvlUSD)
        .slice(0, topNWithBaseToken)
        .value();
    const topByBaseWithTokenOut = (0, lodash_1.default)(baseTokens)
        .flatMap((token) => {
        return (0, lodash_1.default)(subgraphPoolsSorted)
            .filter((subgraphPool) => {
            const tokenAddress = token.address.toLowerCase();
            return ((subgraphPool.token0.id == tokenAddress &&
                subgraphPool.token1.id == tokenOutAddress) ||
                (subgraphPool.token1.id == tokenAddress &&
                    subgraphPool.token0.id == tokenOutAddress));
        })
            .sortBy((tokenListPool) => -tokenListPool.tvlUSD)
            .slice(0, topNWithEachBaseToken)
            .value();
    })
        .sortBy((tokenListPool) => -tokenListPool.tvlUSD)
        .slice(0, topNWithBaseToken)
        .value();
    let top2DirectSwapPool = (0, lodash_1.default)(subgraphPoolsSorted)
        .filter((subgraphPool) => {
        return (!poolAddressesSoFar.has(subgraphPool.id) &&
            ((subgraphPool.token0.id == tokenInAddress &&
                subgraphPool.token1.id == tokenOutAddress) ||
                (subgraphPool.token1.id == tokenInAddress &&
                    subgraphPool.token0.id == tokenOutAddress)));
    })
        .slice(0, topNDirectSwaps)
        .value();
    if (top2DirectSwapPool.length == 0 && topNDirectSwaps > 0) {
        // If we requested direct swap pools but did not find any in the subgraph query.
        // Optimistically add them into the query regardless. Invalid pools ones will be dropped anyway
        // when we query the pool on-chain. Ensures that new pools for new pairs can be swapped on immediately.
        top2DirectSwapPool = lodash_1.default.map((0, util_1.getApplicableV3FeeAmounts)(), (feeAmount) => {
            const { token0, token1, poolAddress } = poolProvider.getPoolAddress(tokenIn, tokenOut, feeAmount);
            return {
                id: poolAddress,
                feeTier: (0, util_1.unparseFeeAmount)(feeAmount),
                liquidity: '10000',
                token0: {
                    id: token0.address,
                },
                token1: {
                    id: token1.address,
                },
                tvlETH: 10000,
                tvlUSD: 10000,
            };
        });
    }
    addToAddressSet(top2DirectSwapPool);
    const wrappedNativeAddress = ((_d = (_c = (_b = util_1.WRAPPED_NATIVE_CURRENCY[chainId]) === null || _b === void 0 ? void 0 : _b.address) === null || _c === void 0 ? void 0 : _c.toLowerCase()) !== null && _d !== void 0 ? _d : '');
    // Main reason we need this is for gas estimates, only needed if token out is not native.
    // We don't check the seen address set because if we've already added pools for getting native quotes
    // theres no need to add more.
    let top2EthQuoteTokenPool = [];
    if ((((_e = util_1.WRAPPED_NATIVE_CURRENCY[chainId]) === null || _e === void 0 ? void 0 : _e.symbol) ==
        ((_f = util_1.WRAPPED_NATIVE_CURRENCY[sdk_core_1.ChainId.XRPL_EVM_TESTNET]) === null || _f === void 0 ? void 0 : _f.symbol) &&
        tokenOut.symbol != 'WETH' &&
        tokenOut.symbol != 'WETH9' &&
        tokenOut.symbol != 'ETH') ||
        (((_g = util_1.WRAPPED_NATIVE_CURRENCY[chainId]) === null || _g === void 0 ? void 0 : _g.symbol) == token_provider_1.WETH_XRPL_EVM_TESTNET.symbol &&
            tokenOut.symbol != 'MATIC' &&
            tokenOut.symbol != 'WMATIC')) {
        top2EthQuoteTokenPool = (0, lodash_1.default)(subgraphPoolsSorted)
            .filter((subgraphPool) => {
            if (routeType == sdk_core_1.TradeType.EXACT_INPUT) {
                return ((subgraphPool.token0.id == wrappedNativeAddress &&
                    subgraphPool.token1.id == tokenOutAddress) ||
                    (subgraphPool.token1.id == wrappedNativeAddress &&
                        subgraphPool.token0.id == tokenOutAddress));
            }
            else {
                return ((subgraphPool.token0.id == wrappedNativeAddress &&
                    subgraphPool.token1.id == tokenInAddress) ||
                    (subgraphPool.token1.id == wrappedNativeAddress &&
                        subgraphPool.token0.id == tokenInAddress));
            }
        })
            .slice(0, 1)
            .value();
    }
    addToAddressSet(top2EthQuoteTokenPool);
    const topByTVL = (0, lodash_1.default)(subgraphPoolsSorted)
        .filter((subgraphPool) => {
        return !poolAddressesSoFar.has(subgraphPool.id);
    })
        .slice(0, topN)
        .value();
    addToAddressSet(topByTVL);
    const topByTVLUsingTokenIn = (0, lodash_1.default)(subgraphPoolsSorted)
        .filter((subgraphPool) => {
        return (!poolAddressesSoFar.has(subgraphPool.id) &&
            (subgraphPool.token0.id == tokenInAddress ||
                subgraphPool.token1.id == tokenInAddress));
    })
        .slice(0, topNTokenInOut)
        .value();
    addToAddressSet(topByTVLUsingTokenIn);
    const topByTVLUsingTokenOut = (0, lodash_1.default)(subgraphPoolsSorted)
        .filter((subgraphPool) => {
        return (!poolAddressesSoFar.has(subgraphPool.id) &&
            (subgraphPool.token0.id == tokenOutAddress ||
                subgraphPool.token1.id == tokenOutAddress));
    })
        .slice(0, topNTokenInOut)
        .value();
    addToAddressSet(topByTVLUsingTokenOut);
    const topByTVLUsingTokenInSecondHops = (0, lodash_1.default)(topByTVLUsingTokenIn)
        .map((subgraphPool) => {
        return tokenInAddress == subgraphPool.token0.id
            ? subgraphPool.token1.id
            : subgraphPool.token0.id;
    })
        .flatMap((secondHopId) => {
        var _a;
        return (0, lodash_1.default)(subgraphPoolsSorted)
            .filter((subgraphPool) => {
            return (!poolAddressesSoFar.has(subgraphPool.id) &&
                !(tokensToAvoidOnSecondHops === null || tokensToAvoidOnSecondHops === void 0 ? void 0 : tokensToAvoidOnSecondHops.includes(secondHopId.toLowerCase())) &&
                (subgraphPool.token0.id == secondHopId ||
                    subgraphPool.token1.id == secondHopId));
        })
            .slice(0, (_a = topNSecondHopForTokenAddress === null || topNSecondHopForTokenAddress === void 0 ? void 0 : topNSecondHopForTokenAddress.get(secondHopId)) !== null && _a !== void 0 ? _a : topNSecondHop)
            .value();
    })
        .uniqBy((pool) => pool.id)
        .value();
    addToAddressSet(topByTVLUsingTokenInSecondHops);
    const topByTVLUsingTokenOutSecondHops = (0, lodash_1.default)(topByTVLUsingTokenOut)
        .map((subgraphPool) => {
        return tokenOutAddress == subgraphPool.token0.id
            ? subgraphPool.token1.id
            : subgraphPool.token0.id;
    })
        .flatMap((secondHopId) => {
        var _a;
        return (0, lodash_1.default)(subgraphPoolsSorted)
            .filter((subgraphPool) => {
            return (!poolAddressesSoFar.has(subgraphPool.id) &&
                !(tokensToAvoidOnSecondHops === null || tokensToAvoidOnSecondHops === void 0 ? void 0 : tokensToAvoidOnSecondHops.includes(secondHopId.toLowerCase())) &&
                (subgraphPool.token0.id == secondHopId ||
                    subgraphPool.token1.id == secondHopId));
        })
            .slice(0, (_a = topNSecondHopForTokenAddress === null || topNSecondHopForTokenAddress === void 0 ? void 0 : topNSecondHopForTokenAddress.get(secondHopId)) !== null && _a !== void 0 ? _a : topNSecondHop)
            .value();
    })
        .uniqBy((pool) => pool.id)
        .value();
    addToAddressSet(topByTVLUsingTokenOutSecondHops);
    const subgraphPools = (0, lodash_1.default)([
        ...topByBaseWithTokenIn,
        ...topByBaseWithTokenOut,
        ...top2DirectSwapPool,
        ...top2EthQuoteTokenPool,
        ...topByTVL,
        ...topByTVLUsingTokenIn,
        ...topByTVLUsingTokenOut,
        ...topByTVLUsingTokenInSecondHops,
        ...topByTVLUsingTokenOutSecondHops,
    ])
        .compact()
        .uniqBy((pool) => pool.id)
        .value();
    const tokenAddresses = (0, lodash_1.default)(subgraphPools)
        .flatMap((subgraphPool) => [subgraphPool.token0.id, subgraphPool.token1.id])
        .compact()
        .uniq()
        .value();
    log_1.log.info(`Getting the ${tokenAddresses.length} tokens within the ${subgraphPools.length} V3 pools we are considering`);
    metric_1.metric.putMetric('V3PoolsFilterLoad', Date.now() - beforePoolsFiltered, metric_1.MetricLoggerUnit.Milliseconds);
    const beforePoolsLoad = Date.now();
    // Build tokenPairs for V3 pools
    const tokenPairsRaw = lodash_1.default.map(subgraphPools, (subgraphPool) => {
        // Use tokenIn and tokenOut directly, as we no longer have tokenAccessor
        let fee;
        try {
            fee = (0, util_1.parseFeeAmount)(subgraphPool.feeTier);
        }
        catch (err) {
            log_1.log.info({ subgraphPool }, `Dropping candidate pool for ${subgraphPool.token0.id}/${subgraphPool.token1.id}/${subgraphPool.feeTier} because fee tier not supported`);
            return undefined;
        }
        // Use tokenIn and tokenOut as the Token objects
        return [tokenIn, tokenOut, fee];
    });
    const tokenPairs = lodash_1.default.compact(tokenPairsRaw);
    const poolAccessor = await poolProvider.getPools(tokenPairs, {
        blockNumber,
    });
    metric_1.metric.putMetric('V3PoolsLoad', Date.now() - beforePoolsLoad, metric_1.MetricLoggerUnit.Milliseconds);
    const poolsBySelection = {
        protocol: router_sdk_1.Protocol.V3,
        selections: {
            topByBaseWithTokenIn,
            topByBaseWithTokenOut,
            topByDirectSwapPool: top2DirectSwapPool,
            topByEthQuoteTokenPool: top2EthQuoteTokenPool,
            topByTVL,
            topByTVLUsingTokenIn,
            topByTVLUsingTokenOut,
            topByTVLUsingTokenInSecondHops,
            topByTVLUsingTokenOutSecondHops,
        },
    };
    return { poolAccessor, candidatePools: poolsBySelection, subgraphPools };
}
exports.getV3CandidatePools = getV3CandidatePools;
async function getV2CandidatePools({ tokenIn, tokenOut, routeType, routingConfig, subgraphProvider, poolProvider, chainId, }) {
    var _a;
    const { blockNumber, v2PoolSelection: { topN, topNDirectSwaps, topNTokenInOut, topNSecondHop, tokensToAvoidOnSecondHops, topNWithEachBaseToken, topNWithBaseToken, }, } = routingConfig;
    const tokenInAddress = tokenIn.address.toLowerCase();
    const tokenOutAddress = tokenOut.address.toLowerCase();
    const beforeSubgraphPools = Date.now();
    const allPoolsRaw = await subgraphProvider.getPools(tokenIn, tokenOut, {
        blockNumber,
    });
    // With tens of thousands of V2 pools, operations that copy pools become costly.
    // Mutate the pool directly rather than creating a new pool / token to optimmize for speed.
    for (const pool of allPoolsRaw) {
        pool.token0.id = pool.token0.id.toLowerCase();
        pool.token1.id = pool.token1.id.toLowerCase();
    }
    metric_1.metric.putMetric('V2SubgraphPoolsLoad', Date.now() - beforeSubgraphPools, metric_1.MetricLoggerUnit.Milliseconds);
    const beforePoolsFiltered = Date.now();
    // Sort by pool reserve in descending order.
    const subgraphPoolsSorted = allPoolsRaw.sort((a, b) => b.reserve - a.reserve);
    const poolAddressesSoFar = new Set();
    // Always add the direct swap pool into the mix regardless of if it exists in the subgraph pool list.
    // Ensures that new pools can be swapped on immediately, and that if a pool was filtered out of the
    // subgraph query for some reason (e.g. trackedReserveETH was 0), then we still consider it.
    let topByDirectSwapPool = [];
    if (topNDirectSwaps > 0) {
        const { token0, token1, poolAddress } = poolProvider.getPoolAddress(tokenIn, tokenOut);
        poolAddressesSoFar.add(poolAddress.toLowerCase());
        topByDirectSwapPool = [
            {
                id: poolAddress,
                token0: {
                    id: token0.address,
                },
                token1: {
                    id: token1.address,
                },
                supply: 10000,
                reserve: 10000,
                reserveUSD: 10000, // Not used. Set to arbitrary number.
            },
        ];
    }
    const wethAddress = util_1.WRAPPED_NATIVE_CURRENCY[chainId].address.toLowerCase();
    const topByBaseWithTokenInMap = new Map();
    const topByBaseWithTokenOutMap = new Map();
    const baseTokens = (_a = baseTokensByChain[chainId]) !== null && _a !== void 0 ? _a : [];
    const baseTokensAddresses = new Set();
    baseTokens.forEach((token) => {
        const baseTokenAddr = token.address.toLowerCase();
        baseTokensAddresses.add(baseTokenAddr);
        topByBaseWithTokenInMap.set(baseTokenAddr, new SubcategorySelectionPools([], topNWithEachBaseToken));
        topByBaseWithTokenOutMap.set(baseTokenAddr, new SubcategorySelectionPools([], topNWithEachBaseToken));
    });
    let topByBaseWithTokenInPoolsFound = 0;
    let topByBaseWithTokenOutPoolsFound = 0;
    // Main reason we need this is for gas estimates
    // There can ever only be 1 Token/ETH pool, so we will only look for 1
    let topNEthQuoteToken = 1;
    // but, we only need it if token out is not ETH.
    if (tokenOut.symbol == 'WETH' ||
        tokenOut.symbol == 'WETH9' ||
        tokenOut.symbol == 'ETH') {
        // if it's eth we change the topN to 0, so we can break early from the loop.
        topNEthQuoteToken = 0;
    }
    const topByEthQuoteTokenPool = [];
    const topByTVLUsingTokenIn = [];
    const topByTVLUsingTokenOut = [];
    const topByTVL = [];
    // Used to track how many iterations we do in the first loop
    let loopsInFirstIteration = 0;
    // Filtering step for up to first hop
    // The pools are pre-sorted, so we can just iterate through them and fill our heuristics.
    for (const subgraphPool of subgraphPoolsSorted) {
        loopsInFirstIteration += 1;
        // Check if we have satisfied all the heuristics, if so, we can stop.
        if (topByBaseWithTokenInPoolsFound >= topNWithBaseToken &&
            topByBaseWithTokenOutPoolsFound >= topNWithBaseToken &&
            topByEthQuoteTokenPool.length >= topNEthQuoteToken &&
            topByTVL.length >= topN &&
            topByTVLUsingTokenIn.length >= topNTokenInOut &&
            topByTVLUsingTokenOut.length >= topNTokenInOut) {
            // We have satisfied all the heuristics, so we can stop.
            break;
        }
        if (poolAddressesSoFar.has(subgraphPool.id)) {
            // We've already added this pool, so skip it.
            continue;
        }
        const tokenInToken0TopByBase = topByBaseWithTokenInMap.get(subgraphPool.token0.id);
        if (topByBaseWithTokenInPoolsFound < topNWithBaseToken &&
            tokenInToken0TopByBase &&
            subgraphPool.token0.id != tokenOutAddress &&
            subgraphPool.token1.id == tokenInAddress) {
            topByBaseWithTokenInPoolsFound += 1;
            poolAddressesSoFar.add(subgraphPool.id);
            if (topByTVLUsingTokenIn.length < topNTokenInOut) {
                topByTVLUsingTokenIn.push(subgraphPool);
            }
            if (routeType === sdk_core_1.TradeType.EXACT_OUTPUT &&
                subgraphPool.token0.id == wethAddress) {
                topByEthQuoteTokenPool.push(subgraphPool);
            }
            tokenInToken0TopByBase.pools.push(subgraphPool);
            continue;
        }
        const tokenInToken1TopByBase = topByBaseWithTokenInMap.get(subgraphPool.token1.id);
        if (topByBaseWithTokenInPoolsFound < topNWithBaseToken &&
            tokenInToken1TopByBase &&
            subgraphPool.token0.id == tokenInAddress &&
            subgraphPool.token1.id != tokenOutAddress) {
            topByBaseWithTokenInPoolsFound += 1;
            poolAddressesSoFar.add(subgraphPool.id);
            if (topByTVLUsingTokenIn.length < topNTokenInOut) {
                topByTVLUsingTokenIn.push(subgraphPool);
            }
            if (routeType === sdk_core_1.TradeType.EXACT_OUTPUT &&
                subgraphPool.token1.id == wethAddress) {
                topByEthQuoteTokenPool.push(subgraphPool);
            }
            tokenInToken1TopByBase.pools.push(subgraphPool);
            continue;
        }
        const tokenOutToken0TopByBase = topByBaseWithTokenOutMap.get(subgraphPool.token0.id);
        if (topByBaseWithTokenOutPoolsFound < topNWithBaseToken &&
            tokenOutToken0TopByBase &&
            subgraphPool.token0.id != tokenInAddress &&
            subgraphPool.token1.id == tokenOutAddress) {
            topByBaseWithTokenOutPoolsFound += 1;
            poolAddressesSoFar.add(subgraphPool.id);
            if (topByTVLUsingTokenOut.length < topNTokenInOut) {
                topByTVLUsingTokenOut.push(subgraphPool);
            }
            if (routeType === sdk_core_1.TradeType.EXACT_INPUT &&
                subgraphPool.token0.id == wethAddress) {
                topByEthQuoteTokenPool.push(subgraphPool);
            }
            tokenOutToken0TopByBase.pools.push(subgraphPool);
            continue;
        }
        const tokenOutToken1TopByBase = topByBaseWithTokenOutMap.get(subgraphPool.token1.id);
        if (topByBaseWithTokenOutPoolsFound < topNWithBaseToken &&
            tokenOutToken1TopByBase &&
            subgraphPool.token0.id == tokenOutAddress &&
            subgraphPool.token1.id != tokenInAddress) {
            topByBaseWithTokenOutPoolsFound += 1;
            poolAddressesSoFar.add(subgraphPool.id);
            if (topByTVLUsingTokenOut.length < topNTokenInOut) {
                topByTVLUsingTokenOut.push(subgraphPool);
            }
            if (routeType === sdk_core_1.TradeType.EXACT_INPUT &&
                subgraphPool.token1.id == wethAddress) {
                topByEthQuoteTokenPool.push(subgraphPool);
            }
            tokenOutToken1TopByBase.pools.push(subgraphPool);
            continue;
        }
        // Note: we do not need to check other native currencies for the V2 Protocol
        if (topByEthQuoteTokenPool.length < topNEthQuoteToken &&
            ((routeType === sdk_core_1.TradeType.EXACT_INPUT &&
                ((subgraphPool.token0.id == wethAddress &&
                    subgraphPool.token1.id == tokenOutAddress) ||
                    (subgraphPool.token1.id == wethAddress &&
                        subgraphPool.token0.id == tokenOutAddress))) ||
                (routeType === sdk_core_1.TradeType.EXACT_OUTPUT &&
                    ((subgraphPool.token0.id == wethAddress &&
                        subgraphPool.token1.id == tokenInAddress) ||
                        (subgraphPool.token1.id == wethAddress &&
                            subgraphPool.token0.id == tokenInAddress))))) {
            poolAddressesSoFar.add(subgraphPool.id);
            topByEthQuoteTokenPool.push(subgraphPool);
            continue;
        }
        if (topByTVL.length < topN) {
            poolAddressesSoFar.add(subgraphPool.id);
            topByTVL.push(subgraphPool);
            continue;
        }
        if (topByTVLUsingTokenIn.length < topNTokenInOut &&
            (subgraphPool.token0.id == tokenInAddress ||
                subgraphPool.token1.id == tokenInAddress)) {
            poolAddressesSoFar.add(subgraphPool.id);
            topByTVLUsingTokenIn.push(subgraphPool);
            continue;
        }
        if (topByTVLUsingTokenOut.length < topNTokenInOut &&
            (subgraphPool.token0.id == tokenOutAddress ||
                subgraphPool.token1.id == tokenOutAddress)) {
            poolAddressesSoFar.add(subgraphPool.id);
            topByTVLUsingTokenOut.push(subgraphPool);
            continue;
        }
    }
    metric_1.metric.putMetric('V2SubgraphLoopsInFirstIteration', loopsInFirstIteration, metric_1.MetricLoggerUnit.Count);
    const topByBaseWithTokenIn = [];
    for (const topByBaseWithTokenInSelection of topByBaseWithTokenInMap.values()) {
        topByBaseWithTokenIn.push(...topByBaseWithTokenInSelection.pools);
    }
    const topByBaseWithTokenOut = [];
    for (const topByBaseWithTokenOutSelection of topByBaseWithTokenOutMap.values()) {
        topByBaseWithTokenOut.push(...topByBaseWithTokenOutSelection.pools);
    }
    // Filtering step for second hops
    const topByTVLUsingTokenInSecondHopsMap = new Map();
    const topByTVLUsingTokenOutSecondHopsMap = new Map();
    const tokenInSecondHopAddresses = topByTVLUsingTokenIn
        .filter((pool) => {
        // filtering second hops
        if (tokenInAddress === pool.token0.id) {
            return !(tokensToAvoidOnSecondHops === null || tokensToAvoidOnSecondHops === void 0 ? void 0 : tokensToAvoidOnSecondHops.includes(pool.token1.id.toLowerCase()));
        }
        else {
            return !(tokensToAvoidOnSecondHops === null || tokensToAvoidOnSecondHops === void 0 ? void 0 : tokensToAvoidOnSecondHops.includes(pool.token0.id.toLowerCase()));
        }
    })
        .map((pool) => tokenInAddress === pool.token0.id ? pool.token1.id : pool.token0.id);
    const tokenOutSecondHopAddresses = topByTVLUsingTokenOut
        .filter((pool) => {
        // filtering second hops
        if (tokenOutAddress === pool.token0.id) {
            return !(tokensToAvoidOnSecondHops === null || tokensToAvoidOnSecondHops === void 0 ? void 0 : tokensToAvoidOnSecondHops.includes(pool.token1.id.toLowerCase()));
        }
        else {
            return !(tokensToAvoidOnSecondHops === null || tokensToAvoidOnSecondHops === void 0 ? void 0 : tokensToAvoidOnSecondHops.includes(pool.token0.id.toLowerCase()));
        }
    })
        .map((pool) => tokenOutAddress === pool.token0.id ? pool.token1.id : pool.token0.id);
    for (const secondHopId of tokenInSecondHopAddresses) {
        topByTVLUsingTokenInSecondHopsMap.set(secondHopId, new SubcategorySelectionPools([], topNSecondHop));
    }
    for (const secondHopId of tokenOutSecondHopAddresses) {
        topByTVLUsingTokenOutSecondHopsMap.set(secondHopId, new SubcategorySelectionPools([], topNSecondHop));
    }
    // Used to track how many iterations we do in the second loop
    let loopsInSecondIteration = 0;
    if (tokenInSecondHopAddresses.length > 0 ||
        tokenOutSecondHopAddresses.length > 0) {
        for (const subgraphPool of subgraphPoolsSorted) {
            loopsInSecondIteration += 1;
            let allTokenInSecondHopsHaveTheirTopN = true;
            for (const secondHopPools of topByTVLUsingTokenInSecondHopsMap.values()) {
                if (!secondHopPools.hasEnoughPools()) {
                    allTokenInSecondHopsHaveTheirTopN = false;
                    break;
                }
            }
            let allTokenOutSecondHopsHaveTheirTopN = true;
            for (const secondHopPools of topByTVLUsingTokenOutSecondHopsMap.values()) {
                if (!secondHopPools.hasEnoughPools()) {
                    allTokenOutSecondHopsHaveTheirTopN = false;
                    break;
                }
            }
            if (allTokenInSecondHopsHaveTheirTopN &&
                allTokenOutSecondHopsHaveTheirTopN) {
                // We have satisfied all the heuristics, so we can stop.
                break;
            }
            if (poolAddressesSoFar.has(subgraphPool.id)) {
                continue;
            }
            const tokenInToken0SecondHop = topByTVLUsingTokenInSecondHopsMap.get(subgraphPool.token0.id);
            if (tokenInToken0SecondHop && !tokenInToken0SecondHop.hasEnoughPools()) {
                poolAddressesSoFar.add(subgraphPool.id);
                tokenInToken0SecondHop.pools.push(subgraphPool);
                continue;
            }
            const tokenInToken1SecondHop = topByTVLUsingTokenInSecondHopsMap.get(subgraphPool.token1.id);
            if (tokenInToken1SecondHop && !tokenInToken1SecondHop.hasEnoughPools()) {
                poolAddressesSoFar.add(subgraphPool.id);
                tokenInToken1SecondHop.pools.push(subgraphPool);
                continue;
            }
            const tokenOutToken0SecondHop = topByTVLUsingTokenOutSecondHopsMap.get(subgraphPool.token0.id);
            if (tokenOutToken0SecondHop &&
                !tokenOutToken0SecondHop.hasEnoughPools()) {
                poolAddressesSoFar.add(subgraphPool.id);
                tokenOutToken0SecondHop.pools.push(subgraphPool);
                continue;
            }
            const tokenOutToken1SecondHop = topByTVLUsingTokenOutSecondHopsMap.get(subgraphPool.token1.id);
            if (tokenOutToken1SecondHop &&
                !tokenOutToken1SecondHop.hasEnoughPools()) {
                poolAddressesSoFar.add(subgraphPool.id);
                tokenOutToken1SecondHop.pools.push(subgraphPool);
                continue;
            }
        }
    }
    metric_1.metric.putMetric('V2SubgraphLoopsInSecondIteration', loopsInSecondIteration, metric_1.MetricLoggerUnit.Count);
    const topByTVLUsingTokenInSecondHops = [];
    for (const secondHopPools of topByTVLUsingTokenInSecondHopsMap.values()) {
        topByTVLUsingTokenInSecondHops.push(...secondHopPools.pools);
    }
    const topByTVLUsingTokenOutSecondHops = [];
    for (const secondHopPools of topByTVLUsingTokenOutSecondHopsMap.values()) {
        topByTVLUsingTokenOutSecondHops.push(...secondHopPools.pools);
    }
    const subgraphPools = (0, lodash_1.default)([
        ...topByBaseWithTokenIn,
        ...topByBaseWithTokenOut,
        ...topByDirectSwapPool,
        ...topByEthQuoteTokenPool,
        ...topByTVL,
        ...topByTVLUsingTokenIn,
        ...topByTVLUsingTokenOut,
        ...topByTVLUsingTokenInSecondHops,
        ...topByTVLUsingTokenOutSecondHops,
    ])
        .uniqBy((pool) => pool.id)
        .value();
    const tokenAddressesSet = new Set();
    for (const pool of subgraphPools) {
        tokenAddressesSet.add(pool.token0.id);
        tokenAddressesSet.add(pool.token1.id);
    }
    const tokenAddresses = Array.from(tokenAddressesSet);
    log_1.log.info(`Getting the ${tokenAddresses.length} tokens within the ${subgraphPools.length} V2 pools we are considering`);
    metric_1.metric.putMetric('V2PoolsFilterLoad', Date.now() - beforePoolsFiltered, metric_1.MetricLoggerUnit.Milliseconds);
    const beforePoolsLoad = Date.now();
    // Build tokenPairs for V2 pools
    const tokenPairsRaw = lodash_1.default.map(subgraphPools, () => {
        // Use tokenIn and tokenOut directly
        return [tokenIn, tokenOut];
    });
    const tokenPairs = lodash_1.default.compact(tokenPairsRaw);
    const poolAccessor = await poolProvider.getPools(tokenPairs, routingConfig);
    metric_1.metric.putMetric('V2PoolsLoad', Date.now() - beforePoolsLoad, metric_1.MetricLoggerUnit.Milliseconds);
    const poolsBySelection = {
        protocol: router_sdk_1.Protocol.V2,
        selections: {
            topByBaseWithTokenIn,
            topByBaseWithTokenOut,
            topByDirectSwapPool,
            topByEthQuoteTokenPool,
            topByTVL,
            topByTVLUsingTokenIn,
            topByTVLUsingTokenOut,
            topByTVLUsingTokenInSecondHops,
            topByTVLUsingTokenOutSecondHops,
        },
    };
    return { poolAccessor, candidatePools: poolsBySelection, subgraphPools };
}
exports.getV2CandidatePools = getV2CandidatePools;
async function getMixedRouteCandidatePools({ v3CandidatePools, v2CandidatePools, crossLiquidityPools, routingConfig, v2poolProvider, v3poolProvider, }) {
    const beforeSubgraphPools = Date.now();
    const [{ subgraphPools: V3subgraphPools, candidatePools: V3candidatePools }, { subgraphPools: V2subgraphPools, candidatePools: V2candidatePools },] = [v3CandidatePools, v2CandidatePools];
    // Injects the liquidity pools found by the getMixedCrossLiquidityCandidatePools function
    V2subgraphPools.push(...crossLiquidityPools.v2Pools);
    V3subgraphPools.push(...crossLiquidityPools.v3Pools);
    metric_1.metric.putMetric('MixedSubgraphPoolsLoad', Date.now() - beforeSubgraphPools, metric_1.MetricLoggerUnit.Milliseconds);
    const beforePoolsFiltered = Date.now();
    /**
     * Main heuristic for pruning mixedRoutes:
     * - we pick V2 pools with higher liq than respective V3 pools, or if the v3 pool doesn't exist
     *
     * This way we can reduce calls to our provider since it's possible to generate a lot of mixed routes
     */
    /// We only really care about pools involving the tokenIn or tokenOut explictly,
    /// since there's no way a long tail token in V2 would be routed through as an intermediary
    const V2topByTVLPoolIds = new Set([
        ...V2candidatePools.selections.topByTVLUsingTokenIn,
        ...V2candidatePools.selections.topByBaseWithTokenIn,
        /// tokenOut:
        ...V2candidatePools.selections.topByTVLUsingTokenOut,
        ...V2candidatePools.selections.topByBaseWithTokenOut,
        /// Direct swap:
        ...V2candidatePools.selections.topByDirectSwapPool,
        // Cross Liquidity (has to be added to be considered):
        ...crossLiquidityPools.v2Pools,
    ].map((poolId) => poolId.id));
    const V2topByTVLSortedPools = (0, lodash_1.default)(V2subgraphPools)
        .filter((pool) => V2topByTVLPoolIds.has(pool.id))
        .sortBy((pool) => -pool.reserveUSD)
        .value();
    /// we consider all returned V3 pools for this heuristic to "fill in the gaps"
    const V3sortedPools = (0, lodash_1.default)(V3subgraphPools)
        .sortBy((pool) => -pool.tvlUSD)
        .value();
    /// Finding pools with greater reserveUSD on v2 than tvlUSD on v3, or if there is no v3 liquidity
    const buildV2Pools = [];
    V2topByTVLSortedPools.forEach((V2subgraphPool) => {
        const V3subgraphPool = V3sortedPools.find((pool) => (pool.token0.id == V2subgraphPool.token0.id &&
            pool.token1.id == V2subgraphPool.token1.id) ||
            (pool.token0.id == V2subgraphPool.token1.id &&
                pool.token1.id == V2subgraphPool.token0.id));
        if (V3subgraphPool) {
            if (V2subgraphPool.reserveUSD > V3subgraphPool.tvlUSD) {
                log_1.log.info({
                    token0: V2subgraphPool.token0.id,
                    token1: V2subgraphPool.token1.id,
                    v2reserveUSD: V2subgraphPool.reserveUSD,
                    v3tvlUSD: V3subgraphPool.tvlUSD,
                }, `MixedRoute heuristic, found a V2 pool with higher liquidity than its V3 counterpart`);
                buildV2Pools.push(V2subgraphPool);
            }
        }
        else {
            log_1.log.info({
                token0: V2subgraphPool.token0.id,
                token1: V2subgraphPool.token1.id,
                v2reserveUSD: V2subgraphPool.reserveUSD,
            }, `MixedRoute heuristic, found a V2 pool with no V3 counterpart`);
            buildV2Pools.push(V2subgraphPool);
        }
    });
    log_1.log.info(buildV2Pools.length, `Number of V2 candidate pools that fit first heuristic`);
    const subgraphPools = [
        ...buildV2Pools,
        ...V3sortedPools,
    ];
    const tokenAddresses = (0, lodash_1.default)(subgraphPools)
        .flatMap((subgraphPool) => [subgraphPool.token0.id, subgraphPool.token1.id])
        .compact()
        .uniq()
        .value();
    log_1.log.info(`Getting the ${tokenAddresses.length} tokens within the ${subgraphPools.length} pools we are considering`);
    metric_1.metric.putMetric('MixedPoolsFilterLoad', Date.now() - beforePoolsFiltered, metric_1.MetricLoggerUnit.Milliseconds);
    const beforePoolsLoad = Date.now();
    // Build V3tokenPairs and V2tokenPairs by checking for 'feeTier' property and using pool.token0/token1
    const V3tokenPairs = subgraphPools
        .filter((pool) => 'feeTier' in pool)
        .map((pool) => {
        let fee;
        try {
            fee = (0, util_1.parseFeeAmount)(pool.feeTier);
        }
        catch (_a) {
            return undefined;
        }
        return [pool.token0, pool.token1, fee];
    })
        .filter(Boolean);
    const V2tokenPairs = subgraphPools
        .filter((pool) => !('feeTier' in pool))
        .map((pool) => [pool.token0, pool.token1])
        .filter(Boolean);
    const [V2poolAccessor, V3poolAccessor] = await Promise.all([
        v2poolProvider.getPools(V2tokenPairs, routingConfig),
        v3poolProvider.getPools(V3tokenPairs, routingConfig),
    ]);
    metric_1.metric.putMetric('MixedPoolsLoad', Date.now() - beforePoolsLoad, metric_1.MetricLoggerUnit.Milliseconds);
    /// @dev a bit tricky here since the original V2CandidateSelections object included pools that we may have dropped
    /// as part of the heuristic. We need to reconstruct a new object with the v3 pools too.
    const buildPoolsBySelection = (key) => {
        return [
            ...buildV2Pools.filter((pool) => V2candidatePools.selections[key].map((p) => p.id).includes(pool.id)),
            ...V3candidatePools.selections[key],
        ];
    };
    const poolsBySelection = {
        protocol: router_sdk_1.Protocol.MIXED,
        selections: {
            topByBaseWithTokenIn: buildPoolsBySelection('topByBaseWithTokenIn'),
            topByBaseWithTokenOut: buildPoolsBySelection('topByBaseWithTokenOut'),
            topByDirectSwapPool: buildPoolsBySelection('topByDirectSwapPool'),
            topByEthQuoteTokenPool: buildPoolsBySelection('topByEthQuoteTokenPool'),
            topByTVL: buildPoolsBySelection('topByTVL'),
            topByTVLUsingTokenIn: buildPoolsBySelection('topByTVLUsingTokenIn'),
            topByTVLUsingTokenOut: buildPoolsBySelection('topByTVLUsingTokenOut'),
            topByTVLUsingTokenInSecondHops: buildPoolsBySelection('topByTVLUsingTokenInSecondHops'),
            topByTVLUsingTokenOutSecondHops: buildPoolsBySelection('topByTVLUsingTokenOutSecondHops'),
        },
    };
    return {
        V2poolAccessor,
        V3poolAccessor,
        candidatePools: poolsBySelection,
        subgraphPools,
    };
}
exports.getMixedRouteCandidatePools = getMixedRouteCandidatePools;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0LWNhbmRpZGF0ZS1wb29scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9yb3V0ZXJzL2FscGhhLXJvdXRlci9mdW5jdGlvbnMvZ2V0LWNhbmRpZGF0ZS1wb29scy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxrREFBNkM7QUFDN0MsOENBQTREO0FBRTVELG9EQUF1QjtBQU12QixzRUFlMkM7QUFhM0Msd0NBS3VCO0FBQ3ZCLDJDQUF3QztBQUN4QyxpREFBZ0U7QUFxRWhFLE1BQU0saUJBQWlCLEdBQXVDO0lBQzVELENBQUMsa0JBQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO1FBQzFCLHNDQUFxQjtRQUNyQixxQ0FBb0I7UUFDcEIscUNBQW9CO1FBQ3BCLHNDQUFxQjtRQUNyQixxQ0FBb0I7UUFDcEIsc0NBQXFCO1FBQ3JCLHVDQUFzQjtRQUN0Qix1Q0FBc0I7UUFDdEIscUNBQW9CO1FBQ3BCLHNDQUFxQjtRQUNyQixzQ0FBcUI7UUFDckIscUNBQW9CO0tBQ3JCO0lBQ0QsQ0FBQyxrQkFBTyxDQUFDLGdCQUFnQixDQUFDLEVBQUU7UUFDMUIsc0NBQXFCO1FBQ3JCLHFDQUFvQjtLQUNyQjtDQUNGLENBQUM7QUFFRixNQUFNLHlCQUF5QjtJQUM3QixZQUNTLEtBQXFCLEVBQ1osV0FBbUI7UUFENUIsVUFBSyxHQUFMLEtBQUssQ0FBZ0I7UUFDWixnQkFBVyxHQUFYLFdBQVcsQ0FBUTtJQUNqQyxDQUFDO0lBRUUsY0FBYztRQUNuQixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUM7SUFDL0MsQ0FBQztDQUNGO0FBT0Q7Ozs7Ozs7O0dBUUc7QUFDSSxLQUFLLFVBQVUsb0NBQW9DLENBQUMsRUFDekQsT0FBTyxFQUNQLFFBQVEsRUFDUixXQUFXLEVBQ1gsa0JBQWtCLEVBQ2xCLGtCQUFrQixFQUNsQixZQUFZLEVBQ1osWUFBWSxHQUM0QjtJQUN4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