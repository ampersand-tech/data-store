/**
* Copyright 2015-present Ampersand Technologies, Inc.
*/

import * as DataStore from './dataStore';

interface WatchTree {
  _watches ?: Watch[];
  [key: string]: WatchTree | Watch[] | undefined;
}

export interface WatchTracker {
  id: string;
  dataStore: DataStore.IDataStore;
  changeTree: {};
  watchTree: WatchTree;
  watchTreeImmediate: WatchTree;
}

export interface Change {
  path: string[];
  pathStr: string;
  pathDepth: number;
  objMask: any;
  data: any;
}

interface Trigger {
  priority: number;
  minPathDepth: number;
  watcher: Watcher;
  changes: Change[];
  changesByPath: StashOf<Change>;
}

export type TriggerCB = (watcher: Watcher, changes: Change[]) => void;
export type CodeWatchTriggerCB = (data: any) => void;

interface Watch {
  watcher: Watcher | null;
  dataStore: DataStore.IDataStore;
  path: string[];
  pathDepth: number;
  pathStr: string;
  multiData: boolean;
  data: any;
  objMask: any;
  defaults: any;
  count: number;
  didChange: boolean;
}

export interface Watcher {
  watcherID: number;
  priority: number;
  triggerImmediate: boolean;
  triggerCB: TriggerCB;
  watches: Watch[];
  getData: (path: string[], objMask?: any, defaults ?: any) => any;
  readOnly: boolean;

  dataStore: DataStore.IDataStore;

  // code watch fields
  _pathStr ?: string;
  _objMask ?: any;
  _codeWatchCB ?: CodeWatchTriggerCB;
}

export interface WatcherHandle {
  watcher: Watcher | null;
}

export interface DataWatcher {
  getWatcher(): Watcher|null;
}

export type WatcherOpt = DataWatcher | Watcher | null;


let gPendingTriggers: WatchTracker[] = [];
let gWatchRafHandle: any = null;
let gFlushWatchesCB: ErrDataCB<void> | null;

let gWatcherCount = 0;

let requestAnimationFrame = requestAnimationFrameDefault;
let gIsTestClient = false;

function requestAnimationFrameDefault(cb) {
  return setTimeout(cb, 0);
}

export function init(requestAnimationFrameIn?: any, isTestClient?: boolean) {
  requestAnimationFrame = requestAnimationFrameIn || requestAnimationFrameDefault;
  gIsTestClient = Boolean(isTestClient);
}

function isWatchTreeNode(node, key: string): node is WatchTree {
  return Boolean(node && key !== '_watches');
}

export function isDataWatcher(watcher): watcher is DataWatcher {
  return Boolean(watcher && watcher.getWatcher);
}

export function createWatchTracker(dataStore: DataStore.IDataStore, id: string) {
  const tracker: WatchTracker = {
    id,
    dataStore,
    changeTree: {},
    watchTree: {},
    watchTreeImmediate: {},
  };
  return tracker;
}

export function addToPending(tracker?: WatchTracker) {
  if (tracker && gPendingTriggers.indexOf(tracker) < 0) {
    gPendingTriggers.push(tracker);
  }
}

export function triggerWatchesNextFrame() {
  if (!gPendingTriggers.length) {
    const cb = gFlushWatchesCB;
    gFlushWatchesCB = null;
    cb && cb();
    return;
  }

  triggerWatches(gPendingTriggers, true);

  if (gWatchRafHandle) {
    return;
  }

  gWatchRafHandle = requestAnimationFrame(function() {
    const pendingTriggers = gPendingTriggers;
    gPendingTriggers = [];
    gWatchRafHandle = null;
    const flushCB = gFlushWatchesCB;
    gFlushWatchesCB = null;

    triggerWatches(pendingTriggers, false);
    flushCB && flushCB();
  });
}

export function flushWatches(cb: ErrDataCB<void>) {
  if (gFlushWatchesCB) {
    return cb('only one flushWatches call is supported at a time');
  }
  if (!gPendingTriggers.length) {
    return cb();
  }
  gFlushWatchesCB = cb;
  triggerWatchesNextFrame();
}



