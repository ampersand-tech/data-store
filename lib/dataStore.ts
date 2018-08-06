/**
* Copyright 2015-present Ampersand Technologies, Inc.
*/

import * as DataStorePersist from './dataStorePersist';
import * as DataStoreWatch from './dataStoreWatch';
import { DataWatcher, WatchTracker, Watcher, WatcherOpt } from './dataStoreWatch';
import * as ObjMerge from './objMerge';

import * as ObjSchema from 'amper-schema/dist2017/objSchema';
import * as Types from 'amper-schema/dist2017/types';
import * as ObjUtils from 'amper-utils/dist2017/objUtils';


export { DataWatcher, Watcher, WatcherHandle, WatcherOpt } from './dataStoreWatch';

import { Stash, StashOf } from 'amper-utils/dist2017/types';

const CHECK_IMMUTABLE_MASK = process.env.NODE_ENV === 'development';
const CHECK_UNMASKED_SIZE = process.env.NODE_ENV === 'development';
const MAX_CLONE_FIELDS = 20;

export type Action = 'create' | 'remove' | 'update' | 'upsert' | 'replace' | 'max';

export interface IDataStore {
  getSchema(path: string[]): any;
  getData(watcher: WatcherOpt, path: string[], mask?: any, defaults?: any): any;
  getWatchTracker(): WatchTracker;
}

export interface IWritableDataStore extends IDataStore {
  replaceData(path: string[], data: any): void;
  updateData(path: string[], data: any): void;
  removeData(path: string[]): void;
  createData(path: string[], data: any): void;
}

const VALID_OPTIONS = ObjUtils.objectMakeImmutable({
  schema: 1,
  isServerSynced: 1,
  allowSubobjectCreate: 1,
  persistType: 1,
  futureFeed: 1,
});
export interface Options {
  schema ?: Types.Schema | null;
  isServerSynced ?: boolean;
  allowSubobjectCreate ?: boolean;
  persistType ?: 'window' | 'local';
  futureFeed ?: boolean;
}

const gDataStores: StashOf<DataStoreInternal> = {};
let gDataLoaded = false;

let gWatchTracker: DataStoreWatch.WatchTracker;

const gCodeWatchers: Watcher[] = [];

let windowReadAll;
let gDebug = {
  ds: {},
  dss: {},
};

export function init(windowReadAllIn?: any, requestAnimationFrameIn?: any, isTestClient?: any, debugIn?: any) {
  DataStoreWatch.init(requestAnimationFrameIn, isTestClient);
  windowReadAll = windowReadAllIn;
  if (debugIn) {
    ObjUtils.copyFields(gDebug, debugIn);
    gDebug = debugIn;
  }
}

export function getWatchTracker() {
  if (!gWatchTracker) {
    gWatchTracker = DataStoreWatch.createWatchTracker(module.exports, 'DataStore');
  }
  return gWatchTracker;
}

export function validateMask(funcName: string, path: string[], objMask: any) {
  if (objMask && CHECK_IMMUTABLE_MASK && (typeof(objMask) === 'object') && !Object.isFrozen(objMask)) {
    console.error(funcName + ' called with mutable mask', { path: path });
  }
}

//////////////////////////////// stores //////////////////////////////////

export interface DataStoreInternal {
  storeName: string;
  data: {};
  options: Options;
  lastMerge: {
    timestamp: number;
    count: number;
    sessionIdx: number;
    windowNumber: number;
  } | null;

  // server related fields
  serverData ?: {};
  clientChangeTree: null | {};
  serverChangeTree ?: {};
}

