import { Protocol } from '@surge/router-sdk';
import { ChainId, Currency, Token } from '@surge/sdk-core';
import { SubgraphPool } from '../routers/alpha-router/functions/get-candidate-pools';
import { ProviderConfig } from './provider';
export interface ISubgraphProvider<TSubgraphPool extends SubgraphPool> {
    getPools(tokenIn?: Token, tokenOut?: Token, providerConfig?: ProviderConfig): Promise<TSubgraphPool[]>;
}
type V3SubgraphPool = {
    id: string;
    feeTier: string;
    liquidity: string;
    token0: {
        id: string;
    };
    token1: {
        id: string;
    };
    tvlETH: number;
    tvlUSD: number;
};
type V3RawSubgraphPool = {
    id: string;
    feeTier: string;
    liquidity: string;
    token0: {
        symbol: string;
        id: string;
    };
    token1: {
        symbol: string;
        id: string;
    };
    totalValueLockedUSD: string;
    totalValueLockedETH: string;
    totalValueLockedUSDUntracked: string;
};
export declare abstract class SubgraphProvider<TRawSubgraphPool extends V3RawSubgraphPool, TSubgraphPool extends V3SubgraphPool> {
    private protocol;
    private chainId;
    private retries;
    private timeout;
    private rollback;
    private trackedEthThreshold;
    private untrackedUsdThreshold;
    private subgraphUrl?;
    private client;
    constructor(protocol: Protocol, chainId: ChainId, retries?: number, timeout?: number, rollback?: boolean, trackedEthThreshold?: number, untrackedUsdThreshold?: number, subgraphUrl?: string | undefined);
    getPools(_currencyIn?: Currency, _currencyOut?: Currency, providerConfig?: ProviderConfig): Promise<TSubgraphPool[]>;
    protected abstract subgraphQuery(blockNumber?: number): string;
    protected abstract mapSubgraphPool(rawSubgraphPool: TRawSubgraphPool): TSubgraphPool;
}
export {};
