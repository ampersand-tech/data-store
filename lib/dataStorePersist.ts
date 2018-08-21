/**
* Copyright 2017-present Ampersand Technologies, Inc.
*/

import * as DataStore from './dataStore';
import { Action, DataStoreInternal } from './dataStore';

import * as ObjSchema from 'amper-schema/dist2017/objSchema';
import { Stash, StashOf } from 'amper-utils/dist2017/types';
import * as md5 from 'blueimp-md5';

interface MergeCmpData {
  timestamp: number;
  count: number;
  sessionIdx: number;
  windowNumber: number;
}

interface MergeData extends MergeCmpData {
  timeKey: string;

  action: Action;
  path: string[];
  fields: any;
}

interface LoadInfo {
  modified: StashOf<number>;
  failed: StashOf<string>;
  noData: StashOf<boolean>;
}

let FileStore: any;

export function init(FileStoreIn) {
  FileStore = FileStoreIn;
}

function cmpMerges(a: MergeCmpData, b: MergeCmpData) {
  if (a.timestamp !== b.timestamp) {
    return a.timestamp - b.timestamp;
  }
  if (a.sessionIdx !== b.sessionIdx) {
    return a.sessionIdx - b.sessionIdx;
  }
  if (a.windowNumber !== b.windowNumber) {
    return a.windowNumber - b.windowNumber;
  }
  return a.count - b.count;
}

function validateTable(store: DataStoreInternal, data: any, loadInfo: LoadInfo) {
  if (!store.options.schema) {
    return true;
  }

  const validationErr = ObjSchema.validateFields(store.options.schema, [], data, ObjSchema.VALIDATE_ALL_AND_FILL_DEFAULTS, null, loadInfo.modified);
  if (!validationErr) {
    return true;
  }

  // loaded data does not validate against schema, do not use it
  Log.infoNoCtx('Invalid DS data found, clearing', { store: store.storeName, err: validationErr });
  Metrics.recordInSet(Metrics.NO_DIMS, Metrics.SET.INTERNAL.DS, 'persist.invalidData', { store: store.storeName });

  FileStore.remove('dsData/' + store.storeName);

  loadInfo.failed[store.storeName] = 'validation';
  delete loadInfo.modified[store.storeName];

  return false;
}

function cleanupFiles(files: Stash, cb: ErrDataCB<any>) {
  if (!files) {
    return cb();
  }
  let removePaths = files.paths;
  if (files.errors) {
    removePaths = removePaths.concat(Object.keys(files.errors));
  }

  FileStore.removeList(removePaths, function() {
    cb();
  });
}

function validateAndApplyData(store: DataStoreInternal, loadedData: any, loadInfo: LoadInfo) {
  if (!loadedData) {
    loadInfo.noData[store.storeName] = true;
    return;
  }
  if (validateTable(store, loadedData, loadInfo)) {
    if (store.options.isServerSynced) {
      DataStore.changeServerDataAsInternal('replace', [store.storeName], loadedData, undefined);
    }
    DataStore.changeDataAsInternal('replace', [store.storeName], loadedData, null, false, true);
  }
}

function mergeChanges(store: DataStoreInternal, files: Stash, loadInfo: LoadInfo, cb: ErrDataCB<any>) {
  const mergeList: MergeData[] = files.objects;
  mergeList.sort(cmpMerges);

  if (mergeList.length) {
    Log.debug('applying merge files to ' + store.storeName + ':', mergeList);
  }

  // find first merge to apply
  let startIdx = 0;
  for (let i = mergeList.length - 1; i >= 0; --i) {
    const mergeData = mergeList[i];
    if (store.options.isServerSynced && store.lastMerge && cmpMerges(mergeData, store.lastMerge) <= 0) {
      // already applied, happens with multiple windows if one window has a pending sync while another is in mergeChanges
      startIdx = i + 1;
      break;
    }

    if ((mergeData as Stash).store) {
      // fixup old merge files
      mergeData.path.unshift((mergeData as Stash).store);
      delete (mergeData as Stash).store;
    }

    if (mergeData.path.length === 1 && mergeData.action === 'replace') {
      // found root-level replace, ignore all merges older than this one
      startIdx = i;
      break;
    }
  }

  // apply merges
  for (let i = startIdx; i < mergeList.length; ++i) {
    const mergeData = mergeList[i];

    if (store.options.isServerSynced) {
      DataStore.changeServerDataAsInternal(mergeData.action, mergeData.path, mergeData.fields, mergeData.timestamp);
    }
    DataStore.changeDataAsInternal(mergeData.action, mergeData.path, mergeData.fields, null, false, true);

    loadInfo.modified[store.storeName] = 1;
    loadInfo.noData[store.storeName] = false;

    store.lastMerge = {
      timestamp: mergeData.timestamp,
      count: mergeData.count,
      sessionIdx: mergeData.sessionIdx,
      windowNumber: mergeData.windowNumber,
    };
  }

  if (!loadInfo.modified[store.storeName]) {
    return cleanupFiles(files, cb);
  }

  const dataToWrite = {
    data: DataStore.getDataUnsafe([store.storeName]),
    lastMerge: store.lastMerge,
  };

  FileStore.update('dsData/' + store.storeName, dataToWrite, function(err) {
    if (err) { return cb(err); }
    cleanupFiles(files, cb);
  });
}

