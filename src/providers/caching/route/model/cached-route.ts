import { Protocol } from '@surge/router-sdk';
import { Token } from '@surge/sdk-core';
import { Pair } from '@surge/v2-sdk';
import { Pool as V3Pool } from '@surge/v3-sdk';

import {
  MixedRoute,
  SupportedRoutes,
  V2Route,
  V3Route,
} from '../../../../routers';

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
export class CachedRoute<Route extends SupportedRoutes> {
  public readonly route: Route;
  public readonly percent: number;
  // Hashing function copying the same implementation as Java's `hashCode`
  // Sourced from: https://gist.github.com/hyamamoto/fd435505d29ebfa3d9716fd2be8d42f0?permalink_comment_id=4613539#gistcomment-4613539
  private hashCode = (str: string) =>
    [...str].reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0);

  /**
   * @param route
   * @param percent
   */
  constructor({ route, percent }: CachedRouteParams<Route>) {
    this.route = route;
    this.percent = percent;
  }

  public get protocol(): Protocol {
    return this.route.protocol;
  }

  // TODO: ROUTE-217 - Support native currency routing
  public get tokenIn(): Token {
    return this.route.input.wrapped;
  }

  // TODO: ROUTE-217 - Support native currency routing
  public get tokenOut(): Token {
    return this.route.output.wrapped;
  }

  public get routePath(): string {
    switch (this.protocol) {
      case Protocol.V3:
        return (this.route as V3Route).pools
          .map(
            (pool) =>
              `[V3]${pool.token0.address}/${pool.token1.address}/${pool.fee}`
          )
          .join('->');
      case Protocol.V2:
        return (this.route as V2Route).pairs
          .map((pair) => `[V2]${pair.token0.address}/${pair.token1.address}`)
          .join('->');
      case Protocol.MIXED:
        return (this.route as MixedRoute).pools
          .map((pool) => {
            if (pool instanceof V3Pool) {
              return `[V3]${pool.token0.address}/${pool.token1.address}/${pool.fee}`;
            } else if (pool instanceof Pair) {
              return `[V2]${pool.token0.address}/${pool.token1.address}`;
            } else {
              throw new Error(`Unsupported pool type ${JSON.stringify(pool)}`);
            }
          })
          .join('->');
      default:
        throw new Error(`Unsupported protocol ${this.protocol}`);
    }
  }

  public get routeId(): number {
    return this.hashCode(this.routePath);
  }
}
