"use strict";
/**
* Copyright 2015-present Ampersand Technologies, Inc.
*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.test = exports.removeDataNoClone = exports.replaceDataNoClone = exports.upsertDataNoClone = exports.updateDataNoClone = exports.createDataNoClone = exports.removeData = exports.replaceData = exports.upsertData = exports.updateData = exports.createData = exports.getSchema = exports.removeCodeWatch = exports.addCodeWatch = exports.addWatch = exports.hasAnyWatches = exports.hasWatches = exports.toggleBool = exports.changeData = exports.changeDataNoClone = exports.changeDataAsInternal = exports.changeServerData = exports.changeServerDataAsInternal = exports.resetClientToServer = exports.resetServerChangeTree = exports.getServerDataUnsafe = exports.getDataNoOverlay = exports.getData = exports.getDataUnsafe = exports.hasData = exports.hasDataStore = exports.resetStoreToDefaultsAsInternal = exports.resetToDefaults = exports.loadDataStores = exports.registerDataStore = exports.validateMask = exports.getWatchTracker = exports.init = exports.ALL_MASK = exports.IDS_MASK = void 0;
var DataStorePersist = require("./dataStorePersist");
var DataStoreWatch = require("./dataStoreWatch");
var ObjMerge = require("./objMerge");
var amper_promise_utils_1 = require("amper-promise-utils");
var ObjSchema = require("amper-schema/dist/objSchema");
var ObjUtils = require("amper-utils/dist/objUtils");
var CHECK_IMMUTABLE_MASK = process.env.NODE_ENV === 'development';
var CHECK_UNMASKED_SIZE = process.env.NODE_ENV === 'development';
var MAX_CLONE_FIELDS = 20;
var VALID_OPTIONS = ObjUtils.objectMakeImmutable({
    schema: 1,
    isServerSynced: 1,
    allowSubobjectCreate: 1,
    persistType: 1,
    futureFeed: 1,
});
exports.IDS_MASK = ObjUtils.objectMakeImmutable({ _ids: 1 });
exports.ALL_MASK = '*';
function cloneWithMask(obj, objMask, defaults) {
    if (objMask === exports.IDS_MASK && obj && typeof obj === 'object') {
        // fast path for IDS_MASK
        var out = {};
        for (var key in obj) {
            out[key] = 1;
        }
        Object.freeze(out);
        return out;
    }
    return ObjUtils.cloneSomeFieldsImmutable(obj, objMask, defaults);
}
var gDataStores = {};
var gDataLoaded = false;
var gWatchTracker;
var gCodeWatchers = [];
var gDebug = {
    ds: {},
    dss: {},
};
function init(params) {
    DataStoreWatch.init(params.requestAnimationFrame, params.isTestClient);
    if (params.debugObj) {
        ObjUtils.copyFields(gDebug, params.debugObj);
        gDebug = params.debugObj;
    }
}
exports.init = init;
function getWatchTracker() {
    if (!gWatchTracker) {
        gWatchTracker = DataStoreWatch.createWatchTracker(module.exports, 'DataStore');
    }
    return gWatchTracker;
}
exports.getWatchTracker = getWatchTracker;
function validateMask(funcName, path, objMask) {
    if (objMask && CHECK_IMMUTABLE_MASK && (typeof (objMask) === 'object') && !Object.isFrozen(objMask)) {
        console.error(funcName + ' called with mutable mask', { path: path });
    }
}
exports.validateMask = validateMask;
function registerDataStore(theModule, storeName, options, optData) {
    if (gDataStores[storeName]) {
        if (theModule && theModule.hot) {
            // ignore dup register calls if hot reloading
            return;
        }
        console.error('DataStore.registerDataStore duplicate store', { storeName: storeName });
        return;
    }
    options = options || {};
    for (var opt in options) {
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
            console.error('DataStore.registerDataStore invalid persistType', { storeName: storeName, persistType: options.persistType });
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
    var watchTracker = getWatchTracker();
    watchTracker.changeTree[storeName] = {};
    var store = {
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
exports.registerDataStore = registerDataStore;
function loadDataStores() {
    return __awaiter(this, void 0, void 0, function () {
        var loadInfo, _a, err, windowStorage, _b, _c, _d, _i, storeName, store;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (gDataLoaded) {
                        throw new Error('already loaded');
                    }
                    gDataLoaded = true;
                    loadInfo = {
                        modified: {},
                        failed: {},
                        noData: {},
                    };
                    return [4 /*yield*/, (0, amper_promise_utils_1.withError)(DataStorePersist.getFileStore().windowReadAll())];
                case 1:
                    _a = _e.sent(), err = _a.err, windowStorage = _a.data;
                    if (err) {
                        console.error('loadDataStores.windowReadAll.error', { err: err });
                    }
                    _b = gDataStores;
                    _c = [];
                    for (_d in _b)
                        _c.push(_d);
                    _i = 0;
                    _e.label = 2;
                case 2:
                    if (!(_i < _c.length)) return [3 /*break*/, 5];
                    _d = _c[_i];
                    if (!(_d in _b)) return [3 /*break*/, 4];
                    storeName = _d;
                    store = gDataStores[storeName];
                    if (!store.options.persistType) return [3 /*break*/, 4];
                    return [4 /*yield*/, DataStorePersist.loadDataStore(store, windowStorage, loadInfo)];
                case 3:
                    _e.sent();
                    _e.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    DataStorePersist.initBroadcastHandlers();
                    DataStoreWatch.triggerWatchesNextFrame();
                    return [2 /*return*/, loadInfo];
            }
        });
    });
}
exports.loadDataStores = loadDataStores;
function resetToDefaults(path) {
    var storeName = path[0];
    var store = gDataStores[storeName];
    if (!store) {
        console.error('DataStore.resetToDefaults called with unknown storeName', { storeName: storeName });
        return;
    }
    if (!store.options.schema) {
        console.error('store cannot resetToDefaults without schema', { storeName: storeName });
        return;
    }
    var schema = store.options.schema;
    if (path.length > 1) {
        schema = ObjSchema.getSchemaForPath(schema, path.slice(1));
    }
    changeData('replace', path, ObjSchema.getDefaultValuesForSchema(schema));
}
exports.resetToDefaults = resetToDefaults;
function resetStoreToDefaultsAsInternal(storeName) {
    return __awaiter(this, void 0, void 0, function () {
        var store, defaults;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    store = gDataStores[storeName];
                    if (!store) {
                        console.error('DataStore.resetStoreToDefaultsAsInternal called with unknown storeName', { storeName: storeName });
                        return [2 /*return*/];
                    }
                    defaults = store.options.schema ? ObjSchema.getDefaultValuesForSchema(store.options.schema) : {};
                    if (store.options.isServerSynced) {
                        changeServerDataAsInternal('replace', [storeName], defaults);
                        store.serverChangeTree = {};
                    }
                    changeDataAsInternal('replace', [storeName], defaults);
                    store.clientChangeTree = null;
                    if (!store.options.persistType) return [3 /*break*/, 2];
                    return [4 /*yield*/, DataStorePersist.clearPersistedData(store)];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    });
}
exports.resetStoreToDefaultsAsInternal = resetStoreToDefaultsAsInternal;
function hasDataStore(storeName) {
    return !!gDataStores[storeName];
}
exports.hasDataStore = hasDataStore;
function hasData(path) {
    return getDataUnsafe(path) !== undefined;
}
exports.hasData = hasData;
function getDataUnsafe(path) {
    var storeName = path[0];
    var store = gDataStores[storeName];
    if (!store) {
        console.error('DataStore.getDataUnsafe called with unknown storeName', { storeName: storeName });
        return undefined;
    }
    return ObjUtils.objectGetFromPath(store.data, path.slice(1));
}
exports.getDataUnsafe = getDataUnsafe;
function getData(watcherIn, path, objMask, defaults) {
    // handle DataWatcher
    var watcher = DataStoreWatch.isDataWatcher(watcherIn) ? watcherIn.getWatcher() : watcherIn;
    if (watcher && watcher.dataStore !== module.exports) {
        // handle custom dataStore
        return watcher.getData(path, objMask, defaults);
    }
    return getDataNoOverlay(watcher, path, objMask, defaults);
}
exports.getData = getData;
function getDataNoOverlay(watcherIn, path, objMask, defaults) {
    var storeName = path[0];
    var store = gDataStores[storeName];
    if (!store) {
        console.error('DataStore.getData called with unknown storeName', { storeName: storeName });
        return defaults;
    }
    validateMask('DataStore.getData', path, objMask);
    // handle DataWatcher
    var watcher = DataStoreWatch.isDataWatcher(watcherIn) ? watcherIn.getWatcher() : watcherIn;
    if (watcher) {
        var watch = DataStoreWatch.findWatch(module.exports, watcher, path, objMask);
        if (watch) {
            watch.count++;
            return watch.data;
        }
    }
    if (store.options.schema && objMask && objMask !== '*') {
        var validationErr = ObjSchema.validateFields(store.options.schema, path, objMask, ObjSchema.VALIDATE_EXISTS);
        if (validationErr) {
            console.error('DataStore objMask does not match schema', { err: validationErr, path: path, objMask: objMask });
        }
    }
    var obj = ObjUtils.objectGetFromPath(store.data, path.slice(1));
    var data = cloneWithMask(obj, objMask, defaults);
    if (!objMask && CHECK_UNMASKED_SIZE) {
        var count = ObjUtils.fieldCount(data);
        if (count > MAX_CLONE_FIELDS) {
            console.warn('DataStore.getData called on a large object', { path: path.join('/'), fieldCount: count });
        }
    }
    if (watcher && !watcher.readOnly) {
        DataStoreWatch.addWatchInternal(module.exports, watcher, path, objMask, defaults, data);
    }
    return data;
}
exports.getDataNoOverlay = getDataNoOverlay;
function getServerDataUnsafe(path) {
    var storeName = path[0];
    var store = gDataStores[storeName];
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
exports.getServerDataUnsafe = getServerDataUnsafe;
function resetServerChangeTree(storeName) {
    var store = gDataStores[storeName];
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
exports.resetServerChangeTree = resetServerChangeTree;
function mergeChangeTree(dst, src, needClone) {
    if (needClone === void 0) { needClone = false; }
    if (dst._force) {
        return;
    }
    if (src._force) {
        dst._force = true;
        return;
    }
    for (var key in src) {
        if (dst[key]) {
            mergeChangeTree(dst[key], src[key], needClone);
        }
        else {
            dst[key] = needClone ? ObjUtils.clone(src[key]) : src[key];
        }
    }
}
function cloneChanged(dst, src, changeTree) {
    if (changeTree._force || !dst || !src) {
        return ObjUtils.clone(src);
    }
    for (var key in changeTree) {
        if (src.hasOwnProperty(key)) {
            dst[key] = cloneChanged(dst[key], src[key], changeTree[key]);
        }
        else {
            delete dst[key];
        }
    }
    return dst;
}
function resetClientToServer(storeName, force) {
    if (force === void 0) { force = false; }
    var store = gDataStores[storeName];
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
    var watchTracker = getWatchTracker();
    var changeTree = watchTracker.changeTree[storeName];
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
exports.resetClientToServer = resetClientToServer;
function resetAll() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b, _c, _i, storeName;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _a = gDataStores;
                    _b = [];
                    for (_c in _a)
                        _b.push(_c);
                    _i = 0;
                    _d.label = 1;
                case 1:
                    if (!(_i < _b.length)) return [3 /*break*/, 4];
                    _c = _b[_i];
                    if (!(_c in _a)) return [3 /*break*/, 3];
                    storeName = _c;
                    return [4 /*yield*/, resetStoreToDefaultsAsInternal(storeName)];
                case 2:
                    _d.sent();
                    _d.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function changeServerDataInternal(store, action, path, fields, feedCount) {
    return ObjMerge.applyActionNoClone(store.serverData, action, path.slice(1), fields, feedCount, store.options, false, store.serverChangeTree);
}
function changeServerDataAsInternal(action, path, fields, feedCount) {
    var storeName = path[0];
    var store = gDataStores[storeName];
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
exports.changeServerDataAsInternal = changeServerDataAsInternal;
function shouldPersist(store, action, path, didChange) {
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
function changeServerData(action, path, fields, feedCount) {
    var storeName = path[0];
    var store = gDataStores[storeName];
    if (!store) {
        console.error('DataStore not found', { storeName: storeName });
        return false;
    }
    if (!store.options.isServerSynced) {
        console.error('DataStore is not server synced', { storeName: storeName });
        return false;
    }
    var didChange = changeServerDataInternal(store, action, path, ObjUtils.clone(fields), feedCount);
    if (shouldPersist(store, action, path, didChange)) {
        DataStorePersist.persistChange(store, action, path, fields, feedCount);
    }
    return didChange;
}
exports.changeServerData = changeServerData;
function changeDataInternal(store, action, path, fields, clientKey, allowSubobjectCreate, noWatchTrigger) {
    if (allowSubobjectCreate === void 0) { allowSubobjectCreate = false; }
    if (noWatchTrigger === void 0) { noWatchTrigger = false; }
    // applyAction modifies changeTree
    var watchTracker = getWatchTracker();
    var changeTree = watchTracker.changeTree[store.storeName];
    allowSubobjectCreate = allowSubobjectCreate || store.options.allowSubobjectCreate || false;
    var changed = ObjMerge.applyActionNoClone(store.data, action, path.slice(1), fields, clientKey, store.options, allowSubobjectCreate, changeTree);
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
function changeDataAsInternal(action, path, fields, clientKey, allowSubobjectCreate, noWatchTrigger) {
    if (allowSubobjectCreate === void 0) { allowSubobjectCreate = false; }
    if (noWatchTrigger === void 0) { noWatchTrigger = false; }
    var storeName = path[0];
    var store = gDataStores[storeName];
    if (!store) {
        console.error('DataStore not found', { storeName: storeName });
        return false;
    }
    return changeDataInternal(store, action, path, ObjUtils.clone(fields), clientKey, allowSubobjectCreate, noWatchTrigger);
}
exports.changeDataAsInternal = changeDataAsInternal;
function changeDataNoClone(action, path, fields, clientKey, allowSubobjectCreate, noWatchTrigger) {
    if (allowSubobjectCreate === void 0) { allowSubobjectCreate = false; }
    if (noWatchTrigger === void 0) { noWatchTrigger = false; }
    var storeName = path[0];
    var store = gDataStores[storeName];
    if (!store) {
        console.error('DataStore not found', { storeName: storeName });
        return false;
    }
    if (store.options.isServerSynced) {
        console.error('DataStore.changeData called on server synced store', { storeName: storeName });
        return false;
    }
    var didChange = changeDataInternal(store, action, path, fields, clientKey, allowSubobjectCreate, noWatchTrigger);
    if (!store.options.isServerSynced && shouldPersist(store, action, path, didChange)) {
        DataStorePersist.persistChange(store, action, path, fields);
    }
    return didChange;
}
exports.changeDataNoClone = changeDataNoClone;
function changeData(action, path, fields, clientKey, allowSubobjectCreate, noWatchTrigger) {
    return changeDataNoClone(action, path, ObjUtils.clone(fields), clientKey, allowSubobjectCreate, noWatchTrigger);
}
exports.changeData = changeData;
// Returns what the bool WAS set to (as if you called getData).
function toggleBool(path) {
    var bool = getDataUnsafe(path);
    if (typeof bool !== 'boolean') {
        console.error('DataStore.toggleBool called on non-bool', { path: path });
        return;
    }
    changeDataNoClone('replace', path, !bool);
    return bool;
}
exports.toggleBool = toggleBool;
function hasWatches(path) {
    var watchTracker = getWatchTracker();
    return DataStoreWatch.hasWatchesInTree(watchTracker.watchTree, path) || DataStoreWatch.hasWatchesInTree(watchTracker.watchTreeImmediate, path);
}
exports.hasWatches = hasWatches;
function hasAnyWatchesRecur(obj) {
    if (!obj) {
        return false;
    }
    if (DataStoreWatch.countWatches(obj)) {
        return true;
    }
    for (var key in obj) {
        if (hasAnyWatchesRecur(obj[key])) {
            return true;
        }
    }
    return false;
}
function hasAnyWatches(storeName) {
    var watchTracker = getWatchTracker();
    return hasAnyWatchesRecur(watchTracker.watchTree[storeName]) || hasAnyWatchesRecur(watchTracker.watchTreeImmediate[storeName]);
}
exports.hasAnyWatches = hasAnyWatches;
function addWatch(watcherIn, path, objMask, defaults) {
    validateMask('DataStore.addWatch', path, objMask);
    // handle DataWatcher
    var watcher = DataStoreWatch.isDataWatcher(watcherIn) ? watcherIn.getWatcher() : watcherIn;
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
exports.addWatch = addWatch;
function triggerCodeWatch(watcher, changes) {
    if (!watcher._codeWatchCB) {
        return;
    }
    for (var i = 0; i < changes.length; ++i) {
        watcher._codeWatchCB(changes[i].data);
    }
}
function addCodeWatch(path, objMask, priority, cb) {
    var watcher = DataStoreWatch.createWatcher(priority, triggerCodeWatch);
    watcher._pathStr = path.join('/');
    watcher._objMask = objMask;
    watcher._codeWatchCB = cb;
    gCodeWatchers.push(watcher);
    return addWatch(watcher, path, objMask, undefined);
}
exports.addCodeWatch = addCodeWatch;
function removeCodeWatch(path, objMask, cb) {
    var dbWatchKey = path.join('/');
    for (var i = gCodeWatchers.length - 1; i >= 0; --i) {
        var watcher = gCodeWatchers[i];
        if (watcher._pathStr === dbWatchKey && watcher._objMask === objMask && watcher._codeWatchCB === cb) {
            DataStoreWatch.destroyWatcher(watcher);
            gCodeWatchers.splice(i, 1);
        }
    }
}
exports.removeCodeWatch = removeCodeWatch;
function getSchema(path) {
    var storeName = path[0], rest = path.slice(1);
    var store = gDataStores[storeName];
    if (!store) {
        console.error('DataStore not found', { storeName: storeName });
        return null;
    }
    if (!store.options.schema) {
        return undefined;
    }
    return ObjSchema.getSchemaForPath(store.options.schema, rest);
}
exports.getSchema = getSchema;
function wrapChangeData(func, action) {
    return function (path, fields) {
        return func(action, path, fields);
    };
}
exports.createData = wrapChangeData(changeData, 'create');
exports.updateData = wrapChangeData(changeData, 'update');
exports.upsertData = wrapChangeData(changeData, 'upsert');
exports.replaceData = wrapChangeData(changeData, 'replace');
exports.removeData = wrapChangeData(changeData, 'remove');
exports.createDataNoClone = wrapChangeData(changeDataNoClone, 'create');
exports.updateDataNoClone = wrapChangeData(changeDataNoClone, 'update');
exports.upsertDataNoClone = wrapChangeData(changeDataNoClone, 'upsert');
exports.replaceDataNoClone = wrapChangeData(changeDataNoClone, 'replace');
exports.removeDataNoClone = wrapChangeData(changeDataNoClone, 'remove');
exports.test = {
    getDataStore: function (storeName) {
        return gDataStores[storeName];
    },
    resetAll: resetAll,
    changeData: function (action, path, fields, feedCount) {
        var storeName = path[0];
        var store = gDataStores[storeName];
        if (!store) {
            console.error('DataStore.test.changeData called with unknown storeName', { storeName: storeName });
            return false;
        }
        if (store.options.isServerSynced) {
            var ret = changeServerDataAsInternal(action, path, fields, feedCount);
            resetClientToServer(path[0], true);
            return ret;
        }
        return changeDataAsInternal(action, path, fields, feedCount);
    },
};
