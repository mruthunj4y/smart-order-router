"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeAllRoutes = exports.computeAllMixedRoutes = exports.computeAllV2Routes = exports.computeAllV3Routes = void 0;
const sdk_core_1 = require("@surge/sdk-core");
const v2_sdk_1 = require("@surge/v2-sdk");
const v3_sdk_1 = require("@surge/v3-sdk");
const util_1 = require("../../../util");
const log_1 = require("../../../util/log");
const routes_1 = require("../../../util/routes");
const router_1 = require("../../router");
function computeAllV3Routes(tokenIn, tokenOut, pools, maxHops) {
    return computeAllRoutes(tokenIn, tokenOut, (route, tokenIn, tokenOut) => {
        return new router_1.V3Route(route, tokenIn, tokenOut);
    }, (pool, token) => pool.involvesToken(token), pools, maxHops);
}
exports.computeAllV3Routes = computeAllV3Routes;
function computeAllV2Routes(tokenIn, tokenOut, pools, maxHops) {
    return computeAllRoutes(tokenIn, tokenOut, (route, tokenIn, tokenOut) => {
        return new router_1.V2Route(route, tokenIn, tokenOut);
    }, (pool, token) => pool.involvesToken(token), pools, maxHops);
}
exports.computeAllV2Routes = computeAllV2Routes;
function computeAllMixedRoutes(currencyIn, currencyOut, parts, maxHops) {
    const routesRaw = computeAllRoutes(currencyIn, currencyOut, (route, currencyIn, currencyOut) => {
        return new router_1.MixedRoute(route, currencyIn instanceof sdk_core_1.Token ? currencyIn : currencyIn.wrapped, currencyOut instanceof sdk_core_1.Token ? currencyOut : currencyOut.wrapped);
    }, (pool, currency) => pool.involvesToken(currency instanceof sdk_core_1.Token ? currency : currency.wrapped), parts, maxHops);
    // filter out pure v3 and v2 routes
    return routesRaw.filter((route) => {
        return (!route.pools.every((pool) => pool instanceof v3_sdk_1.Pool) &&
            !route.pools.every((pool) => pool instanceof v2_sdk_1.Pair));
    });
}
exports.computeAllMixedRoutes = computeAllMixedRoutes;
function computeAllRoutes(tokenIn, tokenOut, buildRoute, involvesToken, pools, maxHops) {
    var _a;
    const poolsUsed = Array(pools.length).fill(false);
    const routes = [];
    const computeRoutes = (tokenIn, tokenOut, currentRoute, poolsUsed, tokensVisited, _previousTokenOut) => {
        if (currentRoute.length > maxHops) {
            return;
        }
        if (currentRoute.length > 0 &&
            involvesToken(currentRoute[currentRoute.length - 1], tokenOut)) {
            routes.push(buildRoute([...currentRoute], tokenIn, tokenOut));
            return;
        }
        for (let i = 0; i < pools.length; i++) {
            if (poolsUsed[i]) {
                continue;
            }
            const curPool = pools[i];
            const previousTokenOut = _previousTokenOut ? _previousTokenOut : tokenIn;
            if (!involvesToken(curPool, previousTokenOut)) {
                continue;
            }
            const currentTokenOut = curPool.token0.equals(previousTokenOut)
                ? curPool.token1
                : curPool.token0;
            // TODO: ROUTE-217 - Support native currency routing
            if (tokensVisited.has((0, util_1.getAddressLowerCase)(currentTokenOut))) {
                continue;
            }
            tokensVisited.add((0, util_1.getAddressLowerCase)(currentTokenOut));
            currentRoute.push(curPool);
            poolsUsed[i] = true;
            computeRoutes(tokenIn, tokenOut, currentRoute, poolsUsed, tokensVisited, currentTokenOut);
            poolsUsed[i] = false;
            currentRoute.pop();
            tokensVisited.delete((0, util_1.getAddressLowerCase)(currentTokenOut));
        }
    };
    computeRoutes(tokenIn, tokenOut, [], poolsUsed, new Set([(0, util_1.getAddressLowerCase)(tokenIn)]));
    log_1.log.info({
        routes: routes.map(routes_1.routeToString),
        pools: pools.map(routes_1.poolToString),
    }, `Computed ${routes.length} possible routes for type ${(_a = routes[0]) === null || _a === void 0 ? void 0 : _a.protocol}.`);
    return routes;
}
exports.computeAllRoutes = computeAllRoutes;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcHV0ZS1hbGwtcm91dGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3JvdXRlcnMvYWxwaGEtcm91dGVyL2Z1bmN0aW9ucy9jb21wdXRlLWFsbC1yb3V0ZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsOENBQWtEO0FBQ2xELDBDQUFxQztBQUNyQywwQ0FBK0M7QUFFL0Msd0NBQW9EO0FBQ3BELDJDQUF3QztBQUN4QyxpREFBMEU7QUFDMUUseUNBQTZFO0FBRTdFLFNBQWdCLGtCQUFrQixDQUNoQyxPQUFjLEVBQ2QsUUFBZSxFQUNmLEtBQWUsRUFDZixPQUFlO0lBRWYsT0FBTyxnQkFBZ0IsQ0FDckIsT0FBTyxFQUNQLFFBQVEsRUFDUixDQUFDLEtBQWUsRUFBRSxPQUFjLEVBQUUsUUFBZSxFQUFFLEVBQUU7UUFDbkQsT0FBTyxJQUFJLGdCQUFPLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztJQUMvQyxDQUFDLEVBQ0QsQ0FBQyxJQUFZLEVBQUUsS0FBWSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxFQUN6RCxLQUFLLEVBQ0wsT0FBTyxDQUNSLENBQUM7QUFDSixDQUFDO0FBaEJELGdEQWdCQztBQUVELFNBQWdCLGtCQUFrQixDQUNoQyxPQUFjLEVBQ2QsUUFBZSxFQUNmLEtBQWEsRUFDYixPQUFlO0lBRWYsT0FBTyxnQkFBZ0IsQ0FDckIsT0FBTyxFQUNQLFFBQVEsRUFDUixDQUFDLEtBQWEsRUFBRSxPQUFjLEVBQUUsUUFBZSxFQUFFLEVBQUU7UUFDakQsT0FBTyxJQUFJLGdCQUFPLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztJQUMvQyxDQUFDLEVBQ0QsQ0FBQyxJQUFVLEVBQUUsS0FBWSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxFQUN2RCxLQUFLLEVB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