export function createWatcher(priority: number, triggerCB: TriggerCB, triggerImmediate = false, dataStore?: DataStore.IDataStore) {
  dataStore = dataStore || DataStore;
  priority = priority || 0;
  const watcher: Watcher = {
    watcherID: gWatcherCount++,
    priority: priority,
    triggerImmediate: !!triggerImmediate || priority < 0,
    triggerCB: triggerCB,
    watches: [],
    readOnly: false,
    dataStore,

    // convenience functions
    getData: function(path, objMask, defaults) {
      return dataStore!.getData(watcher, path, objMask, defaults);
    },
  };

  return watcher;
}

function addToWatchTree(watchTree: WatchTree, path: string[], watch: Watch) {
  let obj = watchTree;
  for (let i = 0; i < path.length; ++i) {
    const key = path[i];
    obj[key] = obj[key] || {};
    obj = obj[key] as WatchTree;
  }

  obj._watches = obj._watches || [];
  obj._watches.push(watch);
}

export function addWatchInternal(dataStore: DataStore.IDataStore, watcher: Watcher, path: string[], objMask?: any, defaults?: any, data?: any) {
  if (watcher.readOnly) {
    Log.errorNoCtx('@conor', 'addWatchInternal called on readOnly watcher', {path: path});
    return null;
  }

  const watch: Watch = {
    watcher,
    dataStore,
    path,
    pathDepth: path.length,
    pathStr: path.join('/'),
    multiData: path.indexOf('_ids') >= 0 || path.indexOf('_idxs') >= 0,
    data,
    objMask,
    defaults,
    count: 1,
    didChange: false,
  };

  watcher.watches.push(watch);
  const tracker = dataStore.getWatchTracker();
  addToWatchTree(watcher.triggerImmediate ? tracker.watchTreeImmediate : tracker.watchTree, path, watch);

  return watch;
}

export function findWatch(dataStore: DataStore.IDataStore, watcher: Watcher, path: string[], objMask) {
  const pathStr = path.join('/');
  for (let i = 0; i < watcher.watches.length; ++i) {
    const watch = watcher.watches[i];
    if (watch.pathStr === pathStr && watch.objMask === objMask && watch.dataStore === dataStore) {
      return watch;
    }
  }
  return null;
}

export function removeWatch(watcher: Watcher, path: string[], objMask) {
  const pathStr = path.join('/');
  for (let i = watcher.watches.length - 1; i >= 0; --i) {
    const watch = watcher.watches[i];
    if (watch.pathStr === pathStr && watch.objMask === objMask) {
      watcher.watches.splice(i, 1);
      // mark the watch as invalidated
      watch.watcher = null;
    }
  }
}

export function resetWatches(watcher: Watcher) {
  for (let i = 0; i < watcher.watches.length; ++i) {
    watcher.watches[i].count = 0;
  }
  watcher.readOnly = false;
}

export function pruneUnusedWatches(watcher: Watcher) {
  for (let i = watcher.watches.length - 1; i >= 0; --i) {
    const watch = watcher.watches[i];
    if (watch.count === 0) {
      watcher.watches.splice(i, 1);
      // mark the watch as invalidated
      watch.watcher = null;
    } else {
      // reset didChange flag
      watch.didChange = false;
    }
  }
  watcher.readOnly = true;
}

export function destroyWatcher(watcher: Watcher) {
  for (let i = 0; i < watcher.watches.length; ++i) {
    const watch = watcher.watches[i];
    // mark the watch as invalidated
    watch.watcher = null;
  }
  watcher.watches = [];
}

function reactorTrigger(handle: WatcherHandle, func: TriggerCB, watcher: Watcher, changes: Change[]) {
  if (handle.watcher !== watcher) {
    return;
  }

  resetWatches(watcher);
  func(watcher, changes);
  pruneUnusedWatches(watcher);
}

export function createDataReactor(priority: number, func: TriggerCB, triggerImmediate = false): WatcherHandle {
  const handle: WatcherHandle = {
    watcher: null,
  };

  const trigger = reactorTrigger.bind(null, handle, func);
  handle.watcher = createWatcher(priority, trigger, triggerImmediate);
  trigger(handle.watcher, []);

  return handle;
}

