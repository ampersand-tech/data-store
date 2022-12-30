"use strict";
/**
* Copyright 2018-present Ampersand Technologies, Inc.
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataStoreCache = void 0;
var DataStore = require("./dataStore");
var index_1 = require("amper-promise-utils/dist/index");
var errorUtils_1 = require("amper-utils/dist/errorUtils");
var ObjUtils = require("amper-utils/dist/objUtils");
var DataStoreCache = /** @class */ (function () {
    function DataStoreCache(props) {
        var _this = this;
        this.props = props;
        this.cache = {};
        this.offlineFetches = {};
        this.tryRefetchOffline = function () {
            (0, index_1.withError)(_this.props.refetchOffline.offlineCheck()).then(function (_a) {
                var err = _a.err;
                _this.offlineTimer = undefined;
                if (err) {
                    _this.offlineTimer = setTimeout(_this.tryRefetchOffline, _this.props.refetchOffline.retryTime);
                    return;
                }
                // refetch content
                var offlineFetches = _this.offlineFetches;
                _this.offlineFetches = {};
                for (var id in offlineFetches) {
                    var fetch_1 = offlineFetches[id];
                    _this.getDataWithError(null, fetch_1.key, fetch_1.params);
                }
            });
        };
        DataStore.registerDataStore(null, props.name);
        this.cache[props.name] = {};
    }
    DataStoreCache.prototype.getPath = function (key, params) {
        var paramsPath = this.props.paramsToCachePath(key, params);
        if (!paramsPath) {
            return null;
        }
        return [this.props.name, key].concat(paramsPath);
    };
    DataStoreCache.prototype.onResponse = function (fetchCount, cachePath, params, err, data) {
        var obj = ObjUtils.objectGetFromPath(this.cache, cachePath);
        if (!obj) {
            console.warn('DataStoreCache.onResponse.noObj', { cachePath: cachePath });
            return;
        }
        if (obj.fetchCount !== fetchCount) {
            // new fetch in flight, ignore old results
            return;
        }
        data = ObjUtils.objectMakeImmutable(data);
        var key = cachePath[1];
        var errCallbacks = obj.errCallbacks;
        obj.inFlight = false;
        obj.errCallbacks = [];
        if (this.props.getExpireDelay) {
            obj.expireTime = Date.now() + this.props.getExpireDelay(key);
        }
        else {
            obj.expireTime = Infinity;
        }
        obj.data = data;
        obj.err = err ? (0, errorUtils_1.errorToString)(err, false) : undefined;
        var res = {
            err: obj.err,
            data: data,
        };
        DataStore.replaceDataNoClone(cachePath, res);
        if (err) {
            var errStr = key + ' error: ' + err;
            for (var _i = 0, errCallbacks_1 = errCallbacks; _i < errCallbacks_1.length; _i++) {
                var cb = errCallbacks_1[_i];
                cb(errStr);
            }
        }
        if (this.props.refetchOffline && err && (0, errorUtils_1.errorToString)(err, false) === 'offline') {
            this.offlineFetches[cachePath.join('/')] = { key: key, params: params };
            if (!this.offlineTimer) {
                this.offlineTimer = setTimeout(this.tryRefetchOffline, this.props.refetchOffline.retryTime);
            }
        }
    };
    DataStoreCache.prototype.prefillCache = function (key, params, err, data) {
        var cachePath = this.getPath(key, params);
        if (!cachePath) {
            throw new Error("paramsToCachePath(".concat(key, ") failed"));
        }
        var obj = {
            inFlight: true,
            fetchCount: 1,
            expireTime: 0,
            data: undefined,
            err: undefined,
            errCallbacks: [],
        };
        ObjUtils.objectFillPath(this.cache, cachePath, obj);
        this.onResponse(obj.fetchCount, cachePath, params, err, data);
    };
    // note: errCB gets called ONLY if a fetch gets triggered, so that you don't toast multiple times for the same error
    // if you want to render the error, use the return value instead
    DataStoreCache.prototype.getDataWithError = function (watcher, key, params, errCB) {
        var _this = this;
        var cachePath = this.getPath(key, params);
        if (!cachePath) {
            return {
                err: "paramsToCachePath(".concat(key, ") failed"),
                data: undefined,
            };
        }
        var obj = ObjUtils.objectGetFromPath(this.cache, cachePath);
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
        var isExpired = Date.now() > obj.expireTime;
        var wasOffline = obj.err === 'offline';
        if (!obj.inFlight && (isExpired || wasOffline)) {
            // fetch the data
            obj.inFlight = true;
            obj.errCallbacks = [];
            obj.fetchCount++;
            obj.expireTime = 0;
            (0, index_1.withError)(this.props.fetchData(key, params)).then(function (errdata) {
                _this.onResponse(obj.fetchCount, cachePath, params, errdata.err, errdata.data);
            });
        }
        if (errCB && obj.inFlight && obj.errCallbacks.indexOf(errCB) < 0) {
            obj.errCallbacks.push(errCB);
        }
        var res = DataStore.getData(watcher, cachePath, '*');
        return res || {
            err: undefined,
            data: undefined,
        };
    };
    DataStoreCache.prototype.getData = function (watcher, key, params, subPath, errCB) {
        if (!subPath) {
            return this.getDataWithError(watcher, key, params, errCB).data;
        }
        // trigger the data fetch but don't add a watch
        this.getDataWithError(null, key, params, errCB);
        // now getData with the subPath, adding a watch
        var cachePath = this.getPath(key, params);
        if (!cachePath) {
            return;
        }
        return DataStore.getData(watcher, cachePath.concat('data', subPath), '*');
    };
    DataStoreCache.prototype.invalidateFetchObj = function (obj, cachePath, params, noClear) {
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
        }
        else {
            obj.data = undefined;
            obj.err = undefined;
            DataStore.replaceDataNoClone(cachePath, undefined);
        }
    };
    DataStoreCache.prototype.invalidateAll = function (obj, cachePath, leafDepth, params) {
        if (cachePath.length === leafDepth) {
            return this.invalidateFetchObj(obj, cachePath, params, undefined);
        }
        for (var key in obj) {
            this.invalidateAll(obj[key], cachePath.concat([key]), leafDepth, params);
        }
    };
    DataStoreCache.prototype.invalidate = function (key, params, noClear) {
        var cachePath = this.getPath(key, params);
        if (!cachePath) {
            console.error('invalidateCache invalid key', { key: key });
            return;
        }
        if (!params) {
            this.invalidateAll(this.cache[this.props.name][key], [this.props.name, key], cachePath.length, params);
            return;
        }
        var obj = ObjUtils.objectGetFromPath(this.cache, cachePath);
        if (obj) {
            this.invalidateFetchObj(obj, cachePath, params, noClear);
        }
    };
    DataStoreCache.prototype.clear = function () {
        this.cache[this.props.name] = {};
        DataStore.replaceDataNoClone([this.props.name], {});
    };
    return DataStoreCache;
}());
exports.DataStoreCache = DataStoreCache;
