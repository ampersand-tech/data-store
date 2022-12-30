/**
* Copyright 2015-present Ampersand Technologies, Inc.
*/

import * as DataStore from './dataStore';
import * as DataStoreWatch from './dataStoreWatch';
import { Watcher, WatcherOpt } from './dataStoreWatch';

import { getFunctionParamNames } from 'amper-utils/dist/functionUtils';
import * as ObjUtils from 'amper-utils/dist/objUtils';

type MemoizerFunc = (watcher: Watcher, ...args: any[]) => any;

export interface MemoizedFunc {
  (watcher: WatcherOpt, ...args: any[]): any;
  isMyChange: (change: any) => boolean;
}

DataStore.registerDataStore(module, 'MemoizedData', {
  allowSubobjectCreate: true,
});


let gUidCounter = 0;
const gWatchers = {};
const gDataDirty = {};

function dirtyMemoizedData(path: string[], func: MemoizerFunc, args: any[], watcher: Watcher) {
  if (DataStore.hasWatches(path)) {
    // data has watches, so update it right away
    args[0] = watcher;
    memoizeData(path, func, args);
  } else {
    // otherwise just mark it dirty
    ObjUtils.objectFillPath(gDataDirty, path, true);
  }
}

function memoizeData(path: string[], func: MemoizerFunc, args: any[]) {
  const watcher = args[0];
  DataStoreWatch.resetWatches(watcher);
  const data = func.apply(undefined, args);
  DataStoreWatch.pruneUnusedWatches(watcher);

  ObjUtils.objectFillPath(gDataDirty, path, false);
  DataStore.replaceData(path, data);
}

function getMemoizedData(uid: string, func: MemoizerFunc, args: any[], argNames: string[]) {
  const clientWatcher = args[0];
  const path = ['MemoizedData', uid];
  for (let i = 1; i < argNames.length; ++i) {
    path.push(args[i] || 'null');
  }

  let watcher = ObjUtils.objectGetFromPath(gWatchers, path);
  let isDirty = ObjUtils.objectGetFromPath(gDataDirty, path);
  if (!watcher) {
    watcher = DataStoreWatch.createWatcher(10, dirtyMemoizedData.bind(undefined, path, func, args), true);
    ObjUtils.objectFillPath(gWatchers, path, watcher);
    isDirty = true;
  }

  if (isDirty) {
    args[0] = watcher;
    memoizeData(path, func, args);
  }

  return DataStore.getData(clientWatcher, path, '*');
}

interface Memoizer0<R0> {
  (watcher: WatcherOpt): R0;
  isMyChange: (change: DataStoreWatch.Change) => boolean;
}
interface Memoizer1<R0, T0> {
  (watcher: WatcherOpt, a0: T0): R0;
  isMyChange: (change: DataStoreWatch.Change) => boolean;
}
interface Memoizer2<R0, T0, T1> {
  (watcher: WatcherOpt, a0: T0, a1: T1): R0;
  isMyChange: (change: DataStoreWatch.Change) => boolean;
}
interface Memoizer3<R0, T0, T1, T2> {
  (watcher: WatcherOpt, a0: T0, a1: T1, a2: T2): R0;
  isMyChange: (change: DataStoreWatch.Change) => boolean;
}
interface Memoizer4<R0, T0, T1, T2, T3> {
  (watcher: WatcherOpt, a0: T0, a1: T1, a2: T2, a3: T3): R0;
  isMyChange: (change: DataStoreWatch.Change) => boolean;
}
interface Memoizer5<R0, T0, T1, T2, T3, T4> {
  (watcher: WatcherOpt, a0: T0, a1: T1, a2: T2, a3: T3, a4: T4): R0;
  isMyChange: (change: DataStoreWatch.Change) => boolean;
}
interface Memoizer6<R0, T0, T1, T2, T3, T4, T5> {
  (watcher: WatcherOpt, a0: T0, a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): R0;
  isMyChange: (change: DataStoreWatch.Change) => boolean;
}
interface Memoizer7<R0, T0, T1, T2, T3, T4, T5, T6> {
  (watcher: WatcherOpt, a0: T0, a1: T1, a2: T2, a3: T3, a4: T4, a5: T5, a6: T6): R0;
  isMyChange: (change: DataStoreWatch.Change) => boolean;
}

// tslint:disable:max-line-length
export function memoize<R0>(func: ((watcher: Watcher) => R0)): Memoizer0<R0>;
export function memoize<R0, T0>(func: ((watcher: Watcher, a0: T0) => R0)): Memoizer1<R0, T0>;
export function memoize<R0, T0, T1>(func: ((watcher: Watcher, a0: T0, a1: T1) => R0)): Memoizer2<R0, T0, T1>;
export function memoize<R0, T0, T1, T2>(func: ((watcher: Watcher, a0: T0, a1: T1, a2: T2) => R0)): Memoizer3<R0, T0, T1, T2>;
export function memoize<R0, T0, T1, T2, T3>(func: ((watcher: Watcher, a0: T0, a1: T1, a2: T2, a3: T3) => R0)): Memoizer4<R0, T0, T1, T2, T3>;
export function memoize<R0, T0, T1, T2, T3, T4>(func: ((watcher: Watcher, a0: T0, a1: T1, a2: T2, a3: T3, a4: T4) => R0)): Memoizer5<R0, T0, T1, T2, T3, T4>;
export function memoize<R0, T0, T1, T2, T3, T4, T5>(func: ((watcher: Watcher, a0: T0, a1: T1, a2: T2, a3: T3, a4: T4, a5: T5) => R0)): Memoizer6<R0, T0, T1, T2, T3, T4, T5>;
export function memoize<R0, T0, T1, T2, T3, T4, T5, T6>(func: ((watcher: Watcher, a0: T0, a1: T1, a2: T2, a3: T3, a4: T4, a5: T5, a6: T6) => R0)): Memoizer7<R0, T0, T1, T2, T3, T4, T5, T6>;
// tslint:enable:max-line-length
export function memoize(func): any {
  const uid = (gUidCounter++).toString();
  const argNames = getFunctionParamNames(func);
  if (argNames[0] !== 'watcher') {
    throw new Error('first argument to memoized function must be "watcher"');
  }

  const memoizedFunc: any = function(...args) {
    return getMemoizedData(uid, func, args, argNames);
  };
  memoizedFunc.isMyChange = function(change) {
    return change.path[1] === uid;
  };
  return memoizedFunc;
}