export function destroyDataReactor(handle: WatcherHandle) {
  if (handle.watcher) {
    destroyWatcher(handle.watcher);
    handle.watcher = null;
  }
}

export interface TestInfo {
  earlyUnchanged: boolean;
  watch: Watch;
}

interface TriggeredWatch {
  watch: Watch;
  path: string[];
}

function walkWatchTree(
  dataStore: DataStore.IDataStore,
  watchTree: WatchTree, changeTree: Stash,
  path: string[],
  triggeredWatches: TriggeredWatch[], testInfo?: TestInfo[],
) {
  const changeTreeKeys = Object.keys(changeTree);
  if (!changeTreeKeys.length) {
    return true;
  }

  const watches = watchTree._watches;

  // process watches in this branch
  if (watches) {
    for (let i = watches.length - 1; i >= 0; --i) {
      const watch = watches[i];
      if (!watch.watcher) {
        // destroyed watch
        watches.splice(i, 1);
        if (!watches.length) {
          delete watchTree._watches;
        }
        continue;
      }

      if (!watch.multiData && watch.objMask === Util.IDS_MASK) {
        let idsChanged = changeTree._force;
        for (const key of changeTreeKeys) {
          if (changeTree[key]._force) {
            idsChanged = true;
          }
        }
        if (!idsChanged) {
          // change happened further down the tree and this watch just cares about ids, so early out
          testInfo && testInfo.push({ watch: watch, earlyUnchanged: true });
          continue;
        }
      }

      triggeredWatches.push({ watch: watch, path: path });
    }
  }

  let hasActiveBranches = true;
  function walkSubTree(childKey, subChangeTree, subPath) {
    const subWatcherTree = watchTree[childKey] as WatchTree;
    if (subChangeTree !== undefined && !walkWatchTree(dataStore, subWatcherTree, subChangeTree, subPath, triggeredWatches, testInfo)) {
      // subWatcherTree has no watches in it anymore, prune the branch from watchTree
      delete watchTree[childKey];
    } else {
      hasActiveBranches = true;
    }
  }

  // Walk down the change map, unless we hit _force, at which point we just stay there so we always process that part of tree

  for (const key in watchTree) {
    if (key === '_watches') {
      continue;
    }

    if (key === '_ids' || key === '_idxs') {
      if (changeTree._force) {
        const dataKeys = dataStore.getData(null, path, Util.IDS_MASK);
        for (const subKey in dataKeys) {
          walkSubTree(key, changeTree, path.concat([subKey]));
        }
      } else {
        for (const subKey of changeTreeKeys) {
          walkSubTree(key, changeTree[subKey], path.concat([subKey]));
        }
      }
    } else {
      walkSubTree(key, changeTree._force ? changeTree : changeTree[key], path.concat([key]));
    }
  }

  return hasActiveBranches || watchTree._watches && watchTree._watches.length;
}

function cmpActiveTriggers(a, b) {
  const delta = a.priority - b.priority;
  if (delta) {
    return delta;
  }
  // sort in creation order so that react elements created earlier (ie higher in the tree) get triggered first
  return a.watcher.watcherID - b.watcher.watcherID;
}

function cmpChanges(a, b) {
  return a.pathDepth - b.pathDepth;
}