export function registerDataStore(theModule, storeName: string, options ?: Options, optData ?: any) {
  if (gDataStores[storeName]) {
    if (theModule && theModule.hot) {
      // ignore dup register calls if hot reloading
      return;
    }

    console.error('DataStore.registerDataStore duplicate store', { storeName: storeName });
    return;
  }

  options = options || {};

  for (const opt in options) {
    if (!VALID_OPTIONS.hasOwnProperty(opt)) {
      console.error('bad option passed to DataStore.registerDataStore', { storeName: storeName, optionName: opt });
    }
  }

  if (optData && optData.schema) {
    console.error('invalid params to DataStore.registerDataStore', { storeName: storeName });
  }

  if (!optData && options.schema) {
    optData = ObjSchema.getDefaultValuesForSchema(options.schema);
  }

  if (options.persistType) {
    if (options.persistType !== 'window' && options.persistType !== 'local') {
      console.error('DataStore.registerDataStore invalid persistType', { storeName, persistType: options.persistType });
      options.persistType = undefined;
    }
    if (gDataLoaded) {
      console.error('DataStore.registerDataStore with persistence called after data loaded', { storeName: storeName });
    }
    if (options.persistType === 'local') {
      // need futureFeed on to handle broadcasts from newer tabs to older tabs
      options.futureFeed = true;
    }
  }

  const watchTracker = getWatchTracker();
  watchTracker.changeTree[storeName] = {};

  const store: DataStoreInternal = {
    storeName: storeName,
    data: optData || {},
    options: options,
    lastMerge: null,
    serverData: undefined,
    clientChangeTree: null,
  };

  gDebug.ds[storeName] = store.data;

  if (options.isServerSynced) {
    store.serverData = ObjUtils.clone(store.data);
    store.clientChangeTree = null;
    store.serverChangeTree = {};
    gDebug.dss[storeName] = store.serverData;

    if (options.persistType === 'window') {
      console.error('DataStore.registerDataStore window persistType incompatible with isServerSynced', { storeName: storeName });
      options.persistType = undefined;
    }
  }

  gDataStores[storeName] = store;
}

interface LoadInfo {
  modified: {};
  failed: {};
  noData: {};
}

export async function loadDataStores(): Promise<Stash> {
  if (gDataLoaded) {
    throw new Error('already loaded');
  }
  gDataLoaded = true;

  const loadInfo = {
    modified: {},
    failed: {},
    noData: {},
  };

  windowReadAll(function(err1, windowStorage) {
    if (err1) {
      console.error('loadDataStores.windowReadAll.error', {err: err1});
      windowStorage = null;
    }

    for (const storeName in gDataStores) {
      const store = gDataStores[storeName];
      if (store.options.persistType) {
        await DataStorePersist.loadDataStore(store, windowStorage, loadInfo);
      }
    }

    DataStorePersist.initBroadcastHandlers();
    DataStoreWatch.triggerWatchesNextFrame();
    return (loadInfo);
  });
}

export function resetToDefaults(path: string[]) {
  const storeName = path[0];
  const store = gDataStores[storeName];
  if (!store) {
    console.error('DataStore.resetToDefaults called with unknown storeName', { storeName: storeName });
    return;
  }
  if (!store.options.schema) {
    console.error('store cannot resetToDefaults without schema', { storeName: storeName });
    return;
  }
  let schema: Types.Schema | null = store.options.schema;
  if (path.length > 1) {
    schema = ObjSchema.getSchemaForPath(schema, path.slice(1));
  }

  changeData('replace', path, ObjSchema.getDefaultValuesForSchema(schema));
}

export function resetStoreToDefaultsAsInternal(storeName: string, cb ?: ErrDataCB<void>) {
  const store = gDataStores[storeName];
  if (!store) {
    console.error('DataStore.resetStoreToDefaultsAsInternal called with unknown storeName', { storeName: storeName });
    return cb && cb();
  }
  const defaults = store.options.schema ? ObjSchema.getDefaultValuesForSchema(store.options.schema) : {};
  if (store.options.isServerSynced) {
    changeServerDataAsInternal('replace', [storeName], defaults);
    store.serverChangeTree = {};
  }
  changeDataAsInternal('replace', [storeName], defaults);
  store.clientChangeTree = null;

  if (store.options.persistType) {
    DataStorePersist.clearPersistedData(store, cb);
  } else {
    cb && cb();
  }
}

