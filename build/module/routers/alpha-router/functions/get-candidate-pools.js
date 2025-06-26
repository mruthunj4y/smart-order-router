import { Protocol } from '@surge/router-sdk';
import { ChainId, TradeType } from '@surge/sdk-core';
import _ from 'lodash';
import { AVAX_XRPL_EVM_TESTNET, AXL_XRPL_EVM_TESTNET, BNB_XRPL_EVM_TESTNET, DAI_ARBITRUM_SEPOLIA, DAI_XRPL_EVM_TESTNET, MATIC_XRPL_EVM_TESTNET, RLUSD_XRPL_EVM_TESTNET, SOL_XRPL_EVM_TESTNET, TON_XRPL_EVM_TESTNET, TRON_XRPL_EVM_TESTNET, USDC_ARBITRUM_SEPOLIA, USDC_XRPL_EVM_TESTNET, USDT_XRPL_EVM_TESTNET, WETH_XRPL_EVM_TESTNET, } from '../../../providers/token-provider';
import { getApplicableV3FeeAmounts, parseFeeAmount, unparseFeeAmount, WRAPPED_NATIVE_CURRENCY, } from '../../../util';
import { log } from '../../../util/log';
import { metric, MetricLoggerUnit } from '../../../util/metric';
const baseTokensByChain = {
    [ChainId.XRPL_EVM_TESTNET]: [
        WETH_XRPL_EVM_TESTNET,
        DAI_XRPL_EVM_TESTNET,
        TON_XRPL_EVM_TESTNET,
        TRON_XRPL_EVM_TESTNET,
        SOL_XRPL_EVM_TESTNET,
        USDC_XRPL_EVM_TESTNET,
        RLUSD_XRPL_EVM_TESTNET,
        MATIC_XRPL_EVM_TESTNET,
        AXL_XRPL_EVM_TESTNET,
        AVAX_XRPL_EVM_TESTNET,
        USDT_XRPL_EVM_TESTNET,
        BNB_XRPL_EVM_TESTNET,
    ],
    [ChainId.ARBITRUM_SEPOLIA]: [
        USDC_ARBITRUM_SEPOLIA,
        DAI_ARBITRUM_SEPOLIA,
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
export async function getMixedCrossLiquidityCandidatePools({ tokenIn, tokenOut, blockNumber, v2SubgraphProvider, v3SubgraphProvider, v2Candidates, v3Candidates, }) {
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
export async function getV3CandidatePools({ tokenIn, tokenOut, routeType, routingConfig, subgraphProvider, poolProvider, chainId, }) {
    var _a, _b, _c, _d, _e, _f, _g;
    const { blockNumber, v3PoolSelection: { topN, topNDirectSwaps, topNTokenInOut, topNSecondHop, topNSecondHopForTokenAddress, tokensToAvoidOnSecondHops, topNWithEachBaseToken, topNWithBaseToken, }, } = routingConfig;
    const tokenInAddress = tokenIn.address.toLowerCase();
    const tokenOutAddress = tokenOut.address.toLowerCase();
    const beforeSubgraphPools = Date.now();
    const allPools = await subgraphProvider.getPools(tokenIn, tokenOut, {
        blockNumber,
    });
    log.info({ samplePools: allPools.slice(0, 3) }, 'Got all pools from V3 subgraph provider');
    // Although this is less of an optimization than the V2 equivalent,
    // save some time copying objects by mutating the underlying pool directly.
    for (const pool of allPools) {
        pool.token0.id = pool.token0.id.toLowerCase();
        pool.token1.id = pool.token1.id.toLowerCase();
    }
    metric.putMetric('V3SubgraphPoolsLoad', Date.now() - beforeSubgraphPools, MetricLoggerUnit.Milliseconds);
    const beforePoolsFiltered = Date.now();
    // Sort by tvlUSD in descending order
    const subgraphPoolsSorted = allPools.sort((a, b) => b.tvlUSD - a.tvlUSD);
    log.info(`After filtering blocked tokens went from ${allPools.length} to ${subgraphPoolsSorted.length}.`);
    const poolAddressesSoFar = new Set();
    const addToAddressSet = (pools) => {
        _(pools)
            .map((pool) => pool.id)
            .forEach((poolAddress) => poolAddressesSoFar.add(poolAddress));
    };
    const baseTokens = (_a = baseTokensByChain[chainId]) !== null && _a !== void 0 ? _a : [];
    const topByBaseWithTokenIn = _(baseTokens)
        .flatMap((token) => {
        return _(subgraphPoolsSorted)
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
    const topByBaseWithTokenOut = _(baseTokens)
        .flatMap((token) => {
        return _(subgraphPoolsSorted)
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
    let top2DirectSwapPool = _(subgraphPoolsSorted)
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
        top2DirectSwapPool = _.map(getApplicableV3FeeAmounts(), (feeAmount) => {
            const { token0, token1, poolAddress } = poolProvider.getPoolAddress(tokenIn, tokenOut, feeAmount);
            return {
                id: poolAddress,
                feeTier: unparseFeeAmount(feeAmount),
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
    const wrappedNativeAddress = ((_d = (_c = (_b = WRAPPED_NATIVE_CURRENCY[chainId]) === null || _b === void 0 ? void 0 : _b.address) === null || _c === void 0 ? void 0 : _c.toLowerCase()) !== null && _d !== void 0 ? _d : '');
    // Main reason we need this is for gas estimates, only needed if token out is not native.
    // We don't check the seen address set because if we've already added pools for getting native quotes
    // theres no need to add more.
    let top2EthQuoteTokenPool = [];
    if ((((_e = WRAPPED_NATIVE_CURRENCY[chainId]) === null || _e === void 0 ? void 0 : _e.symbol) ==
        ((_f = WRAPPED_NATIVE_CURRENCY[ChainId.XRPL_EVM_TESTNET]) === null || _f === void 0 ? void 0 : _f.symbol) &&
        tokenOut.symbol != 'WETH' &&
        tokenOut.symbol != 'WETH9' &&
        tokenOut.symbol != 'ETH') ||
        (((_g = WRAPPED_NATIVE_CURRENCY[chainId]) === null || _g === void 0 ? void 0 : _g.symbol) == WETH_XRPL_EVM_TESTNET.symbol &&
            tokenOut.symbol != 'MATIC' &&
            tokenOut.symbol != 'WMATIC')) {
        top2EthQuoteTokenPool = _(subgraphPoolsSorted)
            .filter((subgraphPool) => {
            if (routeType == TradeType.EXACT_INPUT) {
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
    const topByTVL = _(subgraphPoolsSorted)
        .filter((subgraphPool) => {
        return !poolAddressesSoFar.has(subgraphPool.id);
    })
        .slice(0, topN)
        .value();
    addToAddressSet(topByTVL);
    const topByTVLUsingTokenIn = _(subgraphPoolsSorted)
        .filter((subgraphPool) => {
        return (!poolAddressesSoFar.has(subgraphPool.id) &&
            (subgraphPool.token0.id == tokenInAddress ||
                subgraphPool.token1.id == tokenInAddress));
    })
        .slice(0, topNTokenInOut)
        .value();
    addToAddressSet(topByTVLUsingTokenIn);
    const topByTVLUsingTokenOut = _(subgraphPoolsSorted)
        .filter((subgraphPool) => {
        return (!poolAddressesSoFar.has(subgraphPool.id) &&
            (subgraphPool.token0.id == tokenOutAddress ||
                subgraphPool.token1.id == tokenOutAddress));
    })
        .slice(0, topNTokenInOut)
        .value();
    addToAddressSet(topByTVLUsingTokenOut);
    const topByTVLUsingTokenInSecondHops = _(topByTVLUsingTokenIn)
        .map((subgraphPool) => {
        return tokenInAddress == subgraphPool.token0.id
            ? subgraphPool.token1.id
            : subgraphPool.token0.id;
    })
        .flatMap((secondHopId) => {
        var _a;
        return _(subgraphPoolsSorted)
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
    const topByTVLUsingTokenOutSecondHops = _(topByTVLUsingTokenOut)
        .map((subgraphPool) => {
        return tokenOutAddress == subgraphPool.token0.id
            ? subgraphPool.token1.id
            : subgraphPool.token0.id;
    })
        .flatMap((secondHopId) => {
        var _a;
        return _(subgraphPoolsSorted)
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
    const subgraphPools = _([
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
    const tokenAddresses = _(subgraphPools)
        .flatMap((subgraphPool) => [subgraphPool.token0.id, subgraphPool.token1.id])
        .compact()
        .uniq()
        .value();
    log.info(`Getting the ${tokenAddresses.length} tokens within the ${subgraphPools.length} V3 pools we are considering`);
    metric.putMetric('V3PoolsFilterLoad', Date.now() - beforePoolsFiltered, MetricLoggerUnit.Milliseconds);
    const beforePoolsLoad = Date.now();
    // Build tokenPairs for V3 pools
    const tokenPairsRaw = _.map(subgraphPools, (subgraphPool) => {
        // Use tokenIn and tokenOut directly, as we no longer have tokenAccessor
        let fee;
        try {
            fee = parseFeeAmount(subgraphPool.feeTier);
        }
        catch (err) {
            log.info({ subgraphPool }, `Dropping candidate pool for ${subgraphPool.token0.id}/${subgraphPool.token1.id}/${subgraphPool.feeTier} because fee tier not supported`);
            return undefined;
        }
        // Use tokenIn and tokenOut as the Token objects
        return [tokenIn, tokenOut, fee];
    });
    const tokenPairs = _.compact(tokenPairsRaw);
    const poolAccessor = await poolProvider.getPools(tokenPairs, {
        blockNumber,
    });
    metric.putMetric('V3PoolsLoad', Date.now() - beforePoolsLoad, MetricLoggerUnit.Milliseconds);
    const poolsBySelection = {
        protocol: Protocol.V3,
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
export async function getV2CandidatePools({ tokenIn, tokenOut, routeType, routingConfig, subgraphProvider, poolProvider, chainId, }) {
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
    metric.putMetric('V2SubgraphPoolsLoad', Date.now() - beforeSubgraphPools, MetricLoggerUnit.Milliseconds);
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
    const wethAddress = WRAPPED_NATIVE_CURRENCY[chainId].address.toLowerCase();
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
            if (routeType === TradeType.EXACT_OUTPUT &&
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
            if (routeType === TradeType.EXACT_OUTPUT &&
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
            if (routeType === TradeType.EXACT_INPUT &&
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
            if (routeType === TradeType.EXACT_INPUT &&
                subgraphPool.token1.id == wethAddress) {
                topByEthQuoteTokenPool.push(subgraphPool);
            }
            tokenOutToken1TopByBase.pools.push(subgraphPool);
            continue;
        }
        // Note: we do not need to check other native currencies for the V2 Protocol
        if (topByEthQuoteTokenPool.length < topNEthQuoteToken &&
            ((routeType === TradeType.EXACT_INPUT &&
                ((subgraphPool.token0.id == wethAddress &&
                    subgraphPool.token1.id == tokenOutAddress) ||
                    (subgraphPool.token1.id == wethAddress &&
                        subgraphPool.token0.id == tokenOutAddress))) ||
                (routeType === TradeType.EXACT_OUTPUT &&
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
    metric.putMetric('V2SubgraphLoopsInFirstIteration', loopsInFirstIteration, MetricLoggerUnit.Count);
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
    metric.putMetric('V2SubgraphLoopsInSecondIteration', loopsInSecondIteration, MetricLoggerUnit.Count);
    const topByTVLUsingTokenInSecondHops = [];
    for (const secondHopPools of topByTVLUsingTokenInSecondHopsMap.values()) {
        topByTVLUsingTokenInSecondHops.push(...secondHopPools.pools);
    }
    const topByTVLUsingTokenOutSecondHops = [];
    for (const secondHopPools of topByTVLUsingTokenOutSecondHopsMap.values()) {
        topByTVLUsingTokenOutSecondHops.push(...secondHopPools.pools);
    }
    const subgraphPools = _([
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
    log.info(`Getting the ${tokenAddresses.length} tokens within the ${subgraphPools.length} V2 pools we are considering`);
    metric.putMetric('V2PoolsFilterLoad', Date.now() - beforePoolsFiltered, MetricLoggerUnit.Milliseconds);
    const beforePoolsLoad = Date.now();
    // Build tokenPairs for V2 pools
    const tokenPairsRaw = _.map(subgraphPools, () => {
        // Use tokenIn and tokenOut directly
        return [tokenIn, tokenOut];
    });
    const tokenPairs = _.compact(tokenPairsRaw);
    const poolAccessor = await poolProvider.getPools(tokenPairs, routingConfig);
    metric.putMetric('V2PoolsLoad', Date.now() - beforePoolsLoad, MetricLoggerUnit.Milliseconds);
    const poolsBySelection = {
        protocol: Protocol.V2,
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
export async function getMixedRouteCandidatePools({ v3CandidatePools, v2CandidatePools, crossLiquidityPools, routingConfig, v2poolProvider, v3poolProvider, }) {
    const beforeSubgraphPools = Date.now();
    const [{ subgraphPools: V3subgraphPools, candidatePools: V3candidatePools }, { subgraphPools: V2subgraphPools, candidatePools: V2candidatePools },] = [v3CandidatePools, v2CandidatePools];
    // Injects the liquidity pools found by the getMixedCrossLiquidityCandidatePools function
    V2subgraphPools.push(...crossLiquidityPools.v2Pools);
    V3subgraphPools.push(...crossLiquidityPools.v3Pools);
    metric.putMetric('MixedSubgraphPoolsLoad', Date.now() - beforeSubgraphPools, MetricLoggerUnit.Milliseconds);
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
    const V2topByTVLSortedPools = _(V2subgraphPools)
        .filter((pool) => V2topByTVLPoolIds.has(pool.id))
        .sortBy((pool) => -pool.reserveUSD)
        .value();
    /// we consider all returned V3 pools for this heuristic to "fill in the gaps"
    const V3sortedPools = _(V3subgraphPools)
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
                log.info({
                    token0: V2subgraphPool.token0.id,
                    token1: V2subgraphPool.token1.id,
                    v2reserveUSD: V2subgraphPool.reserveUSD,
                    v3tvlUSD: V3subgraphPool.tvlUSD,
                }, `MixedRoute heuristic, found a V2 pool with higher liquidity than its V3 counterpart`);
                buildV2Pools.push(V2subgraphPool);
            }
        }
        else {
            log.info({
                token0: V2subgraphPool.token0.id,
                token1: V2subgraphPool.token1.id,
                v2reserveUSD: V2subgraphPool.reserveUSD,
            }, `MixedRoute heuristic, found a V2 pool with no V3 counterpart`);
            buildV2Pools.push(V2subgraphPool);
        }
    });
    log.info(buildV2Pools.length, `Number of V2 candidate pools that fit first heuristic`);
    const subgraphPools = [
        ...buildV2Pools,
        ...V3sortedPools,
    ];
    const tokenAddresses = _(subgraphPools)
        .flatMap((subgraphPool) => [subgraphPool.token0.id, subgraphPool.token1.id])
        .compact()
        .uniq()
        .value();
    log.info(`Getting the ${tokenAddresses.length} tokens within the ${subgraphPools.length} pools we are considering`);
    metric.putMetric('MixedPoolsFilterLoad', Date.now() - beforePoolsFiltered, MetricLoggerUnit.Milliseconds);
    const beforePoolsLoad = Date.now();
    // Build V3tokenPairs and V2tokenPairs by checking for 'feeTier' property and using pool.token0/token1
    const V3tokenPairs = subgraphPools
        .filter((pool) => 'feeTier' in pool)
        .map((pool) => {
        let fee;
        try {
            fee = parseFeeAmount(pool.feeTier);
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
    metric.putMetric('MixedPoolsLoad', Date.now() - beforePoolsLoad, MetricLoggerUnit.Milliseconds);
    /// @dev a bit tricky here since the original V2CandidateSelections object included pools that we may have dropped
    /// as part of the heuristic. We need to reconstruct a new object with the v3 pools too.
    const buildPoolsBySelection = (key) => {
        return [
            ...buildV2Pools.filter((pool) => V2candidatePools.selections[key].map((p) => p.id).includes(pool.id)),
            ...V3candidatePools.selections[key],
        ];
    };
    const poolsBySelection = {
        protocol: Protocol.MIXED,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0LWNhbmRpZGF0ZS1wb29scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9yb3V0ZXJzL2FscGhhLXJvdXRlci9mdW5jdGlvbnMvZ2V0LWNhbmRpZGF0ZS1wb29scy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDN0MsT0FBTyxFQUFFLE9BQU8sRUFBUyxTQUFTLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUU1RCxPQUFPLENBQUMsTUFBTSxRQUFRLENBQUM7QUFNdkIsT0FBTyxFQUNMLHFCQUFxQixFQUNyQixvQkFBb0IsRUFDcEIsb0JBQW9CLEVBQ3BCLG9CQUFvQixFQUNwQixvQkFBb0IsRUFDcEIsc0JBQXNCLEVBQ3RCLHNCQUFzQixFQUN0QixvQkFBb0IsRUFDcEIsb0JBQW9CLEVBQ3BCLHFCQUFxQixFQUNyQixxQkFBcUIsRUFDckIscUJBQXFCLEVBQ3JCLHFCQUFxQixFQUNyQixxQkFBcUIsR0FDdEIsTUFBTSxtQ0FBbUMsQ0FBQztBQWEzQyxPQUFPLEVBQ0wseUJBQXlCLEVBQ3pCLGNBQWMsRUFDZCxnQkFBZ0IsRUFDaEIsdUJBQXVCLEdBQ3hCLE1BQU0sZUFBZSxDQUFDO0FBQ3ZCLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUN4QyxPQUFPLEVBQUUsTUFBTSxFQUFFLGdCQUFnQixFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFxRWhFLE1BQU0saUJBQWlCLEdBQXVDO0lBQzVELENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLEVBQUU7UUFDMUIscUJBQXFCO1FBQ3JCLG9CQUFvQjtRQUNwQixvQkFBb0I7UUFDcEIscUJBQXFCO1FBQ3JCLG9CQUFvQjtRQUNwQixxQkFBcUI7UUFDckIsc0JBQXNCO1FBQ3RCLHNCQUFzQjtRQUN0QixvQkFBb0I7UUFDcEIscUJBQXFCO1FBQ3JCLHFCQUFxQjtRQUNyQixvQkFBb0I7S0FDckI7SUFDRCxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO1FBQzFCLHFCQUFxQjtRQUNyQixvQkFBb0I7S0FDckI7Q0FDRixDQUFDO0FBRUYsTUFBTSx5QkFBeUI7SUFDN0IsWUFDUyxLQUFxQixFQUNaLFdBQW1CO1FBRDVCLFVBQUssR0FBTCxLQUFLLENBQWdCO1FBQ1osZ0JBQVcsR0FBWCxXQUFXLENBQVE7SUFDakMsQ0FBQztJQUVFLGNBQWM7UUFDbkIsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDO0lBQy9DLENBQUM7Q0FDRjtBQU9EOzs7Ozs7OztHQVFHO0FBQ0gsTUFBTSxDQUFDLEtBQUssVUFBVSxvQ0FBb0MsQ0FBQyxFQUN6RCxPQUFPLEVBQ1AsUUFBUSxFQUNSLFdBQVcsRUFDWCxrQkFBa0IsRUFDbEIsa0JBQWtCLEVBQ2xCLFlBQVksRUFDWixZQUFZLEdBQzRCO0lBQ3hDLE1BQU0sT0FBTyxHQUFHLENBQ2QsTUFBTSxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRTtRQUNuRCxXQUFXO0tBQ1osQ0FBQyxDQUNILENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDeEMsTUFBTSxPQUFPLEdBQUcsQ0FDZCxNQUFNLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFO1FBQ25ELFdBQVc7S0FDWixDQUFDLENBQ0gsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUV0QyxNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQ3JELE1BQU0sZUFBZSxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUM7SUFFdkQsTUFBTSxlQUFlLEdBQUcsNkJBQTZCLENBQ25ELGNBQWMsRUFDZCxlQUFlLEVBQ2YsT0FBTyxFQUNQLFlBQVksRUFDWixZQUFZLENBQ2IsQ0FBQztJQUVGLE1BQU0sZUFBZSxHQUFHLDZCQUE2QixDQUNuRCxjQUFjLEVBQ2QsZUFBZSxFQUNmLE9BQU8sRUFDUCxZQUFZLEVBQ1osWUFBWSxDQUNiLENBQUM7SUFFRixNQUFNLGVBQWUsR0FBRztRQUN0QixlQUFlLENBQUMsVUFBVTtRQUMxQixlQUFlLENBQUMsV0FBVztLQUM1QixDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxLQUFLLFNBQVMsQ0FBcUIsQ0FBQztJQUMzRCxNQUFNLGVBQWUsR0FBRztRQUN0QixlQUFlLENBQUMsVUFBVTtRQUMxQixlQUFlLENBQUMsV0FBVztLQUM1QixDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxLQUFLLFNBQVMsQ0FBcUIsQ0FBQztJQUUzRCxPQUFPO1FBQ0wsT0FBTyxFQUFFLGVBQWU7UUFDeEIsT0FBTyxFQUFFLGVBQWU7S0FDekIsQ0FBQztBQUNKLENBQUM7QUFFRCxTQUFTLDZCQUE2QixDQUtwQyxjQUFzQixFQUN0QixlQUF1QixFQUN2QixLQUFzQixFQUN0Qiw0QkFBd0UsRUFDeEUsMkJBQXlFOztJQUt6RSxNQUFNLGFBQWEsR0FHZixFQUFFLENBQUM7SUFDUCxNQUFNLHVCQUF1QixHQUFHLElBQUksR0FBRyxDQUNyQyxNQUFBLDRCQUE0QixhQUE1Qiw0QkFBNEIsdUJBQTVCLDRCQUE0QixDQUFFLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsbUNBQUksRUFBRSxDQUN6RSxDQUFDO0lBRUYsTUFBTSx3QkFBd0IsR0FDNUIsMkJBQTJCLGFBQTNCLDJCQUEyQix1QkFBM0IsMkJBQTJCLENBQUUsY0FBYyxDQUFDLFVBQVUsQ0FDbkQscUJBQXFCLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDOUIsTUFBTSx5QkFBeUIsR0FDN0IsQ0FBQSx3QkFBd0IsYUFBeEIsd0JBQXdCLHVCQUF4Qix3QkFBd0IsQ0FBRSxNQUFNLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxNQUFLLGVBQWU7UUFDbkUsQ0FBQyxDQUFDLHdCQUF3QixhQUF4Qix3QkFBd0IsdUJBQXhCLHdCQUF3QixDQUFFLE1BQU0sQ0FBQyxFQUFFLENBQUMsV0FBVyxFQUFFO1FBQ25ELENBQUMsQ0FBQyx3QkFBd0IsYUFBeEIsd0JBQXdCLHVCQUF4Qix3QkFBd0IsQ0FBRSxNQUFNLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBRXhELE1BQU0sdUJBQXVCLEdBQzNCLDJCQUEyQixhQUEzQiwyQkFBMkIsdUJBQTNCLDJCQUEyQixDQUFFLGNBQWMsQ0FBQyxVQUFVLENBQ25ELG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzdCLE1BQU0sd0JBQXdCLEdBQzVCLENBQUEsdUJBQXVCLGFBQXZCLHVCQUF1Qix1QkFBdkIsdUJBQXVCLENBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxXQUFXLEVBQUUsTUFBSyxjQUFjO1FBQ2pFLENBQUMsQ0FBQyx1QkFBdUIsYUFBdkIsdUJBQXVCLHVCQUF2Qix1QkFBdUIsQ0FBRSxNQUFNLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRTtRQUNsRCxDQUFDLENBQUMsdUJBQXVCLGFBQXZCLHVCQUF1Qix1QkFBdkIsdUJBQXVCLENBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUV2RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssRUFBRTtRQUN4Qix1RkFBdUY7UUFDdkYsSUFDRSxhQUFhLENBQUMsVUFBVSxLQUFLLFNBQVM7WUFDdEMsYUFBYSxDQUFDLFdBQVcsS0FBSyxTQUFTLEVBQ3ZDO1lBQ0EsTUFBTTtTQUNQO1FBRUQsb0VBQW9FO1FBQ3BFLElBQUksdUJBQXVCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRTtZQUN4QyxTQUFTO1NBQ1Y7UUFFRCxNQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ3ZELE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFdkQsc0lBQXNJO1FBQ3RJLElBQ0UsYUFBYSxDQUFDLFVBQVUsS0FBSyxTQUFTO1lBQ3RDLENBQUMsQ0FBQyxpQkFBaUIsS0FBSyxlQUFlO2dCQUNyQyxpQkFBaUIsS0FBSyx3QkFBd0IsQ0FBQztnQkFDL0MsQ0FBQyxpQkFBaUIsS0FBSyxlQUFlO29CQUNwQyxpQkFBaUIsS0FBSyx3QkFBd0IsQ0FBQyxDQUFDLEVBQ3BEO1lBQ0EsYUFBYSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7U0FDakM7UUFFRCxzSUFBc0k7UUFDdEksSUFDRSxhQUFhLENBQUMsV0FBVyxLQUFLLFNBQVM7WUFDdkMsQ0FBQyxDQUFDLGlCQUFpQixLQUFLLGNBQWM7Z0JBQ3BDLGlCQUFpQixLQUFLLHlCQUF5QixDQUFDO2dCQUNoRCxDQUFDLGlCQUFpQixLQUFLLGNBQWM7b0JBQ25DLGlCQUFpQixLQUFLLHlCQUF5QixDQUFDLENBQUMsRUFDckQ7WUFDQSxhQUFhLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztTQUNsQztLQUNGO0lBRUQsT0FBTyxhQUFhLENBQUM7QUFDdkIsQ0FBQztBQUVELE1BQU0sQ0FBQyxLQUFLLFVBQVUsbUJBQW1CLENBQUMsRUFDeEMsT0FBTyxFQUNQLFFBQVEsRUFDUixTQUFTLEVBQ1QsYUFBYSxFQUNiLGdCQUFnQixFQUNoQixZQUFZLEVBQ1osT0FBTyxHQUNtQjs7SUFDMUIsTUFBTSxFQUNKLFdBQVcsRUFDWCxlQUFlLEVBQUUsRUFDZixJQUFJLEVBQ0osZUFBZSxFQUNmLGNBQWMsRUFDZCxhQUFhLEVBQ2IsNEJBQTRCLEVBQzVCLHlCQUF5QixFQUN6QixxQkFBcUIsRUFDckIsaUJBQWlCLEdBQ2xCLEdBQ0YsR0FBRyxhQUFhLENBQUM7SUFDbEIsTUFBTSxjQUFjLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUNyRCxNQUFNLGVBQWUsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBRXZELE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBRXZDLE1BQU0sUUFBUSxHQUFHLE1BQU0sZ0JBQWdCLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUU7UUFDbEUsV0FBVztLQUNaLENBQUMsQ0FBQztJQUVILEdBQUcsQ0FBQyxJQUFJLENBQ04sRUFBRSxXQUFXLEVBQUUsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFDckMseUNBQXlDLENBQzFDLENBQUM7SUFFRixtRUFBbUU7SUFDbkUsMkVBQTJFO0lBQzNFLEtBQUssTUFBTSxJQUFJLElBQUksUUFBUSxFQUFFO1FBQzNCLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQzlDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO0tBQy9DO0lBRUQsTUFBTSxDQUFDLFNBQVMsQ0FDZCxxQkFBcUIsRUFDckIsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLG1CQUFtQixFQUNoQyxnQkFBZ0IsQ0FBQyxZQUFZLENBQzlCLENBQUM7SUFFRixNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUV2QyxxQ0FBcUM7SUFDckMsTUFBTSxtQkFBbUIsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFekUsR0FBRyxDQUFDLElBQUksQ0FDTiw0Q0FBNEMsUUFBUSxDQUFDLE1BQU0sT0FBTyxtQkFBbUIsQ0FBQyxNQUFNLEdBQUcsQ0FDaEcsQ0FBQztJQUVGLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztJQUM3QyxNQUFNLGVBQWUsR0FBRyxDQUFDLEtBQXVCLEVBQUUsRUFBRTtRQUNsRCxDQUFDLENBQUMsS0FBSyxDQUFDO2FBQ0wsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2FBQ3RCLE9BQU8sQ0FBQyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7SUFDbkUsQ0FBQyxDQUFDO0lBRUYsTUFBTSxVQUFVLEdBQUcsTUFBQSxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsbUNBQUksRUFBRSxDQUFDO0lBRXBELE1BQU0sb0JBQW9CLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQztTQUN2QyxPQUFPLENBQUMsQ0FBQyxLQUFZLEVBQUUsRUFBRTtRQUN4QixPQUFPLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQzthQUMxQixNQUFNLENBQUMsQ0FBQyxZQUFZLEVBQUUsRUFBRTtZQUN2QixNQUFNLFlBQVksR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ2pELE9BQU8sQ0FDTCxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLFlBQVk7Z0JBQ3JDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLGNBQWMsQ0FBQztnQkFDM0MsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsSUFBSSxZQUFZO29CQUNyQyxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsSUFBSSxjQUFjLENBQUMsQ0FDNUMsQ0FBQztRQUNKLENBQUMsQ0FBQzthQUNELE1BQU0sQ0FBQyxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUMsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDO2FBQ2hELEtBQUssQ0FBQyxDQUFDLEVBQUUscUJBQXFCLENBQUM7YUFDL0IsS0FBSyxFQUFFLENBQUM7SUFDYixDQUFDLENBQUM7U0FDRCxNQUFNLENBQUMsQ0FBQyxhQUFhLEVBQUUsRUFBRSxDQUFDLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQztTQUNoRCxLQUFLLENBQUMsQ0FBQyxFQUFFLGlCQUFpQixDQUFDO1NBQzNCLEtBQUssRUFBRSxDQUFDO0lBRVgsTUFBTSxxQkFBcUIsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDO1NBQ3hDLE9BQU8sQ0FBQyxDQUFDLEtBQVksRUFBRSxFQUFFO1FBQ3hCLE9BQU8sQ0FBQyxDQUFDLG1CQUFtQixDQUFDO2FBQzFCLE1BQU0sQ0FBQyxDQUFDLFlBQVksRUFBRSxFQUFFO1lBQ3ZCLE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDakQsT0FBTyxDQUNMLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksWUFBWTtnQkFDckMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksZUFBZSxDQUFDO2dCQUM1QyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLFlBQVk7b0JBQ3JDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLGVBQWUsQ0FBQyxDQUM3QyxDQUFDO1FBQ0osQ0FBQyxDQUFDO2FBQ0QsTUFBTSxDQUFDLENBQUMsYUFBYSxFQUFFLEVBQUUsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUM7YUFDaEQsS0FBSyxDQUFDLENBQUMsRUFBRSxxQkFBcUIsQ0FBQzthQUMvQixLQUFLLEVBQUUsQ0FBQztJQUNiLENBQUMsQ0FBQztTQUNELE1BQU0sQ0FBQyxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUMsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDO1NBQ2hELEtBQUssQ0FBQyxDQUFDLEVBQUUsaUJBQWlCLENBQUM7U0FDM0IsS0FBSyxFQUFFLENBQUM7SUFFWCxJQUFJLGtCQUFrQixHQUFHLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQztTQUM1QyxNQUFNLENBQUMsQ0FBQyxZQUFZLEVBQUUsRUFBRTtRQUN2QixPQUFPLENBQ0wsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQztZQUN4QyxDQUFDLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksY0FBYztnQkFDeEMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksZUFBZSxDQUFDO2dCQUMxQyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLGNBQWM7b0JBQ3ZDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLGVBQWUsQ0FBQyxDQUFDLENBQ2hELENBQUM7SUFDSixDQUFDLENBQUM7U0FDRCxLQUFLLENBQUMsQ0FBQyxFQUFFLGVBQWUsQ0FBQztTQUN6QixLQUFLLEVBQUUsQ0FBQztJQUVYLElBQUksa0JBQWtCLENBQUMsTUFBTSxJQUFJLENBQUMsSUFBSSxlQUFlLEdBQUcsQ0FBQyxFQUFFO1FBQ3pELGdGQUFnRjtRQUNoRiwrRkFBK0Y7UUFDL0YsdUdBQXVHO1FBQ3ZHLGtCQUFrQixHQUFHLENBQUMsQ0FBQyxHQUFHLENBQ3hCLHlCQUF5QixFQUFFLEVBQzNCLENBQUMsU0FBUyxFQUFFLEVBQUU7WUFDWixNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsR0FBRyxZQUFZLENBQUMsY0FBYyxDQUNqRSxPQUFPLEVBQ1AsUUFBUSxFQUNSLFNBQVMsQ0FDVixDQUFDO1lBQ0YsT0FBTztnQkFDTCxFQUFFLEVBQUUsV0FBVztnQkFDZixPQUFPLEVBQUUsZ0JBQWdCLENBQUMsU0FBUyxDQUFDO2dCQUNwQyxTQUFTLEVBQUUsT0FBTztnQkFDbEIsTUFBTSxFQUFFO29CQUNOLEVBQUUsRUFBRSxNQUFNLENBQUMsT0FBTztpQkFDbkI7Z0JBQ0QsTUFBTSxFQUFFO29CQUNOLEVBQUUsRUFBRSxNQUFNLENBQUMsT0FBTztpQkFDbkI7Z0JBQ0QsTUFBTSxFQUFFLEtBQUs7Z0JBQ2IsTUFBTSxFQUFFLEtBQUs7YUFDZCxDQUFDO1FBQ0osQ0FBQyxDQUNGLENBQUM7S0FDSDtJQUVELGVBQWUsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0lBRXBDLE1BQU0sb0JBQW9CLEdBQ3hCLENBQUMsTUFBQSxNQUFBLE1BQUEsdUJBQXVCLENBQUMsT0FBTyxDQUFDLDBDQUFFLE9BQU8sMENBQUUsV0FBVyxFQUFFLG1DQUFJLEVBQUUsQ0FBQyxDQUFDO0lBRW5FLHlGQUF5RjtJQUN6RixxR0FBcUc7SUFDckcsOEJBQThCO0lBQzlCLElBQUkscUJBQXFCLEdBQXFCLEVBQUUsQ0FBQztJQUNqRCxJQUNFLENBQUMsQ0FBQSxNQUFBLHVCQUF1QixDQUFDLE9BQU8sQ0FBQywwQ0FBRSxNQUFNO1NBQ3ZDLE1BQUEsdUJBQXVCLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLDBDQUFFLE1BQU0sQ0FBQTtRQUN6RCxRQUFRLENBQUMsTUFBTSxJQUFJLE1BQU07UUFDekIsUUFBUSxDQUFDLE1BQU0sSUFBSSxPQUFPO1FBQzFCLFFBQVEsQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDO1FBQzNCLENBQUMsQ0FBQSxNQUFBLHVCQUF1QixDQUFDLE9BQU8sQ0FBQywwQ0FBRSxNQUFNLEtBQUkscUJBQXFCLENBQUMsTUFBTTtZQUN2RSxRQUFRLENBQUMsTUFBTSxJQUFJLE9BQU87WUFDMUIsUUFBUSxDQUFDLE1BQU0sSUFBSSxRQUFRLENBQUMsRUFDOUI7UUFDQSxxQkFBcUIsR0FBRyxDQUFDLENBQUMsbUJBQW1CLENBQUM7YUFDM0MsTUFBTSxDQUFDLENBQUMsWUFBWSxFQUFFLEVBQUU7WUFDdkIsSUFBSSxTQUFTLElBQUksU0FBUyxDQUFDLFdBQVcsRUFBRTtnQkFDdEMsT0FBTyxDQUNMLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksb0JBQW9CO29CQUM3QyxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsSUFBSSxlQUFlLENBQUM7b0JBQzVDLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksb0JBQW9CO3dCQUM3QyxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsSUFBSSxlQUFlLENBQUMsQ0FDN0MsQ0FBQzthQUNIO2lCQUFNO2dCQUNMLE9BQU8sQ0FDTCxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLG9CQUFvQjtvQkFDN0MsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksY0FBYyxDQUFDO29CQUMzQyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLG9CQUFvQjt3QkFDN0MsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksY0FBYyxDQUFDLENBQzVDLENBQUM7YUFDSDtRQUNILENBQUMsQ0FBQzthQUNELEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO2FBQ1gsS0FBSyxFQUFFLENBQUM7S0FDWjtJQUVELGVBQWUsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0lBRXZDLE1BQU0sUUFBUSxHQUFHLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQztTQUNwQyxNQUFNLENBQUMsQ0FBQyxZQUFZLEVBQUUsRUFBRTtRQUN2QixPQUFPLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNsRCxDQUFDLENBQUM7U0FDRCxLQUFLLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQztTQUNkLEtBQUssRUFBRSxDQUFDO0lBRVgsZUFBZSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRTFCLE1BQU0sb0JBQW9CLEdBQUcsQ0FBQyxDQUFDLG1CQUFtQixDQUFDO1NBQ2hELE1BQU0sQ0FBQyxDQUFDLFlBQVksRUFBRSxFQUFFO1FBQ3ZCLE9BQU8sQ0FDTCxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO1lBQ3hDLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksY0FBYztnQkFDdkMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksY0FBYyxDQUFDLENBQzVDLENBQUM7SUFDSixDQUFDLENBQUM7U0FDRCxLQUFLLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQztTQUN4QixLQUFLLEVBQUUsQ0FBQztJQUVYLGVBQWUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0lBRXRDLE1BQU0scUJBQXFCLEdBQUcsQ0FBQyxDQUFDLG1CQUFtQixDQUFDO1NBQ2pELE1BQU0sQ0FBQyxDQUFDLFlBQVksRUFBRSxFQUFFO1FBQ3ZCLE9BQU8sQ0FDTCxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO1lBQ3hDLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksZUFBZTtnQkFDeEMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksZUFBZSxDQUFDLENBQzdDLENBQUM7SUFDSixDQUFDLENBQUM7U0FDRCxLQUFLLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQztTQUN4QixLQUFLLEVBQUUsQ0FBQztJQUVYLGVBQWUsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0lBRXZDLE1BQU0sOEJBQThCLEdBQUcsQ0FBQyxDQUFDLG9CQUFvQixDQUFDO1NBQzNELEdBQUcsQ0FBQyxDQUFDLFlBQVksRUFBRSxFQUFFO1FBQ3BCLE9BQU8sY0FBYyxJQUFJLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUM3QyxDQUFDLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ3hCLENBQUMsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztJQUM3QixDQUFDLENBQUM7U0FDRCxPQUFPLENBQUMsQ0FBQyxXQUFtQixFQUFFLEVBQUU7O1FBQy9CLE9BQU8sQ0FBQyxDQUFDLG1CQUFtQixDQUFDO2FBQzFCLE1BQU0sQ0FBQyxDQUFDLFlBQVksRUFBRSxFQUFFO1lBQ3ZCLE9BQU8sQ0FDTCxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO2dCQUN4QyxDQUFDLENBQUEseUJBQXlCLGFBQXpCLHlCQUF5Qix1QkFBekIseUJBQXlCLENBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFBO2dCQUMvRCxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLFdBQVc7b0JBQ3BDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLFdBQVcsQ0FBQyxDQUN6QyxDQUFDO1FBQ0osQ0FBQyxDQUFDO2FBQ0QsS0FBSyxDQUNKLENBQUMsRUFDRCxNQUFBLDRCQUE0QixhQUE1Qiw0QkFBNEIsdUJBQTVCLDRCQUE0QixDQUFFLEdBQUcsQ0FBQyxXQUFXLENBQUMsbUNBQUksYUFBYSxDQUNoRTthQUNBLEtBQUssRUFBRSxDQUFDO0lBQ2IsQ0FBQyxDQUFDO1NBQ0QsTUFBTSxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1NBQ3pCLEtBQUssRUFBRSxDQUFDO0lBRVgsZUFBZSxDQUFDLDhCQUE4QixDQUFDLENBQUM7SUFFaEQsTUFBTSwrQkFBK0IsR0FBRyxDQUFDLENBQUMscUJBQXFCLENBQUM7U0FDN0QsR0FBRyxDQUFDLENBQUMsWUFBWSxFQUFFLEVBQUU7UUFDcEIsT0FBTyxlQUFlLElBQUksWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQzlDLENBQUMsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDeEIsQ0FBQyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO0lBQzdCLENBQUMsQ0FBQztTQUNELE9BQU8sQ0FBQyxDQUFDLFdBQW1CLEVBQUUsRUFBRTs7UUFDL0IsT0FBTyxDQUFDLENBQUMsbUJBQW1CLENBQUM7YUFDMUIsTUFBTSxDQUFDLENBQUMsWUFBWSxFQUFFLEVBQUU7WUFDdkIsT0FBTyxDQUNMLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUM7Z0JBQ3hDLENBQUMsQ0FBQSx5QkFBeUIsYUFBekIseUJBQXlCLHVCQUF6Qix5QkFBeUIsQ0FBRSxRQUFRLENBQUMsV0FBVyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUE7Z0JBQy9ELENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksV0FBVztvQkFDcEMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksV0FBVyxDQUFDLENBQ3pDLENBQUM7UUFDSixDQUFDLENBQUM7YUFDRCxLQUFLLENBQ0osQ0FBQyxFQUNELE1BQUEsNEJBQTRCLGFBQTVCLDRCQUE0Qix1QkFBNUIsNEJBQTRCLENBQUUsR0FBRyxDQUFDLFdBQVcsQ0FBQyxtQ0FBSSxhQUFhLENBQ2hFO2FBQ0EsS0FBSyxFQUFFLENBQUM7SUFDYixDQUFDLENBQUM7U0FDRCxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7U0FDekIsS0FBSyxFQUFFLENBQUM7SUFFWCxlQUFlLENBQUMsK0JBQStCLENBQUMsQ0FBQztJQUVqRCxNQUFNLGFBQWEsR0FBRyxDQUFDLENBQUM7UUFDdEIsR0FBRyxvQkFBb0I7UUFDdkIsR0FBRyxxQkFBcUI7UUFDeEIsR0FBRyxrQkFBa0I7UUFDckIsR0FBRyxxQkFBcUI7UUFDeEIsR0FBRyxRQUFRO1FBQ1gsR0FBRyxvQkFBb0I7UUFDdkIsR0FBRyxxQkFBcUI7UUFDeEIsR0FBRyw4QkFBOEI7UUFDakMsR0FBRywrQkFBK0I7S0FDbkMsQ0FBQztTQUNDLE9BQU8sRUFBRTtTQUNULE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztTQUN6QixLQUFLLEVBQUUsQ0FBQztJQUVYLE1BQU0sY0FBYyxHQUFHLENBQUMsQ0FBQyxhQUFhLENBQUM7U0FDcEMsT0FBTyxDQUFDLENBQUMsWUFBWSxFQUFFLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7U0FDM0UsT0FBTyxFQUFFO1NBQ1QsSUFBSSxFQUFFO1NBQ04sS0FBSyxFQUFFLENBQUM7SUFFWCxHQUFHLENBQUMsSUFBSSxDQUNOLGVBQWUsY0FBYyxDQUFDLE1BQU0sc0JBQXNCLGFBQWEsQ0FBQyxNQUFNLDhCQUE4QixDQUM3RyxDQUFDO0lBRUYsTUFBTSxDQUFDLFNBQVMsQ0FDZCxtQkFBbUIsRUFDbkIsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLG1CQUFtQixFQUNoQyxnQkFBZ0IsQ0FBQyxZQUFZLENBQzlCLENBQUM7SUFFRixNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7SUFFbkMsZ0NBQWdDO0lBQ2hDLE1BQU0sYUFBYSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBR3pCLGFBQWEsRUFBRSxDQUFDLFlBQVksRUFBRSxFQUFFO1FBQ2hDLHdFQUF3RTtRQUN4RSxJQUFJLEdBQWMsQ0FBQztRQUNuQixJQUFJO1lBQ0YsR0FBRyxHQUFHLGNBQWMsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7U0FDNUM7UUFBQyxPQUFPLEdBQUcsRUFBRTtZQUNaLEdBQUcsQ0FBQyxJQUFJLENBQ04sRUFBRSxZQUFZLEVBQUUsRUFDaEIsK0JBQStCLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLFlBQVksQ0FBQyxPQUFPLGlDQUFpQyxDQUN6SSxDQUFDO1lBQ0YsT0FBTyxTQUFTLENBQUM7U0FDbEI7UUFDRCxnREFBZ0Q7UUFDaEQsT0FBTyxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDbEMsQ0FBQyxDQUFDLENBQUM7SUFDSCxNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBRTVDLE1BQU0sWUFBWSxHQUFHLE1BQU0sWUFBWSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUU7UUFDM0QsV0FBVztLQUNaLENBQUMsQ0FBQztJQUVILE1BQU0sQ0FBQyxTQUFTLENBQ2QsYUFBYSxFQUNiLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxlQUFlLEVBQzVCLGdCQUFnQixDQUFDLFlBQVksQ0FDOUIsQ0FBQztJQUVGLE1BQU0sZ0JBQWdCLEdBQXNDO1FBQzFELFFBQVEsRUFBRSxRQUFRLENBQUMsRUFBRTtRQUNyQixVQUFVLEVBQUU7WUFDVixvQkFBb0I7WUFDcEIscUJBQXFCO1lBQ3JCLG1CQUFtQixFQUFFLGtCQUFrQjtZQUN2QyxzQkFBc0IsRUFBRSxxQkFBcUI7WUFDN0MsUUFBUTtZQUNSLG9CQUFvQjtZQUNwQixxQkFBcUI7WUFDckIsOEJBQThCO1lBQzlCLCtCQUErQjtTQUNoQztLQUNGLENBQUM7SUFFRixPQUFPLEVBQUUsWUFBWSxFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsQ0FBQztBQUMzRSxDQUFDO0FBUUQsTUFBTSxDQUFDLEtBQUssVUFBVSxtQkFBbUIsQ0FBQyxFQUN4QyxPQUFPLEVBQ1AsUUFBUSxFQUNSLFNBQVMsRUFDVCxhQUFhLEVBQ2IsZ0JBQWdCLEVBQ2hCLFlBQVksRUFDWixPQUFPLEdBQ21COztJQUMxQixNQUFNLEVBQ0osV0FBVyxFQUNYLGVBQWUsRUFBRSxFQUNmLElBQUksRUFDSixlQUFlLEVBQ2YsY0FBYyxFQUNkLGFBQWEsRUFDYix5QkFBeUIsRUFDekIscUJBQXFCLEVBQ3JCLGlCQUFpQixHQUNsQixHQUNGLEdBQUcsYUFBYSxDQUFDO0lBQ2xCLE1BQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDckQsTUFBTSxlQUFlLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUV2RCxNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUV2QyxNQUFNLFdBQVcsR0FBRyxNQUFNLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFO1FBQ3JFLFdBQVc7S0FDWixDQUFDLENBQUM7SUFFSCxnRkFBZ0Y7SUFDaEYsMkZBQTJGO0lBQzNGLEtBQUssTUFBTSxJQUFJLElBQUksV0FBVyxFQUFFO1FBQzlCLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQzlDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO0tBQy9DO0lBRUQsTUFBTSxDQUFDLFNBQVMsQ0FDZCxxQkFBcUIsRUFDckIsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLG1CQUFtQixFQUNoQyxnQkFBZ0IsQ0FBQyxZQUFZLENBQzlCLENBQUM7SUFFRixNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUV2Qyw0Q0FBNEM7SUFDNUMsTUFBTSxtQkFBbUIsR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7SUFFOUUsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO0lBRTdDLHFHQUFxRztJQUNyRyxtR0FBbUc7SUFDbkcsNEZBQTRGO0lBQzVGLElBQUksbUJBQW1CLEdBQXFCLEVBQUUsQ0FBQztJQUMvQyxJQUFJLGVBQWUsR0FBRyxDQUFDLEVBQUU7UUFDdkIsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLEdBQUcsWUFBWSxDQUFDLGNBQWMsQ0FDakUsT0FBTyxFQUNQLFFBQVEsQ0FDVCxDQUFDO1FBRUYsa0JBQWtCLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1FBRWxELG1CQUFtQixHQUFHO1lBQ3BCO2dCQUNFLEVBQUUsRUFBRSxXQUFXO2dCQUNmLE1BQU0sRUFBRTtvQkFDTixFQUFFLEVBQUUsTUFBTSxDQUFDLE9BQU87aUJBQ25CO2dCQUNELE1BQU0sRUFBRTtvQkFDTixFQUFFLEVBQUUsTUFBTSxDQUFDLE9BQU87aUJBQ25CO2dCQUNELE1BQU0sRUFBRSxLQUFLO2dCQUNiLE9BQU8sRUFBRSxLQUFLO2dCQUNkLFVBQVUsRUFBRSxLQUFLLEVBQUUscUNBQXFDO2FBQ3pEO1NBQ0YsQ0FBQztLQUNIO0lBRUQsTUFBTSxXQUFXLEdBQUcsdUJBQXVCLENBQUMsT0FBTyxDQUFFLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBRTVFLE1BQU0sdUJBQXVCLEdBR3pCLElBQUksR0FBRyxFQUFFLENBQUM7SUFDZCxNQUFNLHdCQUF3QixHQUcxQixJQUFJLEdBQUcsRUFBRSxDQUFDO0lBRWQsTUFBTSxVQUFVLEdBQUcsTUFBQSxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsbUNBQUksRUFBRSxDQUFDO0lBQ3BELE1BQU0sbUJBQW1CLEdBQWdCLElBQUksR0FBRyxFQUFFLENBQUM7SUFFbkQsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO1FBQzNCLE1BQU0sYUFBYSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFbEQsbUJBQW1CLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQ3ZDLHVCQUF1QixDQUFDLEdBQUcsQ0FDekIsYUFBYSxFQUNiLElBQUkseUJBQXlCLENBQWlCLEVBQUUsRUFBRSxxQkFBcUIsQ0FBQyxDQUN6RSxDQUFDO1FBQ0Ysd0JBQXdCLENBQUMsR0FBRyxDQUMxQixhQUFhLEVBQ2IsSUFBSSx5QkFBeUIsQ0FBaUIsRUFBRSxFQUFFLHFCQUFxQixDQUFDLENBQ3pFLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksOEJBQThCLEdBQUcsQ0FBQyxDQUFDO0lBQ3ZDLElBQUksK0JBQStCLEdBQUcsQ0FBQyxDQUFDO0lBRXhDLGdEQUFnRDtJQUNoRCxzRUFBc0U7SUFDdEUsSUFBSSxpQkFBaUIsR0FBRyxDQUFDLENBQUM7SUFDMUIsZ0RBQWdEO0lBQ2hELElBQ0UsUUFBUSxDQUFDLE1BQU0sSUFBSSxNQUFNO1FBQ3pCLFFBQVEsQ0FBQyxNQUFNLElBQUksT0FBTztRQUMxQixRQUFRLENBQUMsTUFBTSxJQUFJLEtBQUssRUFDeEI7UUFDQSw0RUFBNEU7UUFDNUUsaUJBQWlCLEdBQUcsQ0FBQyxDQUFDO0tBQ3ZCO0lBRUQsTUFBTSxzQkFBc0IsR0FBcUIsRUFBRSxDQUFDO0lBQ3BELE1BQU0sb0JBQW9CLEdBQXFCLEVBQUUsQ0FBQztJQUNsRCxNQUFNLHFCQUFxQixHQUFxQixFQUFFLENBQUM7SUFDbkQsTUFBTSxRQUFRLEdBQXFCLEVBQUUsQ0FBQztJQUV0Qyw0REFBNEQ7SUFDNUQsSUFBSSxxQkFBcUIsR0FBRyxDQUFDLENBQUM7SUFFOUIscUNBQXFDO0lBQ3JDLHlGQUF5RjtJQUN6RixLQUFLLE1BQU0sWUFBWSxJQUFJLG1CQUFtQixFQUFFO1FBQzlDLHFCQUFxQixJQUFJLENBQUMsQ0FBQztRQUMzQixxRUFBcUU7UUFDckUsSUFDRSw4QkFBOEIsSUFBSSxpQkFBaUI7WUFDbkQsK0JBQStCLElBQUksaUJBQWlCO1lBQ3BELHNCQUFzQixDQUFDLE1BQU0sSUFBSSxpQkFBaUI7WUFDbEQsUUFBUSxDQUFDLE1BQU0sSUFBSSxJQUFJO1lBQ3ZCLG9CQUFvQixDQUFDLE1BQU0sSUFBSSxjQUFjO1lBQzdDLHFCQUFxQixDQUFDLE1BQU0sSUFBSSxjQUFjLEVBQzlDO1lBQ0Esd0RBQXdEO1lBQ3hELE1BQU07U0FDUDtRQUVELElBQUksa0JBQWtCLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsRUFBRTtZQUMzQyw2Q0FBNkM7WUFDN0MsU0FBUztTQUNWO1FBRUQsTUFBTSxzQkFBc0IsR0FBRyx1QkFBdUIsQ0FBQyxHQUFHLENBQ3hELFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUN2QixDQUFDO1FBQ0YsSUFDRSw4QkFBOEIsR0FBRyxpQkFBaUI7WUFDbEQsc0JBQXNCO1lBQ3RCLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLGVBQWU7WUFDekMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksY0FBYyxFQUN4QztZQUNBLDhCQUE4QixJQUFJLENBQUMsQ0FBQztZQUNwQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ3hDLElBQUksb0JBQW9CLENBQUMsTUFBTSxHQUFHLGNBQWMsRUFBRTtnQkFDaEQsb0JBQW9CLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO2FBQ3pDO1lBQ0QsSUFDRSxTQUFTLEtBQUssU0FBUyxDQUFDLFlBQVk7Z0JBQ3BDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLFdBQVcsRUFDckM7Z0JBQ0Esc0JBQXNCLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO2FBQzNDO1lBQ0Qsc0JBQXNCLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUNoRCxTQUFTO1NBQ1Y7UUFFRCxNQUFNLHNCQUFzQixHQUFHLHVCQUF1QixDQUFDLEdBQUcsQ0FDeEQsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQ3ZCLENBQUM7UUFDRixJQUNFLDhCQUE4QixHQUFHLGlCQUFpQjtZQUNsRCxzQkFBc0I7WUFDdEIsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksY0FBYztZQUN4QyxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsSUFBSSxlQUFlLEVBQ3pDO1lBQ0EsOEJBQThCLElBQUksQ0FBQyxDQUFDO1lBQ3BDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDeEMsSUFBSSxvQkFBb0IsQ0FBQyxNQUFNLEdBQUcsY0FBYyxFQUFFO2dCQUNoRCxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7YUFDekM7WUFDRCxJQUNFLFNBQVMsS0FBSyxTQUFTLENBQUMsWUFBWTtnQkFDcEMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksV0FBVyxFQUNyQztnQkFDQSxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7YUFDM0M7WUFDRCxzQkFBc0IsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQ2hELFNBQVM7U0FDVjtRQUVELE1BQU0sdUJBQXVCLEdBQUcsd0JBQXdCLENBQUMsR0FBRyxDQUMxRCxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FDdkIsQ0FBQztRQUNGLElBQ0UsK0JBQStCLEdBQUcsaUJBQWlCO1lBQ25ELHVCQUF1QjtZQUN2QixZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsSUFBSSxjQUFjO1lBQ3hDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLGVBQWUsRUFDekM7WUFDQSwrQkFBK0IsSUFBSSxDQUFDLENBQUM7WUFDckMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUN4QyxJQUFJLHFCQUFxQixDQUFDLE1BQU0sR0FBRyxjQUFjLEVBQUU7Z0JBQ2pELHFCQUFxQixDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQzthQUMxQztZQUNELElBQ0UsU0FBUyxLQUFLLFNBQVMsQ0FBQyxXQUFXO2dCQUNuQyxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsSUFBSSxXQUFXLEVBQ3JDO2dCQUNBLHNCQUFzQixDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQzthQUMzQztZQUNELHVCQUF1QixDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDakQsU0FBUztTQUNWO1FBRUQsTUFBTSx1QkFBdUIsR0FBRyx3QkFBd0IsQ0FBQyxHQUFHLENBQzFELFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUN2QixDQUFDO1FBQ0YsSUFDRSwrQkFBK0IsR0FBRyxpQkFBaUI7WUFDbkQsdUJBQXVCO1lBQ3ZCLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLGVBQWU7WUFDekMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksY0FBYyxFQUN4QztZQUNBLCtCQUErQixJQUFJLENBQUMsQ0FBQztZQUNyQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ3hDLElBQUkscUJBQXFCLENBQUMsTUFBTSxHQUFHLGNBQWMsRUFBRTtnQkFDakQscUJBQXFCLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO2FBQzFDO1lBQ0QsSUFDRSxTQUFTLEtBQUssU0FBUyxDQUFDLFdBQVc7Z0JBQ25DLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLFdBQVcsRUFDckM7Z0JBQ0Esc0JBQXNCLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO2FBQzNDO1lBQ0QsdUJBQXVCLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUNqRCxTQUFTO1NBQ1Y7UUFFRCw0RUFBNEU7UUFDNUUsSUFDRSxzQkFBc0IsQ0FBQyxNQUFNLEdBQUcsaUJBQWlCO1lBQ2pELENBQUMsQ0FBQyxTQUFTLEtBQUssU0FBUyxDQUFDLFdBQVc7Z0JBQ25DLENBQUMsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsSUFBSSxXQUFXO29CQUNyQyxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsSUFBSSxlQUFlLENBQUM7b0JBQzFDLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksV0FBVzt3QkFDcEMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksZUFBZSxDQUFDLENBQUMsQ0FBQztnQkFDaEQsQ0FBQyxTQUFTLEtBQUssU0FBUyxDQUFDLFlBQVk7b0JBQ25DLENBQUMsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsSUFBSSxXQUFXO3dCQUNyQyxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsSUFBSSxjQUFjLENBQUM7d0JBQ3pDLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksV0FBVzs0QkFDcEMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQ3BEO1lBQ0Esa0JBQWtCLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUN4QyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDMUMsU0FBUztTQUNWO1FBRUQsSUFBSSxRQUFRLENBQUMsTUFBTSxHQUFHLElBQUksRUFBRTtZQUMxQixrQkFBa0IsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ3hDLFFBQVEsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDNUIsU0FBUztTQUNWO1FBRUQsSUFDRSxvQkFBb0IsQ0FBQyxNQUFNLEdBQUcsY0FBYztZQUM1QyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLGNBQWM7Z0JBQ3ZDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLGNBQWMsQ0FBQyxFQUMzQztZQUNBLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDeEMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQ3hDLFNBQVM7U0FDVjtRQUVELElBQ0UscUJBQXFCLENBQUMsTUFBTSxHQUFHLGNBQWM7WUFDN0MsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsSUFBSSxlQUFlO2dCQUN4QyxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsSUFBSSxlQUFlLENBQUMsRUFDNUM7WUFDQSxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ3hDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUN6QyxTQUFTO1NBQ1Y7S0FDRjtJQUVELE1BQU0sQ0FBQyxTQUFTLENBQ2QsaUNBQWlDLEVBQ2pDLHFCQUFxQixFQUNyQixnQkFBZ0IsQ0FBQyxLQUFLLENBQ3ZCLENBQUM7SUFFRixNQUFNLG9CQUFvQixHQUFxQixFQUFFLENBQUM7SUFDbEQsS0FBSyxNQUFNLDZCQUE2QixJQUFJLHVCQUF1QixDQUFDLE1BQU0sRUFBRSxFQUFFO1FBQzVFLG9CQUFvQixDQUFDLElBQUksQ0FBQyxHQUFHLDZCQUE2QixDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ25FO0lBRUQsTUFBTSxxQkFBcUIsR0FBcUIsRUFBRSxDQUFDO0lBQ25ELEtBQUssTUFBTSw4QkFBOEIsSUFBSSx3QkFBd0IsQ0FBQyxNQUFNLEVBQUUsRUFBRTtRQUM5RSxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsR0FBRyw4QkFBOEIsQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUNyRTtJQUVELGlDQUFpQztJQUNqQyxNQUFNLGlDQUFpQyxHQUduQyxJQUFJLEdBQUcsRUFBRSxDQUFDO0lBQ2QsTUFBTSxrQ0FBa0MsR0FHcEMsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUNkLE1BQU0seUJBQXlCLEdBQUcsb0JBQW9CO1NBQ25ELE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFO1FBQ2Ysd0JBQXdCO1FBQ3hCLElBQUksY0FBYyxLQUFLLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFO1lBQ3JDLE9BQU8sQ0FBQyxDQUFBLHlCQUF5QixhQUF6Qix5QkFBeUIsdUJBQXpCLHlCQUF5QixDQUFFLFFBQVEsQ0FDekMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsV0FBVyxFQUFFLENBQzdCLENBQUEsQ0FBQztTQUNIO2FBQU07WUFDTCxPQUFPLENBQUMsQ0FBQSx5QkFBeUIsYUFBekIseUJBQXlCLHVCQUF6Qix5QkFBeUIsQ0FBRSxRQUFRLENBQ3pDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUM3QixDQUFBLENBQUM7U0FDSDtJQUNILENBQUMsQ0FBQztTQUNELEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQ1osY0FBYyxLQUFLLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQ3BFLENBQUM7SUFDSixNQUFNLDBCQUEwQixHQUFHLHFCQUFxQjtTQUNyRCxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtRQUNmLHdCQUF3QjtRQUN4QixJQUFJLGVBQWUsS0FBSyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRTtZQUN0QyxPQUFPLENBQUMsQ0FBQSx5QkFBeUIsYUFBekIseUJBQXlCLHVCQUF6Qix5QkFBeUIsQ0FBRSxRQUFRLENBQ3pDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUM3QixDQUFBLENBQUM7U0FDSDthQUFNO1lBQ0wsT0FBTyxDQUFDLENBQUEseUJBQXlCLGFBQXpCLHlCQUF5Qix1QkFBekIseUJBQXlCLENBQUUsUUFBUSxDQUN6QyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxXQUFXLEVBQUUsQ0FDN0IsQ0FBQSxDQUFDO1NBQ0g7SUFDSCxDQUFDLENBQUM7U0FDRCxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUNaLGVBQWUsS0FBSyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUNyRSxDQUFDO0lBRUosS0FBSyxNQUFNLFdBQVcsSUFBSSx5QkFBeUIsRUFBRTtRQUNuRCxpQ0FBaUMsQ0FBQyxHQUFHLENBQ25DLFdBQVcsRUFDWCxJQUFJLHlCQUF5QixDQUFpQixFQUFFLEVBQUUsYUFBYSxDQUFDLENBQ2pFLENBQUM7S0FDSDtJQUNELEtBQUssTUFBTSxXQUFXLElBQUksMEJBQTBCLEVBQUU7UUFDcEQsa0NBQWtDLENBQUMsR0FBRyxDQUNwQyxXQUFXLEVBQ1gsSUFBSSx5QkFBeUIsQ0FBaUIsRUFBRSxFQUFFLGFBQWEsQ0FBQyxDQUNqRSxDQUFDO0tBQ0g7SUFFRCw2REFBNkQ7SUFDN0QsSUFBSSxzQkFBc0IsR0FBRyxDQUFDLENBQUM7SUFFL0IsSUFDRSx5QkFBeUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQztRQUNwQywwQkFBMEIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUNyQztRQUNBLEtBQUssTUFBTSxZQUFZLElBQUksbUJBQW1CLEVBQUU7WUFDOUMsc0JBQXNCLElBQUksQ0FBQyxDQUFDO1lBRTVCLElBQUksaUNBQWlDLEdBQUcsSUFBSSxDQUFDO1lBQzdDLEtBQUssTUFBTSxjQUFjLElBQUksaUNBQWlDLENBQUMsTUFBTSxFQUFFLEVBQUU7Z0JBQ3ZFLElBQUksQ0FBQyxjQUFjLENBQUMsY0FBYyxFQUFFLEVBQUU7b0JBQ3BDLGlDQUFpQyxHQUFHLEtBQUssQ0FBQztvQkFDMUMsTUFBTTtpQkFDUDthQUNGO1lBRUQsSUFBSSxrQ0FBa0MsR0FBRyxJQUFJLENBQUM7WUFDOUMsS0FBSyxNQUFNLGNBQWMsSUFBSSxrQ0FBa0MsQ0FBQyxNQUFNLEVBQUUsRUFBRTtnQkFDeEUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxjQUFjLEVBQUUsRUFBRTtvQkFDcEMsa0NBQWtDLEdBQUcsS0FBSyxDQUFDO29CQUMzQyxNQUFNO2lCQUNQO2FBQ0Y7WUFFRCxJQUNFLGlDQUFpQztnQkFDakMsa0NBQWtDLEVBQ2xDO2dCQUNBLHdEQUF3RDtnQkFDeEQsTUFBTTthQUNQO1lBRUQsSUFBSSxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxFQUFFO2dCQUMzQyxTQUFTO2FBQ1Y7WUFFRCxNQUFNLHNCQUFzQixHQUFHLGlDQUFpQyxDQUFDLEdBQUcsQ0FDbEUsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQ3ZCLENBQUM7WUFFRixJQUFJLHNCQUFzQixJQUFJLENBQUMsc0JBQXNCLENBQUMsY0FBYyxFQUFFLEVBQUU7Z0JBQ3RFLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ3hDLHNCQUFzQixDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBQ2hELFNBQVM7YUFDVjtZQUVELE1BQU0sc0JBQXNCLEdBQUcsaUNBQWlDLENBQUMsR0FBRyxDQUNsRSxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FDdkIsQ0FBQztZQUVGLElBQUksc0JBQXNCLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxjQUFjLEVBQUUsRUFBRTtnQkFDdEUsa0JBQWtCLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDeEMsc0JBQXNCLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztnQkFDaEQsU0FBUzthQUNWO1lBRUQsTUFBTSx1QkFBdUIsR0FBRyxrQ0FBa0MsQ0FBQyxHQUFHLENBQ3BFLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUN2QixDQUFDO1lBRUYsSUFDRSx1QkFBdUI7Z0JBQ3ZCLENBQUMsdUJBQXVCLENBQUMsY0FBYyxFQUFFLEVBQ3pDO2dCQUNBLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ3hDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBQ2pELFNBQVM7YUFDVjtZQUVELE1BQU0sdUJBQXVCLEdBQUcsa0NBQWtDLENBQUMsR0FBRyxDQUNwRSxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FDdkIsQ0FBQztZQUVGLElBQ0UsdUJBQXVCO2dCQUN2QixDQUFDLHVCQUF1QixDQUFDLGNBQWMsRUFBRSxFQUN6QztnQkFDQSxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUN4Qyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUNqRCxTQUFTO2FBQ1Y7U0FDRjtLQUNGO0lBRUQsTUFBTSxDQUFDLFNBQVMsQ0FDZCxrQ0FBa0MsRUFDbEMsc0JBQXNCLEVBQ3RCLGdCQUFnQixDQUFDLEtBQUssQ0FDdkIsQ0FBQztJQUVGLE1BQU0sOEJBQThCLEdBQXFCLEVBQUUsQ0FBQztJQUM1RCxLQUFLLE1BQU0sY0FBYyxJQUFJLGlDQUFpQyxDQUFDLE1BQU0sRUFBRSxFQUFFO1FBQ3ZFLDhCQUE4QixDQUFDLElBQUksQ0FBQyxHQUFHLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUM5RDtJQUVELE1BQU0sK0JBQStCLEdBQXFCLEVBQUUsQ0FBQztJQUM3RCxLQUFLLE1BQU0sY0FBYyxJQUFJLGtDQUFrQyxDQUFDLE1BQU0sRUFBRSxFQUFFO1FBQ3hFLCtCQUErQixDQUFDLElBQUksQ0FBQyxHQUFHLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUMvRDtJQUVELE1BQU0sYUFBYSxHQUFHLENBQUMsQ0FBQztRQUN0QixHQUFHLG9CQUFvQjtRQUN2QixHQUFHLHFCQUFxQjtRQUN4QixHQUFHLG1CQUFtQjtRQUN0QixHQUFHLHNCQUFzQjtRQUN6QixHQUFHLFFBQVE7UUFDWCxHQUFHLG9CQUFvQjtRQUN2QixHQUFHLHFCQUFxQjtRQUN4QixHQUFHLDhCQUE4QjtRQUNqQyxHQUFHLCtCQUErQjtLQUNuQyxDQUFDO1NBQ0MsTUFBTSxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1NBQ3pCLEtBQUssRUFBRSxDQUFDO0lBRVgsTUFBTSxpQkFBaUIsR0FBZ0IsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUNqRCxLQUFLLE1BQU0sSUFBSSxJQUFJLGFBQWEsRUFBRTtRQUNoQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUN0QyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztLQUN2QztJQUNELE1BQU0sY0FBYyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUVyRCxHQUFHLENBQUMsSUFBSSxDQUNOLGVBQWUsY0FBYyxDQUFDLE1BQU0sc0JBQXNCLGFBQWEsQ0FBQyxNQUFNLDhCQUE4QixDQUM3RyxDQUFDO0lBRUYsTUFBTSxDQUFDLFNBQVMsQ0FDZCxtQkFBbUIsRUFDbkIsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLG1CQUFtQixFQUNoQyxnQkFBZ0IsQ0FBQyxZQUFZLENBQzlCLENBQUM7SUFFRixNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7SUFFbkMsZ0NBQWdDO0lBQ2hDLE1BQU0sYUFBYSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQ3pCLGFBQWEsRUFDYixHQUFHLEVBQUU7UUFDSCxvQ0FBb0M7UUFDcEMsT0FBTyxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztJQUM3QixDQUFDLENBQ0YsQ0FBQztJQUNGLE1BQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7SUFFNUMsTUFBTSxZQUFZLEdBQUcsTUFBTSxZQUFZLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxhQUFhLENBQUMsQ0FBQztJQUU1RSxNQUFNLENBQUMsU0FBUyxDQUNkLGFBQWEsRUFDYixJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsZUFBZSxFQUM1QixnQkFBZ0IsQ0FBQyxZQUFZLENBQzlCLENBQUM7SUFFRixNQUFNLGdCQUFnQixHQUFzQztRQUMxRCxRQUFRLEVBQUUsUUFBUSxDQUFDLEVBQUU7UUFDckIsVUFBVSxFQUFFO1lBQ1Ysb0JBQW9CO1lBQ3BCLHFCQUFxQjtZQUNyQixtQkFBbUI7WUFDbkIsc0JBQXNCO1lBQ3RCLFFBQVE7WUFDUixvQkFBb0I7WUFDcEIscUJBQXFCO1lBQ3JCLDhCQUE4QjtZQUM5QiwrQkFBK0I7U0FDaEM7S0FDRixDQUFDO0lBRUYsT0FBTyxFQUFFLFlBQVksRUFBRSxjQUFjLEVBQUUsZ0JBQWdCLEVBQUUsYUFBYSxFQUFFLENBQUM7QUFDM0UsQ0FBQztBQVNELE1BQU0sQ0FBQyxLQUFLLFVBQVUsMkJBQTJCLENBQUMsRUFDaEQsZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQixtQkFBbUIsRUFDbkIsYUFBYSxFQUNiLGNBQWMsRUFDZCxjQUFjLEdBQ29CO0lBQ2xDLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQ3ZDLE1BQU0sQ0FDSixFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsY0FBYyxFQUFFLGdCQUFnQixFQUFFLEVBQ3BFLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBRSxjQUFjLEVBQUUsZ0JBQWdCLEVBQUUsRUFDckUsR0FBRyxDQUFDLGdCQUFnQixFQUFFLGdCQUFnQixDQUFDLENBQUM7SUFFekMseUZBQXlGO0lBQ3pGLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNyRCxlQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsbUJBQW1CLENBQUMsT0FBTyxDQUFDLENBQUM7SUFFckQsTUFBTSxDQUFDLFNBQVMsQ0FDZCx3QkFBd0IsRUFDeEIsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLG1CQUFtQixFQUNoQyxnQkFBZ0IsQ0FBQyxZQUFZLENBQzlCLENBQUM7SUFDRixNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUV2Qzs7Ozs7T0FLRztJQUNILGdGQUFnRjtJQUNoRiwyRkFBMkY7SUFDM0YsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLEdBQUcsQ0FDL0I7UUFDRSxHQUFHLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxvQkFBb0I7UUFDbkQsR0FBRyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsb0JBQW9CO1FBQ25ELGFBQWE7UUFDYixHQUFHLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxxQkFBcUI7UUFDcEQsR0FBRyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMscUJBQXFCO1FBQ3BELGdCQUFnQjtRQUNoQixHQUFHLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxtQkFBbUI7UUFDbEQsc0RBQXNEO1FBQ3RELEdBQUcsbUJBQW1CLENBQUMsT0FBTztLQUMvQixDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUM3QixDQUFDO0lBRUYsTUFBTSxxQkFBcUIsR0FBRyxDQUFDLENBQUMsZUFBZSxDQUFDO1NBQzdDLE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztTQUNoRCxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQztTQUNsQyxLQUFLLEVBQUUsQ0FBQztJQUVYLDhFQUE4RTtJQUM5RSxNQUFNLGFBQWEsR0FBRyxDQUFDLENBQUMsZUFBZSxDQUFDO1NBQ3JDLE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO1NBQzlCLEtBQUssRUFBRSxDQUFDO0lBRVgsaUdBQWlHO0lBQ2pHLE1BQU0sWUFBWSxHQUFxQixFQUFFLENBQUM7SUFDMUMscUJBQXFCLENBQUMsT0FBTyxDQUFDLENBQUMsY0FBYyxFQUFFLEVBQUU7UUFDL0MsTUFBTSxjQUFjLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FDdkMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUNQLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksY0FBYyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ3pDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLGNBQWMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1lBQzdDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksY0FBYyxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUN6QyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsSUFBSSxjQUFjLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUNoRCxDQUFDO1FBRUYsSUFBSSxjQUFjLEVBQUU7WUFDbEIsSUFBSSxjQUFjLENBQUMsVUFBVSxHQUFHLGNBQWMsQ0FBQyxNQUFNLEVBQUU7Z0JBQ3JELEdBQUcsQ0FBQyxJQUFJLENBQ047b0JBQ0UsTUFBTSxFQUFFLGNBQWMsQ0FBQyxNQUFNLENBQUMsRUFBRTtvQkFDaEMsTUFBTSxFQUFFLGNBQWMsQ0FBQyxNQUFNLENBQUMsRUFBRTtvQkFDaEMsWUFBWSxFQUFFLGNBQWMsQ0FBQyxVQUFVO29CQUN2QyxRQUFRLEVBQUUsY0FBYyxDQUFDLE1BQU07aUJBQ2hDLEVBQ0QscUZBQXFGLENBQ3RGLENBQUM7Z0JBQ0YsWUFBWSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQzthQUNuQztTQUNGO2FBQU07WUFDTCxHQUFHLENBQUMsSUFBSSxDQUNOO2dCQUNFLE1BQU0sRUFBRSxjQUFjLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQ2hDLE1BQU0sRUFBRSxjQUFjLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQ2hDLFlBQVksRUFBRSxjQUFjLENBQUMsVUFBVTthQUN4QyxFQUNELDhEQUE4RCxDQUMvRCxDQUFDO1lBQ0YsWUFBWSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztTQUNuQztJQUNILENBQUMsQ0FBQyxDQUFDO0lBRUgsR0FBRyxDQUFDLElBQUksQ0FDTixZQUFZLENBQUMsTUFBTSxFQUNuQix1REFBdUQsQ0FDeEQsQ0FBQztJQUVGLE1BQU0sYUFBYSxHQUEyQztRQUM1RCxHQUFHLFlBQVk7UUFDZixHQUFHLGFBQWE7S0FDakIsQ0FBQztJQUVGLE1BQU0sY0FBYyxHQUFHLENBQUMsQ0FBQyxhQUFhLENBQUM7U0FDcEMsT0FBTyxDQUFDLENBQUMsWUFBWSxFQUFFLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7U0FDM0UsT0FBTyxFQUFFO1NBQ1QsSUFBSSxFQUFFO1NBQ04sS0FBSyxFQUFFLENBQUM7SUFFWCxHQUFHLENBQUMsSUFBSSxDQUNOLGVBQWUsY0FBYyxDQUFDLE1BQU0sc0JBQXNCLGFBQWEsQ0FBQyxNQUFNLDJCQUEyQixDQUMxRyxDQUFDO0lBRUYsTUFBTSxDQUFDLFNBQVMsQ0FDZCxzQkFBc0IsRUFDdEIsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLG1CQUFtQixFQUNoQyxnQkFBZ0IsQ0FBQyxZQUFZLENBQzlCLENBQUM7SUFFRixNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7SUFFbkMsc0dBQXNHO0lBQ3RHLE1BQU0sWUFBWSxHQUFHLGFBQWE7U0FDL0IsTUFBTSxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDO1NBQ25DLEdBQUcsQ0FBQyxDQUFDLElBQVMsRUFBRSxFQUFFO1FBQ2pCLElBQUksR0FBYyxDQUFDO1FBQ25CLElBQUk7WUFDRixHQUFHLEdBQUcsY0FBYyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztTQUNwQztRQUFDLFdBQU07WUFDTixPQUFPLFNBQVMsQ0FBQztTQUNsQjtRQUNELE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUE4QixDQUFDO0lBQ3RFLENBQUMsQ0FBQztTQUNELE1BQU0sQ0FBQyxPQUFPLENBQWdDLENBQUM7SUFFbEQsTUFBTSxZQUFZLEdBQUcsYUFBYTtTQUMvQixNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLENBQUM7U0FDdEMsR0FBRyxDQUFDLENBQUMsSUFBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBbUIsQ0FBQztTQUNoRSxNQUFNLENBQUMsT0FBTyxDQUFxQixDQUFDO0lBRXZDLE1BQU0sQ0FBQyxjQUFjLEVBQUUsY0FBYyxDQUFDLEdBQUcsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDO1FBQ3pELGNBQWMsQ0FBQyxRQUFRLENBQUMsWUFBWSxFQUFFLGFBQWEsQ0FBQztRQUNwRCxjQUFjLENBQUMsUUFBUSxDQUFDLFlBQVksRUFBRSxhQUFhLENBQUM7S0FDckQsQ0FBQyxDQUFDO0lBRUgsTUFBTSxDQUFDLFNBQVMsQ0FDZCxnQkFBZ0IsRUFDaEIsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLGVBQWUsRUFDNUIsZ0JBQWdCLENBQUMsWUFBWSxDQUM5QixDQUFDO0lBRUYsa0hBQWtIO0lBQ2xILHdGQUF3RjtJQUN4RixNQUFNLHFCQUFxQixHQUFHLENBQUMsR0FBbUMsRUFBRSxFQUFFO1FBQ3BFLE9BQU87WUFDTCxHQUFHLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUM5QixnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FDcEU7WUFDRCxHQUFHLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUM7U0FDcEMsQ0FBQztJQUNKLENBQUMsQ0FBQztJQUVGLE1BQU0sZ0JBQWdCLEdBQXNDO1FBQzFELFFBQVEsRUFBRSxRQUFRLENBQUMsS0FBSztRQUN4QixVQUFVLEVBQUU7WUFDVixvQkFBb0IsRUFBRSxxQkFBcUIsQ0FBQyxzQkFBc0IsQ0FBQztZQUNuRSxxQkFBcUIsRUFBRSxxQkFBcUIsQ0FBQyx1QkFBdUIsQ0FBQztZQUNyRSxtQkFBbUIsRUFBRSxxQkFBcUIsQ0FBQyxxQkFBcUIsQ0FBQztZQUNqRSxzQkFBc0IsRUFBRSxxQkFBcUIsQ0FBQyx3QkFBd0IsQ0FBQztZQUN2RSxRQUFRLEVBQUUscUJBQXFCLENBQUMsVUFBVSxDQUFDO1lBQzNDLG9CQUFvQixFQUFFLHFCQUFxQixDQUFDLHNCQUFzQixDQUFDO1lBQ25FLHFCQUFxQixFQUFFLHFCQUFxQixDQUFDLHVCQUF1QixDQUFDO1lBQ3JFLDhCQUE4QixFQUFFLHFCQUFxQixDQUNuRCxnQ0FBZ0MsQ0FDakM7WUFDRCwrQkFBK0IsRUFBRSxxQkFBcUIsQ0FDcEQsaUNBQWlDLENBQ2xDO1NBQ0Y7S0FDRixDQUFDO0lBRUYsT0FBTztRQUNMLGNBQWM7UUFDZCxjQUFjO1FBQ2QsY0FBYyxFQUFFLGdCQUFnQjtRQUNoQyxhQUFhO0tBQ2QsQ0FBQztBQUNKLENBQUMifQ==