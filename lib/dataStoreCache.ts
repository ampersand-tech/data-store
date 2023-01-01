/**
* Copyright 2018-present Ampersand Technologies, Inc.
*/

import * as DataStore from './dataStore';

import { withError } from 'amper-promise-utils/dist/index';
import { errorToString } from 'amper-utils/dist/errorUtils';
import * as ObjUtils from 'amper-utils/dist/objUtils';
import { ErrDataCB, ErrorType, Stash } from 'amper-utils/dist/types';

interface CachedData<DataType> {
  inFlight: boolean;
  fetchCount: number;
  expireTime: number;
  data: DataType|undefined;
  err: string|undefined;
  errCallbacks: ErrDataCB<any>[];
}

export interface StoredData<DataType> {
  data: DataType|undefined;
  err: string|undefined;
}

interface Props<DataType, ParamsType> {
  name: string;
  fetchData: (key: string, params: ParamsType) => Promise<DataType>;
  paramsToCachePath: (key: string, params: ParamsType) => string[] | undefined;
  getExpireDelay?: (key: string) => number;
  refetchOffline?: {
    offlineCheck: () => Promise<any>;
    retryTime: number;
  };
}

export class DataStoreCache<DataType, ParamsType> {
  private cache: Stash = {};
  private offlineFetches: Stash<{ key: string, params: ParamsType }> = {};
  private offlineTimer: any;

  constructor(readonly props: Props<DataType, ParamsType>) {
    DataStore.registerDataStore(null, props.name);
    this.cache[props.name] = {};
  }

  getPath(key: string, params: ParamsType) {
    const paramsPath = this.props.paramsToCachePath(key, params);
    if (!paramsPath) {
      return null;
    }
    return [this.props.name, key].concat(paramsPath);
  }

  private tryRefetchOffline = () => {
    withError(this.props.refetchOffline!.offlineCheck()).then(({err}) => {
      this.offlineTimer = undefined;

      if (err) {
        this.offlineTimer = setTimeout(this.tryRefetchOffline, this.props.refetchOffline!.retryTime);
        return;
      }

      // refetch content
      const offlineFetches = this.offlineFetches;
      this.offlineFetches = {};
      for (const id in offlineFetches) {
        const fetch = offlineFetches[id];
        this.getDataWithError(null, fetch.key, fetch.params);
      }
    });
  }

  private onResponse(fetchCount: number, cachePath: string[], params: ParamsType, err: ErrorType, data: DataType|undefined) {
    const obj = ObjUtils.objectGetFromPath(this.cache, cachePath) as CachedData<DataType>|undefined;
    if (!obj) {
      console.warn('DataStoreCache.onResponse.noObj', { cachePath });
      return;
    }

    if (obj.fetchCount !== fetchCount) {
      // new fetch in flight, ignore old results
      return;
    }

    data = ObjUtils.objectMakeImmutable(data);

    const key = cachePath[1];
    const errCallbacks = obj.errCallbacks;

    obj.inFlight = false;
    obj.errCallbacks = [];
    if (this.props.getExpireDelay) {
      obj.expireTime = Date.now() + this.props.getExpireDelay(key);
    } else {
      obj.expireTime = Infinity;
    }
    obj.data = data;
    obj.err = err ? errorToString(err, false) : undefined;

    const res: StoredData<DataType> = {
      err: obj.err,
      data: data,
    };
    DataStore.replaceDataNoClone(cachePath, res);

    if (err) {
      const errStr = key + ' error: ' + err;
      for (const cb of errCallbacks) {
        cb(errStr);
      }
    }

    if (this.props.refetchOffline && err && errorToString(err, false) === 'offline') {
      this.offlineFetches[cachePath.join('/')] = { key, params };
      if (!this.offlineTimer) {
        this.offlineTimer = setTimeout(this.tryRefetchOffline, this.props.refetchOffline.retryTime);
      }
    }
  }

  prefillCache(key: string, params: ParamsType, err: ErrorType, data: DataType|undefined) {
    const cachePath = this.getPath(key, params);
    if (!cachePath) {
      throw new Error(`paramsToCachePath(${key}) failed`);
    }

    const obj = {
      inFlight: true,
      fetchCount: 1,
      expireTime: 0,
      data: undefined,
      err: undefined,
      errCallbacks: [],
    };
    ObjUtils.objectFillPath(this.cache, cachePath, obj);

    this.onResponse(obj.fetchCount, cachePath, params, err, data);
  }