export function hasDataStore(storeName: string) {
  return !!gDataStores[storeName];
}

export function hasData(path: string[]) {
  return getDataUnsafe(path) !== undefined;
}

export function getDataUnsafe(path: string[]) {
  const storeName = path[0];
  const store = gDataStores[storeName];
  if (!store) {
    console.error('DataStore.getDataUnsafe called with unknown storeName', { storeName: storeName });
    return undefined;
  }

  return ObjUtils.objectGetFromPath(store.data, path.slice(1));
}

export function getData(watcherIn: WatcherOpt, path: string[], objMask ?: any, defaults ?: any) {
  // handle DataWatcher
  const watcher: WatcherOpt = DataStoreWatch.isDataWatcher(watcherIn) ? watcherIn.getWatcher() : watcherIn;
  if (watcher && watcher.dataStore !== module.exports) {
    // handle custom dataStore
    return watcher.getData(path, objMask, defaults);
  }
  return getDataNoOverlay(watcher, path, objMask, defaults);
}

export function getDataNoOverlay(watcherIn: WatcherOpt, path: string[], objMask ?: any, defaults ?: any) {
  const storeName = path[0];
  const store = gDataStores[storeName];
  if (!store) {
    console.error('DataStore.getData called with unknown storeName', { storeName: storeName });
    return defaults;
  }

  validateMask('DataStore.getData', path, objMask);

  // handle DataWatcher
  const watcher: WatcherOpt = DataStoreWatch.isDataWatcher(watcherIn) ? watcherIn.getWatcher() : watcherIn;
  if (watcher) {
    const watch = DataStoreWatch.findWatch(module.exports, watcher, path, objMask);
    if (watch) {
      watch.count++;
      return watch.data;
    }
  }

  if (store.options.schema && objMask && objMask !== '*') {
    const validationErr = ObjSchema.validateFields(store.options.schema, path, objMask, ObjSchema.VALIDATE_EXISTS);
    if (validationErr) {
      console.error('DataStore objMask does not match schema', { err: validationErr, path: path, objMask: objMask });
    }
  }

  const obj = ObjUtils.objectGetFromPath(store.data, path.slice(1));
  const data = ObjUtils.cloneWithMask(obj, objMask, defaults);

  if (!objMask && CHECK_UNMASKED_SIZE) {
    const count = ObjUtils.fieldCount(data);
    if (count > MAX_CLONE_FIELDS) {
      Log.devError('@caller', 'DataStore.getData called on a large object', { path: path.join('/'), fieldCount: count });
    }
  }

  if (watcher && !watcher.readOnly) {
    DataStoreWatch.addWatchInternal(module.exports, watcher, path, objMask, defaults, data);
  }

  return data;
}

export function getServerDataUnsafe(path: string[]) {
  const storeName = path[0];
  const store = gDataStores[storeName];
  if (!store) {
    console.error('DataStore.getServerDataUnsafe called with unknown storeName', { storeName: storeName });
    return undefined;
  }

  if (!store.options.isServerSynced) {
    console.error('DataStore is not server synced', { storeName: storeName });
    return undefined;
  }

  return ObjUtils.objectGetFromPath(store.serverData, path.slice(1));
}

export function resetServerChangeTree(storeName: string) {
  const store = gDataStores[storeName];
  if (!store) {
    console.error('DataStore.resetServerChangeTree called with unknown storeName', { storeName: storeName });
    return;
  }

  if (!store.options.isServerSynced) {
    console.error('DataStore is not server synced', { storeName: storeName });
    return;
  }

  store.serverChangeTree = {};
}

