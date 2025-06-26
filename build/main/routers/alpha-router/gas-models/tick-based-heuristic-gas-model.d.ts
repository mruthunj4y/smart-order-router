import { BigNumber } from '@ethersproject/bignumber';
import { BaseProvider } from '@ethersproject/providers';
import { ChainId } from '@surge/sdk-core';
import { V3RouteWithValidQuote } from '../entities';
import { BuildOnChainGasModelFactoryType, GasModelProviderConfig, IGasModel, IOnChainGasModelFactory } from './gas-model';
export declare abstract class TickBasedHeuristicGasModelFactory<TRouteWithValidQuote extends V3RouteWithValidQuote> extends IOnChainGasModelFactory<TRouteWithValidQuote> {
    protected provider: BaseProvider;
    protected constructor(provider: BaseProvider);
    protected buildGasModelInternal({ chainId, gasPriceWei, pools, amountToken, quoteToken, providerConfig, }: BuildOnChainGasModelFactoryType): Promise<IGasModel<TRouteWithValidQuote>>;
    protected estimateGas(routeWithValidQuote: TRouteWithValidQuote, gasPriceWei: BigNumber, chainId: ChainId, providerConfig?: GasModelProviderConfig): {
        totalGasCostNativeCurrency: import("@surge/sdk-core").CurrencyAmount<import("@surge/sdk-core").Token>;
        totalInitializedTicksCrossed: number;
        baseGasUse: BigNumber;
    };
}
