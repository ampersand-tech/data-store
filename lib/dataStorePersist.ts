/**
* Copyright 2017-present Ampersand Technologies, Inc.
*/

import * as DataStore from './dataStore';
import { Action, DataStoreInternal } from './dataStore';

import { withError } from 'amper-promise-utils/dist/index';
import * as ObjSchema from 'amper-schema/dist/objSchema';
import { isObject } from 'amper-utils/dist/objUtils';
import { Stash } from 'amper-utils/dist/types';
import { timeKey } from 'amper-utils/dist/uuidUtils';
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

export interface LoadInfo {
  modified: Stash<number>;
  failed: Stash<string>;
  noData: Stash<boolean>;
}

export interface FileStoreInterface {
  find: (key: string) => Promise<any>;
  findDir: (key: string) => Promise<Stash>;
  update: (key: string, data: any) => Promise<void>;
  remove: (key: string) => Promise<void>;
  removeList: (keys: string[]) => Promise<void>;
  removeDir: (key: string) => Promise<void>;

  windowWrite: (key: string, data: any) => void;

  registerLocalMessageHandler: (msgName: string, handler: (msg: string, payload: any) => void) => void;
  localBroadcast: (msgName: string, payload: any) => void;
}

let FileStore: FileStoreInterface;

export function init(FileStoreIn: FileStoreInterface) {
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

async function validateTable(store: DataStoreInternal, data: any, loadInfo: LoadInfo) {
  if (!store.options.schema) {
    return true;
  }

  const validationErr = ObjSchema.validateFields(store.options.schema, [], data, ObjSchema.VALIDATE_ALL_AND_FILL_DEFAULTS, null, loadInfo.modified);
  if (!validationErr) {
    return true;
  }

  // loaded data does not validate against schema, do not use it
  await FileStore.remove('dsData/' + store.storeName);

  loadInfo.failed[store.storeName] = 'validation';
  delete loadInfo.modified[store.storeName];

  return false;
}

async function cleanupFiles(files: Stash) {
  if (!files) {
    return;
  }
  let removePaths = files.paths;
  if (files.errors) {
    removePaths = removePaths.concat(Object.keys(files.errors));
  }

  await FileStore.removeList(removePaths);
}

async function validateAndApplyData(store: DataStoreInternal, loadedData: any, loadInfo: LoadInfo) {
  if (!loadedData) {
    loadInfo.noData[store.storeName] = true;
    return;
  }
  if (await validateTable(store, loadedData, loadInfo)) {
    if (store.options.isServerSynced) {
      DataStore.changeServerDataAsInternal('replace', [store.storeName], loadedData, undefined);
    }
    DataStore.changeDataAsInternal('replace', [store.storeName], loadedData, null, false, true);
  }
}

async function mergeChanges(store: DataStoreInternal, files: Stash, loadInfo: LoadInfo) {
  const mergeList: MergeData[] = files.objects;
  mergeList.sort(cmpMerges);

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

  if (loadInfo.modified[store.storeName]) {
    const dataToWrite = {
      data: DataStore.getDataUnsafe([store.storeName]),
      lastMerge: store.lastMerge,
    };

    await FileStore.update('dsData/' + store.storeName, dataToWrite);
  }

  await cleanupFiles(files);
}

async function loadDataStoreInternal(store: DataStoreInternal, windowStorage: Stash, loadInfo: LoadInfo) {
  if (store.options.persistType === 'window') {
    await validateAndApplyData(store, windowStorage && windowStorage[store.storeName], loadInfo);
    return;
  }

  let { err: loadError, data: loadedData } = await withError(FileStore.find('dsData/' + store.storeName));
  loadedData = loadedData || {};

  if (loadError) {
    console.log('Failed to load DS data, clearing', { store: store.storeName, err: loadError });

    loadInfo.failed[store.storeName] = 'dsLoad';
    delete loadInfo.modified[store.storeName];
  } else {
    validateAndApplyData(store, loadedData.data, loadInfo);
    store.lastMerge = loadedData.lastMerge;
  }

  let { err: err2, data: files } = await withError(FileStore.findDir('dsMerges/' + store.storeName + '/'));
  files = files || {};
  if (loadInfo.failed[store.storeName]) {
    // store data failed to load, delete the merge files and abort
    return await cleanupFiles(files);
  }

  err2 = err2 || files.errors;
  if (err2) {
    // merges failed to load, reset table and bail out
    console.warn('dsMergeLoadFailed', err2);
    loadInfo.failed[store.storeName] = 'mergeLoad';
    DataStore.resetStoreToDefaultsAsInternal(store.storeName);
    return await cleanupFiles(files);
  }

  await mergeChanges(store, files, loadInfo);
}

export async function loadDataStore(store: DataStoreInternal, windowStorage: Stash, loadInfo: LoadInfo) {
  try {
    await loadDataStoreInternal(store, windowStorage, loadInfo);
  } finally {
    if (store.options.isServerSynced) {
      store.clientChangeTree = null;
      store.serverChangeTree = {};
    }
  }
}

function receiveLocalMerge(_msg: string, mergeData: MergeData) {
  const path = mergeData.path;
  if ((mergeData as Stash).store) {
    // fixup old merges
    path.unshift((mergeData as Stash).store);
  }
  if (DataStore.hasDataStore(path[0])) {
    DataStore.changeDataAsInternal(mergeData.action, path, mergeData.fields);
  }
}

export function initBroadcastHandlers() {
  FileStore.registerLocalMessageHandler('dsMerge', receiveLocalMerge);
}


function makeObjHashKey(obj) {
  if (!isObject(obj)) {
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

  let tk: string;
  if (feedCount !== undefined) {
    tk = [feedCount, 0, 0, 0].join('.');
  } else {
    tk = timeKey();
  }
  const splitTimeKey = tk.split('.');

  const mergeData: MergeData = {
    timeKey: tk,
    timestamp: Number(splitTimeKey[0]) || 0,
    count: Number(splitTimeKey[1]) || 0,
    sessionIdx: Number(splitTimeKey[2]) || 0,
    windowNumber: Number(splitTimeKey[3]) || 0,

    action: action,
    path: path,
    fields: fields,
  };

  let hash = tk;
  if (action === 'update' || action === 'upsert') {
    // for merge updates, hash the field keys so we overwrite previous merges that are now superseded
    hash = makeObjHashKey(fields);
  }
  const fileName = action + '_' + path.join('_') + '_' + hash;
  FileStore.update('dsMerges/' + store.storeName + '/' + fileName, mergeData).then(() => {
    if (!store.options.isServerSynced) {
      FileStore.localBroadcast('dsMerge', mergeData);
    }
  }).catch(() => {});
}

export async function clearPersistedData(store: DataStoreInternal) {
  if (store.options.persistType === 'window') {
    await FileStore.windowWrite(store.storeName, null);
  } else {
    await FileStore.remove('dsData/' + store.storeName);
    await FileStore.removeDir('dsMerges/' + store.storeName + '/');
  }
}
