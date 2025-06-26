import { Protocol } from '@surge/router-sdk';
import { Token } from '@surge/sdk-core';
import { SupportedRoutes } from '../../../../routers';
interface CachedRouteParams<Route extends SupportedRoutes> {
    route: Route;
    percent: number;
}
/**
 * Class defining the route to cache
 *
 * @export
 * @class CachedRoute
 */
export declare class CachedRoute<Route extends SupportedRoutes> {
    readonly route: Route;
    readonly percent: number;
    private hashCode;
    /**
     * @param route
     * @param percent
     */
    constructor({ route, percent }: CachedRouteParams<Route>);
    get protocol(): Protocol;
    get tokenIn(): Token;
    get tokenOut(): Token;
    get routePath(): string;
    get routeId(): number;
}
export {};
