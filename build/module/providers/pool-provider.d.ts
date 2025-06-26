import { BigNumber } from '@ethersproject/bignumber';
import { ChainId, Currency } from '@surge/sdk-core';
import { Pool as V3Pool } from '@surge/v3-sdk';
import { Options as RetryOptions } from 'async-retry';
import { IMulticallProvider, Result } from './multicall-provider';
import { ProviderConfig } from './provider';
export type PoolConstruct<TCurrency extends Currency> = [
    TCurrency,
    TCurrency,
    ...Array<string | number>
];
export type Pool = V3Pool;
export type ISlot0 = {
    sqrtPriceX96: BigNumber;
    tick: number;
};
export type ILiquidity = {
    liquidity: BigNumber;
};
export declare abstract class PoolProvider<TCurrency extends Currency, TPoolConstruct extends PoolConstruct<TCurrency>, TISlot0 extends ISlot0, TILiquidity extends ILiquidity, TPoolAccessor> {
    protected chainId: ChainId;
    protected multicall2Provider: IMulticallProvider;
    protected retryOptions: RetryOptions;
    /**
     * @param chainId The chain id to use.
     * @param multicall2Provider The multicall provider to use to get the pools.
     * @param retryOptions The retry options for each call to the multicall.
     */
    constructor(chainId: ChainId, multicall2Provider: IMulticallProvider, retryOptions?: RetryOptions);
    protected getPoolsInternal(poolConstructs: TPoolConstruct[], providerConfig?: ProviderConfig): Promise<TPoolAccessor>;
    protected abstract getLiquidityFunctionName(): string;
    protected abstract getSlot0FunctionName(): string;
    protected abstract getPoolsData<TReturn>(poolIdentifiers: string[], functionName: string, providerConfig?: ProviderConfig): Promise<Result<TReturn>[]>;
    protected abstract getPoolIdentifier(pool: TPoolConstruct): {
        poolIdentifier: string;
        currency0: TCurrency;
        currency1: TCurrency;
    };
    protected abstract instantiatePool(pool: TPoolConstruct, slot0: TISlot0, liquidity: TILiquidity): Pool;
    protected abstract instantiatePoolAccessor(poolIdentifierToPool: {
        [poolId: string]: Pool;
    }): TPoolAccessor;
}
