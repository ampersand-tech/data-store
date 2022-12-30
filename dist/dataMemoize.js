"use strict";
/**
* Copyright 2015-present Ampersand Technologies, Inc.
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoize = void 0;
var DataStore = require("./dataStore");
var DataStoreWatch = require("./dataStoreWatch");
var functionUtils_1 = require("amper-utils/dist/functionUtils");
var ObjUtils = require("amper-utils/dist/objUtils");
DataStore.registerDataStore(module, 'MemoizedData', {
    allowSubobjectCreate: true,
});
var gUidCounter = 0;
var gWatchers = {};
var gDataDirty = {};
function dirtyMemoizedData(path, func, args, watcher) {
    if (DataStore.hasWatches(path)) {
        // data has watches, so update it right away
        args[0] = watcher;
        memoizeData(path, func, args);
    }
    else {
        // otherwise just mark it dirty
        ObjUtils.objectFillPath(gDataDirty, path, true);
    }
}
function memoizeData(path, func, args) {
    var watcher = args[0];
    DataStoreWatch.resetWatches(watcher);
    var data = func.apply(undefined, args);
    DataStoreWatch.pruneUnusedWatches(watcher);
    ObjUtils.objectFillPath(gDataDirty, path, false);
    DataStore.replaceData(path, data);
}
function getMemoizedData(uid, func, args, argNames) {
    var clientWatcher = args[0];
    var path = ['MemoizedData', uid];
    for (var i = 1; i < argNames.length; ++i) {
        path.push(args[i] || 'null');
    }
    var watcher = ObjUtils.objectGetFromPath(gWatchers, path);
    var isDirty = ObjUtils.objectGetFromPath(gDataDirty, path);
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
// tslint:enable:max-line-length
function memoize(func) {
    var uid = (gUidCounter++).toString();
    var argNames = (0, functionUtils_1.getFunctionParamNames)(func);
    if (argNames[0] !== 'watcher') {
        throw new Error('first argument to memoized function must be "watcher"');
    }
    var memoizedFunc = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return getMemoizedData(uid, func, args, argNames);
    };
    memoizedFunc.isMyChange = function (change) {
        return change.path[1] === uid;
    };
    return memoizedFunc;
}
exports.memoize = memoize;
