import { Currency, Token } from '@surge/sdk-core';
import { Pair } from '@surge/v2-sdk';
import { Pool as V3Pool } from '@surge/v3-sdk';
import { TPool } from '../../../util/routes';
import { MixedRoute, SupportedRoutes, V2Route, V3Route } from '../../router';
export declare function computeAllV3Routes(tokenIn: Token, tokenOut: Token, pools: V3Pool[], maxHops: number): V3Route[];
export declare function computeAllV2Routes(tokenIn: Token, tokenOut: Token, pools: Pair[], maxHops: number): V2Route[];
export declare function computeAllMixedRoutes(currencyIn: Currency, currencyOut: Currency, parts: TPool[], maxHops: number): MixedRoute[];
export declare function computeAllRoutes<TypePool extends TPool, TRoute extends SupportedRoutes, TCurrency extends Currency>(tokenIn: TCurrency, tokenOut: TCurrency, buildRoute: (route: TypePool[], tokenIn: TCurrency, tokenOut: TCurrency) => TRoute, involvesToken: (pool: TypePool, token: TCurrency) => boolean, pools: TypePool[], maxHops: number): TRoute[];