function loadDataStoreInternal(store: DataStoreInternal, windowStorage: Stash, loadInfo: LoadInfo, cb: ErrDataCB<any>) {
  if (store.options.persistType === 'window') {
    validateAndApplyData(store, windowStorage && windowStorage[store.storeName], loadInfo);
    return cb();
  }

  FileStore.find('dsData/' + store.storeName, function(err1, loadedData) {
    loadedData = loadedData || {};

    if (err1) {
      Log.infoNoCtx('Failed to load DS data, clearing', { store: store.storeName, err: err1 });
      Metrics.recordInSet(Metrics.NO_DIMS, Metrics.SET.INTERNAL.DS, 'dsDataLoadFailed', { store: store.storeName });

      loadInfo.failed[store.storeName] = 'dsLoad';
      delete loadInfo.modified[store.storeName];
    } else {
      validateAndApplyData(store, loadedData.data, loadInfo);
      store.lastMerge = loadedData.lastMerge;
    }

    FileStore.findDir('dsMerges/' + store.storeName + '/', function(err2, files) {
      if (loadInfo.failed[store.storeName]) {
        // store data failed to load, delete the merge files and abort
        return cleanupFiles(files, cb);
      }

      err2 = err2 || files.errors;
      if (err2) {
        // merges failed to load, reset table and bail out
        Log.warnNoCtx('@conor', 'dsMergeLoadFailed', err2);
        loadInfo.failed[store.storeName] = 'mergeLoad';
        DataStore.resetStoreToDefaultsAsInternal(store.storeName);
        return cleanupFiles(files, cb);
      }

      mergeChanges(store, files, loadInfo, cb);
    });
  });
}

export function loadDataStore(store: DataStoreInternal, windowStorage: Stash, loadInfo: LoadInfo, cb: ErrDataCB<any>) {
  loadDataStoreInternal(store, windowStorage, loadInfo, function(err) {
    if (store.options.isServerSynced) {
      store.clientChangeTree = null;
      store.serverChangeTree = {};
    }
    cb(err);
  });
}

function receiveLocalMerge(_msg: string, mergeData: MergeData) {
  const path = mergeData.path;
  if ((mergeData as Stash).store) {
    // fixup old merges
    path.unshift((mergeData as Stash).store);
  }
  Log.debug('receiveLocalMerge', { action: mergeData.action, path: path });
  if (DataStore.hasDataStore(path[0])) {
    DataStore.changeDataAsInternal(mergeData.action, path, mergeData.fields);
  }
}

export function initBroadcastHandlers() {
  FileStore.registerLocalMessageHandler('dsMerge', receiveLocalMerge);
}


function makeObjHashKey(obj) {
  if (!Util.isObject(obj)) {
    return '1';
  }
  const keys = Object.keys(obj).sort();
  return md5(keys.join());
}

export function persistChange(store: DataStoreInternal, action: Action, path: string[], fields: any, feedCount?: number) {
  if (store.options.persistType === 'window') {
    // no merge files for window storage, just write out directly
    FileStore.windowWrite(store.storeName, DataStore.getDataUnsafe([store.storeName]));
    return;
  }

  let timeKey: string;
  if (feedCount !== undefined) {
    timeKey = [feedCount, 0, 0, 0].join('.');
  } else {
    timeKey = Util.timeKey();
  }
  const splitTimeKey = timeKey.split('.');

  const mergeData: MergeData = {
    timeKey: timeKey,
    timestamp: Number(splitTimeKey[0]) || 0,
    count: Number(splitTimeKey[1]) || 0,
    sessionIdx: Number(splitTimeKey[2]) || 0,
    windowNumber: Number(splitTimeKey[3]) || 0,

    action: action,
    path: path,
    fields: fields,
  };

  let hash = timeKey;
  if (action === 'update' || action === 'upsert') {
    // for merge updates, hash the field keys so we overwrite previous merges that are now superseded
    hash = makeObjHashKey(fields);
  }
  const fileName = action + '_' + path.join('_') + '_' + hash;
  FileStore.update('dsMerges/' + store.storeName + '/' + fileName, mergeData, function() {
    if (!store.options.isServerSynced) {
      FileStore.localBroadcast('dsMerge', mergeData);
    }
  });
}

export function clearPersistedData(store: DataStoreInternal, cb?: ErrDataCB<any>) {
  if (store.options.persistType === 'window') {
    FileStore.windowWrite(store.storeName, null, cb);
    return;
  }

  const jobs = new Jobs.Queue();
  jobs.add(FileStore.remove, 'dsData/' + store.storeName);
  jobs.add(FileStore.removeDir, 'dsMerges/' + store.storeName + '/');
  jobs.drain(function(err) {
    cb && cb(err);
  });
}
