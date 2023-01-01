/*
* Copyright 2015-present Ampersand Technologies, Inc.
*/

import { WatcherOpt } from './dataStore';
import { DataStoreCache } from './dataStoreCache';

import * as SchemaType from 'amper-schema/dist/types';
import { ErrDataCB, ErrorType, Stash } from 'amper-utils/dist/types';


export interface CachedFetchedData {
  cmd: string;
  params: Stash;
  data?: Stash;
}

export type SvrCmdExecutor = (cmd: string, params: Stash) => Promise<Stash>;

const DEFAULT_SVRCMD_EXPIRE = 15 * 60 * 1000;

interface SvrCmdInfo {
  paramNames: string[];
  paramTypes: SchemaType.Schema;
  expireDelay: number;
}

const gSvrCmds: Stash<SvrCmdInfo> = {};

const gCache = new DataStoreCache<Stash, Stash|undefined>({
  name: 'DataServerCmd',
  fetchData: runSvrCmd,
  paramsToCachePath,
  getExpireDelay: (cmdName: string) => {
    if (gSvrCmds[cmdName]) {
      return gSvrCmds[cmdName].expireDelay;
    }
    return Infinity;
  },
});

function registerSvrCmd(cmdName: string, paramTypes: SchemaType.Schema, expireDelay?: number) {
  if (gSvrCmds.hasOwnProperty(cmdName)) {
    console.error('DataStore.registerSvrCmd duplicate cmd', { cmdName: cmdName });
    return;
  }

  const paramNames = Object.keys(paramTypes);
  for (const paramName of paramNames) {
    const type = paramTypes[paramName];
    if (!type._validateType) {
      console.error('DataStore.registerSvrCmd invalid param type', { cmdName: cmdName, paramName: paramName });
      return;
    }
    const typeStr = type.toString();
    if (typeStr === 'OBJECT' || typeStr === 'ARRAY' || typeStr === 'BINSTR') {
      console.error('DataStore.registerSvrCmd invalid param type', { cmdName: cmdName, paramName: paramName, type: typeStr });
      return;
    }
  }

  gSvrCmds[cmdName] = {
    paramNames: paramNames,
    paramTypes: paramTypes,
    expireDelay: expireDelay || DEFAULT_SVRCMD_EXPIRE,
  };
}

let gSvrCmd: SvrCmdExecutor | null = null;

async function runSvrCmd(cmd: string, params: Stash): Promise<Stash> {
  if (!gSvrCmd) {
    throw new Error('dataServerCmd not initialized');
  }
  return await gSvrCmd(cmd, params);
}

export function init(cmdDefs: Stash<SchemaType.Schema>, svrCmdExecutor: SvrCmdExecutor, dataCache: CachedFetchedData[]) {
  gSvrCmd = svrCmdExecutor;

  for (const cmdName in cmdDefs) {
    registerSvrCmd(cmdName, cmdDefs[cmdName]);
  }

  for (const cachedData of dataCache) {
    gCache.prefillCache(cachedData.cmd, cachedData.params, null, cachedData.data);
  }
}

export function svrCmdToPath(cmdName: string, params: Stash) {
  return gCache.getPath(cmdName, params);
}

function paramsToCachePath(cmdName: string, params?: Stash) {
  const svrCmd = gSvrCmds[cmdName];
  if (!svrCmd) {
    console.error('DataStore unknown svrCmd', { cmdName: cmdName });
    return undefined;
  }

  const path: string[] = [];
  for (const paramName of svrCmd.paramNames) {
    const paramValue = params ? params[paramName] : '';
    if (!SchemaType.validateType(paramValue, svrCmd.paramTypes[paramName], true)) {
      console.error('DataStore invalid param value', { cmdName, paramName, paramValue });
      return undefined;
    }
    path.push(paramValue);
  }

  if (params) {
    for (const key in params) {
      if (!svrCmd.paramTypes[key]) {
        console.error('DataStore extraneous param', { cmdName, paramName: key, paramValue: params[key] });
      }
    }
  }

  return path;
}

// note: errCB gets called ONLY if a fetch gets triggered, so that you don't toast multiple times for the same error
// if you want to render the error, use the return value instead
export function getServerDataWithError(watcher: WatcherOpt, cmdName: string, params: Stash, errCB?: ErrDataCB<any>) {
  return gCache.getDataWithError(watcher, cmdName, params, errCB);
}

export function getServerData(watcher: WatcherOpt, cmdName: string, params: Stash, subPath?: string[], errCB?: ErrDataCB<any>) {
  return gCache.getData(watcher, cmdName, params, subPath, errCB);
}

export function invalidateServerData(cmdName: string, params?: Stash, noClear?: boolean) {
  gCache.invalidate(cmdName, params, noClear);
}

export const test = {
  fillDataCache: function(cmdName: string, params: Stash, err: ErrorType, data: any) {
    gCache.prefillCache(cmdName, params, err, data);
  },
  clear: function() {
    gCache.clear();
  },
};