function mergeChangeTree(dst, src, needClone = false) {
  if (dst._force) {
    return;
  }
  if (src._force) {
    dst._force = true;
    return;
  }

  for (const key in src) {
    if (dst[key]) {
      mergeChangeTree(dst[key], src[key], needClone);
    } else {
      dst[key] = needClone ? ObjUtils.clone(src[key]) : src[key];
    }
  }
}

function cloneChanged(dst, src, changeTree) {
  if (changeTree._force || !dst || !src) {
    return ObjUtils.clone(src);
  }

  for (const key in changeTree) {
    if (src.hasOwnProperty(key)) {
      dst[key] = cloneChanged(dst[key], src[key], changeTree[key]);
    } else {
      delete dst[key];
    }
  }

  return dst;
}

export function resetClientToServer(storeName: string, force = false) {
  const store = gDataStores[storeName];
  if (!store) {
    console.error('DataStore.resetServerChangeTree called with unknown storeName', { storeName: storeName });
    return;
  }

  if (!store.options.isServerSynced) {
    console.error('DataStore is not server synced', { storeName: storeName });
    return;
  }

  if (!store.clientChangeTree && !force) {
    // nothing to do
    return;
  }

  const watchTracker = getWatchTracker();
  const changeTree = watchTracker.changeTree[storeName];

  mergeChangeTree(changeTree, store.serverChangeTree, false);
  if (store.clientChangeTree) {
    mergeChangeTree(changeTree, store.clientChangeTree, false);
  }
  store.clientChangeTree = null;
  store.serverChangeTree = {};

  store.data = cloneChanged(store.data, store.serverData, changeTree);
  gDebug.ds[storeName] = store.data;

  DataStoreWatch.addToPending(watchTracker);
}

function resetAll(cb: ErrDataCB<void>) {
  let jobs = new Jobs.Queue();
  for (const storeName in gDataStores) {
    jobs.add(resetStoreToDefaultsAsInternal, storeName);
  }
  jobs.drain((err) => cb(err));
}

function changeServerDataInternal(store: DataStoreInternal, action: Action, path: string[], fields, feedCount ?: number) {
  return ObjMerge.applyActionNoClone(store.serverData!, action, path.slice(1), fields, feedCount, store.options, false, store.serverChangeTree);
}

export function changeServerDataAsInternal(action: Action, path: string[], fields, feedCount ?: number) {
  const storeName = path[0];
  const store = gDataStores[storeName];
  if (!store) {
    console.error('DataStore not found', { storeName: storeName });
    return false;
  }

  if (!store.options.isServerSynced) {
    console.error('DataStore is not server synced', { storeName: storeName });
    return false;
  }

  return changeServerDataInternal(store, action, path, ObjUtils.clone(fields), feedCount);
}

function shouldPersist(store: DataStoreInternal, action: Action, path: string[], didChange: boolean) {
  if (!store.options.persistType) {
    return false;
  }
  if (didChange) {
    return true;
  }

  // always persist root-replace, because we don't know if the store has been persisted at all yet,
  // and this replace may be initializing with the default values (in which case didChange is false)
  return path.length === 1 && (action === 'replace' || action === 'remove');
}

export function changeServerData(action: Action, path: string[], fields, feedCount: number) {
  const storeName = path[0];
  const store = gDataStores[storeName];
  if (!store) {
    console.error('DataStore not found', { storeName: storeName });
    return false;
  }

  if (!store.options.isServerSynced) {
    console.error('DataStore is not server synced', { storeName: storeName });
    return false;
  }

  const didChange = changeServerDataInternal(store, action, path, ObjUtils.clone(fields), feedCount);
  if (shouldPersist(store, action, path, didChange)) {
    DataStorePersist.persistChange(store, action, path, fields, feedCount);
  }
  return didChange;
}

