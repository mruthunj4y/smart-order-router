import { Protocol } from '@surge/router-sdk';
import { ChainId, Token, TradeType } from '@surge/sdk-core';
import { IV2SubgraphProvider, V2SubgraphPool } from '../../../providers';
import { IV2PoolProvider, V2PoolAccessor } from '../../../providers/v2/pool-provider';
import { IV3PoolProvider, V3PoolAccessor } from '../../../providers/v3/pool-provider';
import { IV3SubgraphProvider, V3SubgraphPool } from '../../../providers/v3/subgraph-provider';
import { AlphaRouterConfig } from '../alpha-router';
export type SubgraphPool = V2SubgraphPool | V3SubgraphPool;
export type CandidatePoolsBySelectionCriteria = {
    protocol: Protocol;
    selections: CandidatePoolsSelections;
};
export type SupportedCandidatePools = V2CandidatePools | V3CandidatePools;
export type CandidatePoolsSelections = {
    topByBaseWithTokenIn: SubgraphPool[];
    topByBaseWithTokenOut: SubgraphPool[];
    topByDirectSwapPool: SubgraphPool[];
    topByEthQuoteTokenPool: SubgraphPool[];
    topByTVL: SubgraphPool[];
    topByTVLUsingTokenIn: SubgraphPool[];
    topByTVLUsingTokenOut: SubgraphPool[];
    topByTVLUsingTokenInSecondHops: SubgraphPool[];
    topByTVLUsingTokenOutSecondHops: SubgraphPool[];
};
export type V2CandidatePools = {
    poolAccessor: V2PoolAccessor;
    candidatePools: CandidatePoolsBySelectionCriteria;
    subgraphPools: V2SubgraphPool[];
};
export type MixedCrossLiquidityCandidatePoolsParams = {
    tokenIn: Token;
    tokenOut: Token;
    v2SubgraphProvider: IV2SubgraphProvider;
    v3SubgraphProvider: IV3SubgraphProvider;
    v2Candidates?: V2CandidatePools;
    v3Candidates?: V3CandidatePools;
    blockNumber?: number | Promise<number>;
};
export type V3GetCandidatePoolsParams = {
    tokenIn: Token;
    tokenOut: Token;
    routeType: TradeType;
    routingConfig: AlphaRouterConfig;
    subgraphProvider: IV3SubgraphProvider;
    poolProvider: IV3PoolProvider;
    chainId: ChainId;
};
export type V2GetCandidatePoolsParams = {
    tokenIn: Token;
    tokenOut: Token;
    routeType: TradeType;
    routingConfig: AlphaRouterConfig;
    subgraphProvider: IV2SubgraphProvider;
    poolProvider: IV2PoolProvider;
    chainId: ChainId;
};
export type MixedRouteGetCandidatePoolsParams = {
    v3CandidatePools: V3CandidatePools;
    v2CandidatePools: V2CandidatePools;
    crossLiquidityPools: CrossLiquidityCandidatePools;
    routingConfig: AlphaRouterConfig;
    v2poolProvider: IV2PoolProvider;
    v3poolProvider: IV3PoolProvider;
    chainId: ChainId;
};
export type CrossLiquidityCandidatePools = {
    v2Pools: V2SubgraphPool[];
    v3Pools: V3SubgraphPool[];
};
/**
 * Function that finds any missing pools that were not selected by the heuristic but that would
 *   create a route with the topPool by TVL with either tokenIn or tokenOut across protocols.
 *
 *   e.g. In V2CandidatePools we found that wstETH/DOG is the most liquid pool,
 *        then in V3CandidatePools ETH/wstETH is *not* the most liquid pool, so it is not selected
 *        This process will look for that pool in order to complete the route.
 *
 */
export declare function getMixedCrossLiquidityCandidatePools({ tokenIn, tokenOut, blockNumber, v2SubgraphProvider, v3SubgraphProvider, v2Candidates, v3Candidates, }: MixedCrossLiquidityCandidatePoolsParams): Promise<CrossLiquidityCandidatePools>;
export declare function getV3CandidatePools({ tokenIn, tokenOut, routeType, routingConfig, subgraphProvider, poolProvider, chainId, }: V3GetCandidatePoolsParams): Promise<V3CandidatePools>;
export type V3CandidatePools = {
    poolAccessor: V3PoolAccessor;
    candidatePools: CandidatePoolsBySelectionCriteria;
    subgraphPools: V3SubgraphPool[];
};
export declare function getV2CandidatePools({ tokenIn, tokenOut, routeType, routingConfig, subgraphProvider, poolProvider, chainId, }: V2GetCandidatePoolsParams): Promise<V2CandidatePools>;
export type MixedCandidatePools = {
    V2poolAccessor: V2PoolAccessor;
    V3poolAccessor: V3PoolAccessor;
    candidatePools: CandidatePoolsBySelectionCriteria;
    subgraphPools: SubgraphPool[];
};
export declare function getMixedRouteCandidatePools({ v3CandidatePools, v2CandidatePools, crossLiquidityPools, routingConfig, v2poolProvider, v3poolProvider, }: MixedRouteGetCandidatePoolsParams): Promise<MixedCandidatePools>;
