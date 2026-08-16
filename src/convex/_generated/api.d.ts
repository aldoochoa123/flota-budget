/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aeropuertoFleet from "../aeropuertoFleet.js";
import type * as fleetCatalog from "../fleetCatalog.js";
import type * as http from "../http.js";
import type * as intranet from "../intranet.js";
import type * as pastFleet from "../pastFleet.js";
import type * as todayFleet from "../todayFleet.js";
import type * as vehicles from "../vehicles.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aeropuertoFleet: typeof aeropuertoFleet;
  fleetCatalog: typeof fleetCatalog;
  http: typeof http;
  intranet: typeof intranet;
  pastFleet: typeof pastFleet;
  todayFleet: typeof todayFleet;
  vehicles: typeof vehicles;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