  // note: errCB gets called ONLY if a fetch gets triggered, so that you don't toast multiple times for the same error
  // if you want to render the error, use the return value instead
  getDataWithError(watcher: DataStore.WatcherOpt, key: string, params: ParamsType, errCB?: ErrDataCB<any>): StoredData<DataType> {
    const cachePath = this.getPath(key, params);
    if (!cachePath) {
      return {
        err: `paramsToCachePath(${key}) failed`,
        data: undefined,
      };
    }

    let obj = ObjUtils.objectGetFromPath(this.cache, cachePath) as CachedData<DataType>|undefined;

    if (!obj) {
      obj = {
        inFlight: false,
        fetchCount: 0,
        expireTime: 0,
        data: undefined,
        err: undefined,
        errCallbacks: [],
      };
      ObjUtils.objectFillPath(this.cache, cachePath, obj);
    }

    const isExpired = Date.now() > obj.expireTime;
    const wasOffline = obj.err === 'offline';
    if (!obj.inFlight && (isExpired || wasOffline)) {
      // fetch the data
      obj.inFlight = true;
      obj.errCallbacks = [];
      obj.fetchCount++;
      obj.expireTime = 0;

      withError(this.props.fetchData(key, params)).then(errdata => {
        this.onResponse(obj!.fetchCount, cachePath, params, errdata.err, errdata.data);
      });
    }

    if (errCB && obj.inFlight && obj.errCallbacks.indexOf(errCB) < 0) {
      obj.errCallbacks.push(errCB);
    }

    const res = DataStore.getData(watcher, cachePath, '*') as StoredData<DataType> | undefined;
    return res || {
      err: undefined,
      data: undefined,
    };
  }

  getData(watcher: DataStore.WatcherOpt, key: string, params: ParamsType, subPath?: string[], errCB?: ErrDataCB<any>) {
    if (!subPath) {
      return this.getDataWithError(watcher, key, params, errCB).data;
    }

    // trigger the data fetch but don't add a watch
    this.getDataWithError(null, key, params, errCB);

    // now getData with the subPath, adding a watch
    const cachePath = this.getPath(key, params);
    if (!cachePath) {
      return;
    }
    return DataStore.getData(watcher, cachePath.concat('data', subPath), '*');
  }

  private invalidateFetchObj(obj: CachedData<DataType>, cachePath: string[], params: ParamsType, noClear?: boolean) {
    if (obj.inFlight) {
      // increment fetchCount so in-flight results get ignored
      obj.inFlight = false;
      obj.errCallbacks = [];
      obj.fetchCount++;
    }

    obj.expireTime = 0;

    if (noClear) {
      // trigger a refetch manually, since no watches will fire without clearing the data
      this.getDataWithError(null, cachePath[1], params);
    } else {
      obj.data = undefined;
      obj.err = undefined;

      DataStore.replaceDataNoClone(cachePath, undefined);
    }
  }

  private invalidateAll(obj: CachedData<DataType>, cachePath: string[], leafDepth: number, params: ParamsType) {
    if (cachePath.length === leafDepth) {
      return this.invalidateFetchObj(obj, cachePath, params, undefined);
    }

    for (const key in obj) {
      this.invalidateAll(obj[key], cachePath.concat([key]), leafDepth, params);
    }
  }

  invalidate(key: string, params: ParamsType, noClear?: boolean) {
    const cachePath = this.getPath(key, params);
    if (!cachePath) {
      console.error('invalidateCache invalid key', { key });
      return;
    }

    if (!params) {
      this.invalidateAll(this.cache[this.props.name][key], [this.props.name, key], cachePath.length, params);
      return;
    }

    const obj = ObjUtils.objectGetFromPath(this.cache, cachePath);
    if (obj) {
      this.invalidateFetchObj(obj, cachePath, params, noClear);
    }
  }

  clear() {
    this.cache[this.props.name] = {};
    DataStore.replaceDataNoClone([this.props.name], {});
  }
}