function changeDataInternal(
  store: DataStoreInternal, action: Action, path: string[], fields,
  clientKey, allowSubobjectCreate = false, noWatchTrigger = false,
) {
  // applyAction modifies changeTree
  const watchTracker = getWatchTracker();
  const changeTree = watchTracker.changeTree[store.storeName];

  allowSubobjectCreate = allowSubobjectCreate || store.options.allowSubobjectCreate || false;
  const changed = ObjMerge.applyActionNoClone(store.data, action, path.slice(1), fields, clientKey, store.options, allowSubobjectCreate, changeTree);
  if (changed) {
    DataStoreWatch.addToPending(watchTracker);

    if (store.options.isServerSynced) {
      store.clientChangeTree = store.clientChangeTree || {};
      mergeChangeTree(store.clientChangeTree, changeTree, true);
    }

    if (!noWatchTrigger) {
      DataStoreWatch.triggerWatchesNextFrame();
    }

    return true;
  }
  return false;
}

export function changeDataAsInternal(action: Action, path: string[], fields, clientKey ?: any, allowSubobjectCreate = false, noWatchTrigger = false) {
  const storeName = path[0];
  const store = gDataStores[storeName];
  if (!store) {
    console.error('DataStore not found', { storeName: storeName });
    return false;
  }

  return changeDataInternal(store, action, path, ObjUtils.clone(fields), clientKey, allowSubobjectCreate, noWatchTrigger);
}

export function changeDataNoClone(action: Action, path: string[], fields, clientKey ?: any, allowSubobjectCreate = false, noWatchTrigger = false) {
  const storeName = path[0];
  const store = gDataStores[storeName];
  if (!store) {
    console.error('DataStore not found', { storeName: storeName });
    return false;
  }

  if (store.options.isServerSynced) {
    console.error('DataStore.changeData called on server synced store', { storeName: storeName });
    return false;
  }

  const didChange = changeDataInternal(store, action, path, fields, clientKey, allowSubobjectCreate, noWatchTrigger);
  if (!store.options.isServerSynced && shouldPersist(store, action, path, didChange)) {
    DataStorePersist.persistChange(store, action, path, fields);
  }
  return didChange;
}

export function changeData(action: Action, path: string[], fields ?: any,
  clientKey ?: any, allowSubobjectCreate ?: boolean, noWatchTrigger ?: boolean,
) {
  return changeDataNoClone(action, path, ObjUtils.clone(fields), clientKey, allowSubobjectCreate, noWatchTrigger);
}

// Returns what the bool WAS set to (as if you called getData).
export function toggleBool(path: string[]) {
  const bool = getDataUnsafe(path);
  if (typeof bool !== 'boolean') {
    console.error('DataStore.toggleBool called on non-bool', { path: path});
    return;
  }
  changeDataNoClone('replace', path, !bool);
  return bool;
}

export function hasWatches(path: string[]) {
  const watchTracker = getWatchTracker();
  return DataStoreWatch.hasWatchesInTree(watchTracker.watchTree, path) || DataStoreWatch.hasWatchesInTree(watchTracker.watchTreeImmediate, path);
}

function hasAnyWatchesRecur(obj) {
  if (!obj) {
    return false;
  }

  if (DataStoreWatch.countWatches(obj)) {
    return true;
  }

  for (const key in obj) {
    if (hasAnyWatchesRecur(obj[key])) {
      return true;
    }
  }
  return false;
}

export function hasAnyWatches(storeName: string) {
  const watchTracker = getWatchTracker();
  return hasAnyWatchesRecur(watchTracker.watchTree[storeName]) || hasAnyWatchesRecur(watchTracker.watchTreeImmediate[storeName]);
}

