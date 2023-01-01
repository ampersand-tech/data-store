/**
* Copyright 2017-present Ampersand Technologies, Inc.
*/

import * as DataStore from './dataStore';
import * as DataStoreWatch from './dataStoreWatch';
import { WatcherOpt } from './dataStoreWatch';
import { MergeAction, MergeOptions, typeCheckField } from './objMerge';

import * as ObjSchema from 'amper-schema/dist/objSchema';
import * as SchemaType from 'amper-schema/dist/types';
import * as JsonUtils from 'amper-utils/dist/jsonUtils';
import * as ObjUtils from 'amper-utils/dist/objUtils';
import { Stash } from 'amper-utils/dist/types';

function isScalar(o) {
  return (
    'number' === typeof o || o instanceof String ||
    'string' === typeof o || o instanceof Number ||
    'boolean' === typeof o || o instanceof Boolean
  );
}

function isObject(o) {
  return !isScalar(o) && o !== undefined && o !== null;
}

function cmp(a, b) {
  if (a < b) {
    return -1;
  } else if (a > b) {
    return 1;
  } else {
    return 0;
  }
}

function uniq(a, cmpFunc) {
  let i = 0;
  while (i < a.length - 1) {
    if (0 === cmpFunc(a[i], a[i + 1])) {
      a.splice(i, 1);
    } else {
      i += 1;
    }
  }
}

const DELETE_SENTINEL = Object.freeze({__delete_sentinel: 1});

function addSentinels(o: Stash, original: Stash) {
  if (isScalar(o) || isScalar(original)) {
    return;
  }
  for (const k in original) {
    if (original[k] && !isScalar(original[k])) {
      if (!(k in o)) {
        o[k] = DELETE_SENTINEL;
      } else {
        addSentinels(o[k], original[k]);
      }
    }
  }
}

function merge(a, b) {
  if (b === DELETE_SENTINEL) {
    return b;
  }

  if (a === null || a === undefined) {
    return b;
  }

  if (b === null || b === undefined) {
    return a;
  }

  const aS = isScalar(a);
  const bS = isScalar(b);

  if (aS !== bS) {
    throw new Error("SchemaType don't match " + JsonUtils.safeStringify([a, b]));
  }

  if (aS) {
    return b;
  } else {
    for (const k in b) {
      a[k] = merge(a[k], b[k]);
    }
    return a;
  }
}

function atPath<T>(obj: Stash, path: string[], create: boolean, fn: (o: any, p: string) => T): T {
  let o = obj;
  for (let i = 0; i < path.length - 1; ++i) {
    if (create && !o[path[i]]) {
      o[path[i]] = {};
    }
    o = o[path[i]];
  }

  return fn(o, path[path.length - 1]);
}

function typeCheck(data: any, schema: SchemaType.Schema, keys: string[], options: MergeOptions, action: MergeAction) {
  if (!options.schema) {
    return;
  }

  if (!isScalar(data) && data !== null && data !== undefined) {
    for (const k in data) {
      if (!(SchemaType.isSchemaMapNode(schema)) && !(k in schema)) {
        console.error('Fields contain a key that is not in the schema ' + k, {path: keys.join('/'), fieldValue: data});
      }
    }

    if (action === 'replace') {
      for (const k in schema) {
        if (k !== '_ids' && !schema[k]._nullable && !(k in data)) {
          console.error('Fields missing a non-optional key ' + k, {path: keys.join('/'), fieldValue: data});
        }
      }
    }
  }

  const mergeContext = {
    action,
    clientKey: '',
    options,
    changed: false,
  };
  return typeCheckField(mergeContext, data, null, schema, keys, null);
}