export function getTriggeredWatches(trackers: WatchTracker[], triggerImmediate, testInfo) {
  // gather triggered watchers for each store
  const triggeredWatches: TriggeredWatch[] = [];
  for (const tracker of trackers) {

    // Walk the changes map and record any watches that match in triggeredWatches
    walkWatchTree(
      tracker.dataStore,
      triggerImmediate ? tracker.watchTreeImmediate : tracker.watchTree,
      tracker.changeTree,
      [],
      triggeredWatches,
      testInfo,
    );

    // TODO CD: This is not very performant for immediate triggers, but hopefully there aren't many of them?
    // The alternative is to perhaps have a separate changeTree for immedate triggers.
    if (!triggerImmediate) {
      // clear processed changes map
      for (const storeName in tracker.changeTree) {
        tracker.changeTree[storeName] = {};
      }
    }
  }

  // check if triggeredWatches data actually changed, and if so, record it in the 'changes' array on a trigger for the watcher
  const activeTriggers: Trigger[] = [];
  const activeTriggersByID: StashOf<Trigger> = {};

  let changeCount = 0;
  for (const triggered of triggeredWatches) {
    const watch = triggered.watch;

    const startTime = Date.now();
    let changed = true;
    let newData = watch.dataStore.getData(null, triggered.path, watch.objMask, watch.defaults);

    if (watch.multiData) {
      testInfo && testInfo.push({ watch: watch });
    } else {
      // need to do a compare to make sure only changed fields in the mask trigger a change
      // also the replace action will trigger changes where they didn't necessarily happen
      changed = !Util.deepCompare(watch.data, newData);
      if (changed) {
        watch.data = newData;
      }
      testInfo && testInfo.push({ watch: watch, changed: changed });
    }

    const deltaTime = Date.now() - startTime;
    if (deltaTime > 50 && !gIsTestClient && !testInfo) {
      Log.warnNoCtx('@conor', 'triggerWatches.slowClone',
        { path: watch.path, mask: watch.objMask, dataKeys: Util.isObject(newData) ? Object.keys(newData) : newData });
    }

    if (!changed) {
      continue;
    }

    if (!watch.watcher) {
      // invalid watch
      Log.errorNoCtx('@conor', 'getTriggeredWatches.invalidWatcher', watch);
      continue;
    }

    watch.didChange = true;

    let trigger = activeTriggersByID[watch.watcher.watcherID];
    if (!trigger) {
      trigger = {
        priority: watch.watcher.priority,
        minPathDepth: watch.pathDepth,
        watcher: watch.watcher,
        changes: [],
        changesByPath: {},
      };
      activeTriggers.push(trigger);
      activeTriggersByID[watch.watcher.watcherID] = trigger;
    }

    const change = {
      path: triggered.path,
      pathStr: triggered.path.join('/'),
      pathDepth: triggered.path.length,
      objMask: watch.objMask,
      data: newData,
    };

    if (!trigger.changesByPath[change.pathStr]) {
      trigger.minPathDepth = Math.min(trigger.minPathDepth, change.pathDepth);
      trigger.changes.push(change);
      trigger.changesByPath[change.pathStr] = change;
      ++changeCount;
    }
  }

  if (!changeCount) {
    return [];
  }

  Log.debug('DataStore triggering ' + changeCount + ' watches');

  activeTriggers.sort(cmpActiveTriggers);
  return activeTriggers;
}

function triggerWatches(storeNames, triggerImmediate) {
  const activeTriggers = getTriggeredWatches(storeNames, triggerImmediate, null);

  // call trigger callbacks for watchers that have changes
  for (let i = 0; i < activeTriggers.length; ++i) {
    const watcher = activeTriggers[i].watcher;
    const changes = activeTriggers[i].changes;
    if (changes.length) {
      changes.sort(cmpChanges);
      watcher.triggerCB(watcher, changes);
    }
  }
}

export function countWatches(obj) {
  if (!obj || !obj._watches) {
    return 0;
  }
  for (let i = obj._watches.length - 1; i >= 0; --i) {
    const watch = obj._watches[i];
    if (!watch.watcher) {
      // destroyed watch
      obj._watches.splice(i, 1);
      continue;
    }
  }
  if (!obj._watches.length) {
    delete obj._watches;
    return 0;
  }
  return obj._watches.length;
}

export function hasWatchesInTree(watchTree: WatchTree, path: string[]) {
  let obj = watchTree;
  if (countWatches(obj)) {
    return true;
  }
  for (let i = 0; i < path.length; ++i) {
    const key = path[i];
    let tmp = obj[key];
    if (!isWatchTreeNode(tmp, key)) {
      break;
    }
    obj = tmp;
    if (countWatches(obj)) {
      return true;
    }
  }
  return false;
}