export function addWatch(watcherIn: Watcher | DataWatcher, path: string[], objMask ?: any, defaults ?: any) {
  validateMask('DataStore.addWatch', path, objMask);

  // handle DataWatcher
  const watcher: WatcherOpt = DataStoreWatch.isDataWatcher(watcherIn) ? watcherIn.getWatcher() : watcherIn;
  if (!watcher) {
    return undefined;
  }

  if (watcher.readOnly) {
    console.error('DataStore.addWatch called on a readOnly watcher');
    return undefined;
  }

  // add the watch and return the data
  if (path.indexOf('_ids') >= 0 || path.indexOf('_idxs') >= 0) {
    DataStoreWatch.addWatchInternal(module.exports, watcher, path, objMask, defaults);
    return undefined;
  }
  return getData(watcher, path, objMask, defaults);
}

function triggerCodeWatch(watcher: Watcher, changes: DataStoreWatch.Change[]) {
  if (!watcher._codeWatchCB) {
    return;
  }
  for (let i = 0; i < changes.length; ++i) {
    Log.debug('triggerCodeWatch', changes[i].path);
    watcher._codeWatchCB(changes[i].data);
  }
}

export function addCodeWatch(path: string[], objMask, priority: number, cb: DataStoreWatch.CodeWatchTriggerCB) {
  const watcher = DataStoreWatch.createWatcher(priority, triggerCodeWatch);
  watcher._pathStr = path.join('/');
  watcher._objMask = objMask;
  watcher._codeWatchCB = cb;
  gCodeWatchers.push(watcher);

  return addWatch(watcher, path, objMask, undefined);
}

export function removeCodeWatch(path: string[], objMask, cb: DataStoreWatch.TriggerCB) {
  const dbWatchKey = path.join('/');

  for (let i = gCodeWatchers.length - 1; i >= 0; --i) {
    const watcher = gCodeWatchers[i];
    if (watcher._pathStr === dbWatchKey && watcher._objMask === objMask && watcher._codeWatchCB === cb) {
      DataStoreWatch.destroyWatcher(watcher);
      gCodeWatchers.splice(i, 1);
    }
  }
}

export function getSchema(path: string[]): any {
  const [storeName, ...rest] = path;
  const store = gDataStores[storeName];
  if (!store) {
    console.error('DataStore not found', { storeName: storeName });
    return null;
  }
  if (!store.options.schema) {
    return undefined;
  }
  return ObjSchema.getSchemaForPath(store.options.schema, rest);
}

//////////////////////////////// exports //////////////////////////////////

type ChangeDataFunc = (action: Action, path: string[], fields) => boolean;
type WrappedChangeDataFunc = (path: string[], fields ?: any) => boolean;
function wrapChangeData(func: ChangeDataFunc, action: Action): WrappedChangeDataFunc {
  return function(path, fields) {
    return func(action, path, fields);
  };
}

export const createData = wrapChangeData(changeData, 'create');
export const updateData = wrapChangeData(changeData, 'update');
export const upsertData = wrapChangeData(changeData, 'upsert');
export const replaceData = wrapChangeData(changeData, 'replace');
export const removeData = wrapChangeData(changeData, 'remove');
export const createDataNoClone = wrapChangeData(changeDataNoClone, 'create');
export const updateDataNoClone = wrapChangeData(changeDataNoClone, 'update');
export const upsertDataNoClone = wrapChangeData(changeDataNoClone, 'upsert');
export const replaceDataNoClone = wrapChangeData(changeDataNoClone, 'replace');
export const removeDataNoClone = wrapChangeData(changeDataNoClone, 'remove');

export const test = {
  getDataStore: function(storeName) {
    return gDataStores[storeName];
  },
  resetAll: resetAll,
  changeData: function(action: Action, path: string[], fields: any, feedCount?: number) {
    const storeName = path[0];
    const store = gDataStores[storeName];
    if (!store) {
      console.error('DataStore.test.changeData called with unknown storeName', { storeName: storeName });
      return false;
    }
    if (store.options.isServerSynced) {
      const ret = changeServerDataAsInternal(action, path, fields, feedCount);
      resetClientToServer(path[0], true);
      return ret;
    }
    return changeDataAsInternal(action, path, fields, feedCount);
  },
};
