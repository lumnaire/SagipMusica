import { app } from "electron";
import type { AppInfo } from "@shared/contract";
import { databasePath } from "./db/connection";

/**
 * `app.getVersion()` rather than process.env.npm_package_version: the latter is
 * only set when Electron was launched by npm, so it is empty in the installed
 * build — which is exactly where the version number matters.
 */
export function appInfo(): AppInfo {
  return {
    version: app.getVersion(),
    platform: process.platform,
    databasePath: databasePath(),
  };
}