function mergeOverlayData(underlyingData, overlayData, schema) {
  if (overlayData === DELETE_SENTINEL) {
    return {};
  }

  if (SchemaType.isType(schema) || isScalar(underlyingData) || isScalar(overlayData)) {
    if (overlayData !== undefined) {
      return overlayData;
    } else {
      return underlyingData;
    }
  } else if (SchemaType.isSchemaMapNode(schema)) {
    const res = {};
    underlyingData = underlyingData || {};
    overlayData = overlayData || {};

    for (const subKey in underlyingData) {
      if (overlayData[subKey] !== DELETE_SENTINEL) {
        if (subKey in overlayData) {
          res[subKey] = mergeOverlayData(underlyingData[subKey], overlayData[subKey], schema._ids);
        } else {
          res[subKey] = ObjUtils.clone(underlyingData[subKey]);
        }
      }
    }
    for (const subKey in overlayData) {
      if (overlayData[subKey] !== DELETE_SENTINEL && !(subKey in underlyingData)) {
        res[subKey] = ObjUtils.clone(overlayData[subKey]);
      }
    }
    return res;
  } else {
    const isArray = Array.isArray(underlyingData) || Array.isArray(overlayData);
    const res = (isArray ? [] : {});
    underlyingData = underlyingData || (isArray ? [] : {});
    overlayData = overlayData || (isArray ? [] : {});
    for (const subKey in underlyingData) {
      if (overlayData[subKey] !== DELETE_SENTINEL) {
        if (subKey in overlayData) {
          res[subKey] = mergeOverlayData(underlyingData[subKey], overlayData[subKey], schema && schema[subKey]);
        } else {
          res[subKey] = ObjUtils.clone(underlyingData[subKey]);
        }
      }
    }
    for (const subKey in overlayData) {
      if (overlayData[subKey] !== DELETE_SENTINEL && !(subKey in underlyingData)) {
        res[subKey] = ObjUtils.clone(overlayData[subKey]);
      }
    }
    return res;
  }
}

function accumulateChangedSubkeys(rootPath: string[], rootData: any): string[][] {
  const changedPaths: string[][] = [];

  function go(path, data) {
    if (isScalar(data) || data === undefined || data === null || data === DELETE_SENTINEL) {
      changedPaths.push(path);
    } else if (isObject(data)) {
      for (const k in data) {
        const v = data[k];
        go(path.concat(k), v);
      }
    }
  }

  go(rootPath, rootData);

  const comparePaths = (a, b) => cmp(a.join('@'), b.join('@'));

  changedPaths.sort(comparePaths);
  uniq(changedPaths, comparePaths);

  return changedPaths;
}

function isNull(a) {
  return a === undefined || a === null;
}

export class Overlay implements DataStore.IDataStore {
  readonly id = Date.now();
  readonly data: Stash = {};
  watchTracker: DataStoreWatch.WatchTracker;
  backingWatcher: DataStoreWatch.Watcher | null;

  constructor(
    private readonly backingStore: DataStore.IDataStore,
  ) {
    this.watchTracker = DataStoreWatch.createWatchTracker(this, 'Overlay-' + this.id);
    this.backingWatcher = DataStoreWatch.createWatcher(0, this.onBackingStoreChange, true, this.backingStore);
  }

  uninit() {
    if (this.backingWatcher) {
      DataStoreWatch.destroyWatcher(this.backingWatcher);
      this.backingWatcher = null;
    }
  }

  getSchema(path: string[]): any {
    return this.backingStore.getSchema(path);
  }

  getStoreSchema(path: string[]): any {
    return this.backingStore.getSchema(path.slice(0, 1));
  }

  getWatchTracker() {
    return this.watchTracker;
  }

  getOverlayData(path: string[]): any {
    let data = this.data;
    for (const p of path) {
      data = data[p];
      if (!data) {
        break;
      }
    }

    return data;
  }

  getData(watcher: WatcherOpt, path: string[], objMask?: any): any {
    if (DataStoreWatch.isDataWatcher(watcher)) {
      watcher = watcher.getWatcher();
    }

    if (watcher) {
      const watch = DataStoreWatch.findWatch(this, watcher, path, objMask);
      if (watch) {
        watch.count++;
        return watch.data;
      }
    }

    if (objMask && objMask !== '*') {
      const validationError = ObjSchema.validateFields(this.getSchema(path), [], objMask, ObjSchema.VALIDATE_EXISTS, undefined, undefined, false);
      if (validationError) {
        console.error('Overlay objMask does not match schema', {objMask, path, err: validationError});
      }
    }

    const underlyingData = this.backingStore.getData(this.backingWatcher, path, objMask);
    let overlayData = this.getOverlayData(path);

    let data: any = null;
    if (!isNull(underlyingData) || !isNull(overlayData)) {
      const res = mergeOverlayData(underlyingData, overlayData, this.getSchema(path));
      if (objMask) {
        data = DataStore.cloneWithMask(res, objMask, res);
      } else {
        data = res;
      }
    }

    data = ObjUtils.objectMakeImmutable(data);

    if (watcher && !watcher.readOnly) {
      DataStoreWatch.addWatchInternal(this, watcher, path, objMask, undefined, data);
    }
    return data;
  }

  createData(path: string[], data: any): void {
    const underlyingData = this.backingStore.getData(null, path, 1);
    const overlayData = this.getOverlayData(path);
    if (underlyingData && (overlayData !== undefined || overlayData !== null) && overlayData !== DELETE_SENTINEL) {
      console.error('Cannot create data.  Data exists in backing store', {path});
    }

    const schema = this.getSchema(path);
    typeCheck(data, schema, path, {schema: this.getStoreSchema(path)}, 'update');

    atPath(this.data, path, true, (d, p) => {
      if (d[p] && d[p] !== DELETE_SENTINEL) {
        console.error('Cannot createData.  Data already exists there', {path});
      }
      d[p] = ObjUtils.clone(data);
    });

    this.triggerWatches(path);
  }

  replaceData(path: string[], data: any): void {
    const schema = this.getSchema(path);
    typeCheck(data, schema, path, {schema: this.getStoreSchema(path)}, 'replace');

    if (path.length) {
      atPath(this.data, path, true, (d, p) => {
        d[p] = ObjUtils.clone(data);

        const oldData = this.backingStore.getData(null, path, '*');
        addSentinels(d[p], oldData);
      });

    } else {
      for (const k of Object.keys(this.data)) {
        delete this.data[k];
      }
      for (const k in data) {
        this.data[k] = ObjUtils.clone(data[k]);
      }
    }

    this.triggerWatches(path);
  }

  updateData(path: string[], data: any): void {
    const schema = this.getSchema(path);
    typeCheck(data, schema, path, {schema: this.getStoreSchema(path)}, 'update');
    atPath(this.data, path, true, (d, p) => {
      if (isScalar(data) || data === null || data === undefined) {
        d[p] = data;
      } else {
        if (!(p in d)) {
          d[p] = {};
        }
        merge(d[p], ObjUtils.clone(data));
      }
    });
    this.triggerWatches(path);
  }

  removeData(path: string[]): void {
    if (this.getStoreSchema(path)) {
      if (SchemaType.isSchemaMapNode(this.getSchema(path.slice(0, -1)))) {
        // ok
      } else if (!this.getSchema(path)._nullable) {
        console.error('Cannot remove non-nullable key');
      }
    }

    atPath(this.data, path, true, (d, p) => {
      d[p] = DELETE_SENTINEL;
    });

    this.triggerWatches(path);
  }

  resetData(path?: string[]): void {
    if (!path) {
      const changedPaths = accumulateChangedSubkeys([], this.data);

      for (const k of Object.keys(this.data)) {
        delete this.data[k];
      }

      for (const changedP of changedPaths) {
        this.triggerWatches(changedP);
      }
      return;
    }

    let d = this.data;
    for (let i = 0; i < path.length - 1; ++i) {
      if (!d[path[i]]) {
        return;
      }
      d = d[path[i]];
    }
    const p = path[path.length - 1];

    if (d) {
      const changedPaths = accumulateChangedSubkeys(path, d[p]);
      delete d[p];
      for (const changedPath of changedPaths) {
        this.triggerWatches(changedPath);
      }
    }
  }

  hasChanges(watcher: WatcherOpt, path: string[]): boolean {
    // watch everything necessary
    this.getData(watcher, path, '*');

    let o = this.data;
    for (let i = 0; i < path.length; ++i) {
      if (path[i] in o) {
        o = o[path[i]];
      } else {
        return false;
      }
    }

    function go(obj, orig) {
      if (obj === DELETE_SENTINEL) {
        return true;
      }

      if (!isObject(obj)) {
        return obj !== orig;
      }

      for (const k in obj) {
        if (!(k in orig)) {
          return true;
        }
        if (go(obj[k], orig[k])) {
          return true;
        }
      }
      return false;
    }

    const origData = this.backingStore.getData(this.backingWatcher, path, '*');
    return go(o, origData);
  }

  private onBackingStoreChange = (_watcher: DataStoreWatch.Watcher, changes: DataStoreWatch.Change[]) => {
    for (const change of changes) {
      this.triggerWatches(change.path);
    }
  }

  private triggerWatches(path: string[]): void {
    let obj = this.watchTracker.changeTree as Stash;
    for (const key of path) {
      if (obj._force) {
        break;
      }
      if (!obj[key]) {
        obj[key] = {};
      }
      obj = obj[key];
    }
    obj._force = true;

    DataStoreWatch.addToPending(this.watchTracker);
    DataStoreWatch.triggerWatchesNextFrame();
  }
}
