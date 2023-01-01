"use strict";
/**
* Copyright 2017-present Ampersand Technologies, Inc.
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.Overlay = void 0;
var DataStore = require("./dataStore");
var DataStoreWatch = require("./dataStoreWatch");
var objMerge_1 = require("./objMerge");
var ObjSchema = require("amper-schema/dist/objSchema");
var SchemaType = require("amper-schema/dist/types");
var JsonUtils = require("amper-utils/dist/jsonUtils");
var ObjUtils = require("amper-utils/dist/objUtils");
function isScalar(o) {
    return ('number' === typeof o || o instanceof String ||
        'string' === typeof o || o instanceof Number ||
        'boolean' === typeof o || o instanceof Boolean);
}
function isObject(o) {
    return !isScalar(o) && o !== undefined && o !== null;
}
function cmp(a, b) {
    if (a < b) {
        return -1;
    }
    else if (a > b) {
        return 1;
    }
    else {
        return 0;
    }
}
function uniq(a, cmpFunc) {
    var i = 0;
    while (i < a.length - 1) {
        if (0 === cmpFunc(a[i], a[i + 1])) {
            a.splice(i, 1);
        }
        else {
            i += 1;
        }
    }
}
var DELETE_SENTINEL = Object.freeze({ __delete_sentinel: 1 });
function addSentinels(o, original) {
    if (isScalar(o) || isScalar(original)) {
        return;
    }
    for (var k in original) {
        if (original[k] && !isScalar(original[k])) {
            if (!(k in o)) {
                o[k] = DELETE_SENTINEL;
            }
            else {
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
    var aS = isScalar(a);
    var bS = isScalar(b);
    if (aS !== bS) {
        throw new Error("SchemaType don't match " + JsonUtils.safeStringify([a, b]));
    }
    if (aS) {
        return b;
    }
    else {
        for (var k in b) {
            a[k] = merge(a[k], b[k]);
        }
        return a;
    }
}
function atPath(obj, path, create, fn) {
    var o = obj;
    for (var i = 0; i < path.length - 1; ++i) {
        if (create && !o[path[i]]) {
            o[path[i]] = {};
        }
        o = o[path[i]];
    }
    return fn(o, path[path.length - 1]);
}
function typeCheck(data, schema, keys, options, action) {
    if (!options.schema) {
        return;
    }
    if (!isScalar(data) && data !== null && data !== undefined) {
        for (var k in data) {
            if (!(SchemaType.isSchemaMapNode(schema)) && !(k in schema)) {
                console.error('Fields contain a key that is not in the schema ' + k, { path: keys.join('/'), fieldValue: data });
            }
        }
        if (action === 'replace') {
            for (var k in schema) {
                if (k !== '_ids' && !schema[k]._nullable && !(k in data)) {
                    console.error('Fields missing a non-optional key ' + k, { path: keys.join('/'), fieldValue: data });
                }
            }
        }
    }
    var mergeContext = {
        action: action,
        clientKey: '',
        options: options,
        changed: false,
    };
    return (0, objMerge_1.typeCheckField)(mergeContext, data, null, schema, keys, null);
}
function mergeOverlayData(underlyingData, overlayData, schema) {
    if (overlayData === DELETE_SENTINEL) {
        return {};
    }
    if (SchemaType.isType(schema) || isScalar(underlyingData) || isScalar(overlayData)) {
        if (overlayData !== undefined) {
            return overlayData;
        }
        else {
            return underlyingData;
        }
    }
    else if (SchemaType.isSchemaMapNode(schema)) {
        var res = {};
        underlyingData = underlyingData || {};
        overlayData = overlayData || {};
        for (var subKey in underlyingData) {
            if (overlayData[subKey] !== DELETE_SENTINEL) {
                if (subKey in overlayData) {
                    res[subKey] = mergeOverlayData(underlyingData[subKey], overlayData[subKey], schema._ids);
                }
                else {
                    res[subKey] = ObjUtils.clone(underlyingData[subKey]);
                }
            }
        }
        for (var subKey in overlayData) {
            if (overlayData[subKey] !== DELETE_SENTINEL && !(subKey in underlyingData)) {
                res[subKey] = ObjUtils.clone(overlayData[subKey]);
            }
        }
        return res;
    }
    else {
        var isArray = Array.isArray(underlyingData) || Array.isArray(overlayData);
        var res = (isArray ? [] : {});
        underlyingData = underlyingData || (isArray ? [] : {});
        overlayData = overlayData || (isArray ? [] : {});
        for (var subKey in underlyingData) {
            if (overlayData[subKey] !== DELETE_SENTINEL) {
                if (subKey in overlayData) {
                    res[subKey] = mergeOverlayData(underlyingData[subKey], overlayData[subKey], schema && schema[subKey]);
                }
                else {
                    res[subKey] = ObjUtils.clone(underlyingData[subKey]);
                }
            }
        }
        for (var subKey in overlayData) {
            if (overlayData[subKey] !== DELETE_SENTINEL && !(subKey in underlyingData)) {
                res[subKey] = ObjUtils.clone(overlayData[subKey]);
            }
        }
        return res;
    }
}
function accumulateChangedSubkeys(rootPath, rootData) {
    var changedPaths = [];
    function go(path, data) {
        if (isScalar(data) || data === undefined || data === null || data === DELETE_SENTINEL) {
            changedPaths.push(path);
        }
        else if (isObject(data)) {
            for (var k in data) {
                var v = data[k];
                go(path.concat(k), v);
            }
        }
    }
    go(rootPath, rootData);
    var comparePaths = function (a, b) { return cmp(a.join('@'), b.join('@')); };
    changedPaths.sort(comparePaths);
    uniq(changedPaths, comparePaths);
    return changedPaths;
}
function isNull(a) {
    return a === undefined || a === null;
}
var Overlay = /** @class */ (function () {
    function Overlay(backingStore) {
        var _this = this;
        this.backingStore = backingStore;
        this.id = Date.now();
        this.data = {};
        this.onBackingStoreChange = function (_watcher, changes) {
            for (var _i = 0, changes_1 = changes; _i < changes_1.length; _i++) {
                var change = changes_1[_i];
                _this.triggerWatches(change.path);
            }
        };
        this.watchTracker = DataStoreWatch.createWatchTracker(this, 'Overlay-' + this.id);
        this.backingWatcher = DataStoreWatch.createWatcher(0, this.onBackingStoreChange, true, this.backingStore);
    }
    Overlay.prototype.uninit = function () {
        if (this.backingWatcher) {
            DataStoreWatch.destroyWatcher(this.backingWatcher);
            this.backingWatcher = null;
        }
    };
    Overlay.prototype.getSchema = function (path) {
        return this.backingStore.getSchema(path);
    };
    Overlay.prototype.getStoreSchema = function (path) {
        return this.backingStore.getSchema(path.slice(0, 1));
    };
    Overlay.prototype.getWatchTracker = function () {
        return this.watchTracker;
    };
    Overlay.prototype.getOverlayData = function (path) {
        var data = this.data;
        for (var _i = 0, path_1 = path; _i < path_1.length; _i++) {
            var p = path_1[_i];
            data = data[p];
            if (!data) {
                break;
            }
        }
        return data;
    };
    Overlay.prototype.getData = function (watcher, path, objMask) {
        if (DataStoreWatch.isDataWatcher(watcher)) {
            watcher = watcher.getWatcher();
        }
        if (watcher) {
            var watch = DataStoreWatch.findWatch(this, watcher, path, objMask);
            if (watch) {
                watch.count++;
                return watch.data;
            }
        }
        if (objMask && objMask !== '*') {
            var validationError = ObjSchema.validateFields(this.getSchema(path), [], objMask, ObjSchema.VALIDATE_EXISTS, undefined, undefined, false);
            if (validationError) {
                console.error('Overlay objMask does not match schema', { objMask: objMask, path: path, err: validationError });
            }
        }
        var underlyingData = this.backingStore.getData(this.backingWatcher, path, objMask);
        var overlayData = this.getOverlayData(path);
        var data = null;
        if (!isNull(underlyingData) || !isNull(overlayData)) {
            var res = mergeOverlayData(underlyingData, overlayData, this.getSchema(path));
            if (objMask) {
                data = DataStore.cloneWithMask(res, objMask, res);
            }
            else {
                data = res;
            }
        }
        data = ObjUtils.objectMakeImmutable(data);
        if (watcher && !watcher.readOnly) {
            DataStoreWatch.addWatchInternal(this, watcher, path, objMask, undefined, data);
        }
        return data;
    };
    Overlay.prototype.createData = function (path, data) {
        var underlyingData = this.backingStore.getData(null, path, 1);
        var overlayData = this.getOverlayData(path);
        if (underlyingData && (overlayData !== undefined || overlayData !== null) && overlayData !== DELETE_SENTINEL) {
            console.error('Cannot create data.  Data exists in backing store', { path: path });
        }
        var schema = this.getSchema(path);
        typeCheck(data, schema, path, { schema: this.getStoreSchema(path) }, 'update');
        atPath(this.data, path, true, function (d, p) {
            if (d[p] && d[p] !== DELETE_SENTINEL) {
                console.error('Cannot createData.  Data already exists there', { path: path });
            }
            d[p] = ObjUtils.clone(data);
        });
        this.triggerWatches(path);
    };
    Overlay.prototype.replaceData = function (path, data) {
        var _this = this;
        var schema = this.getSchema(path);
        typeCheck(data, schema, path, { schema: this.getStoreSchema(path) }, 'replace');
        if (path.length) {
            atPath(this.data, path, true, function (d, p) {
                d[p] = ObjUtils.clone(data);
                var oldData = _this.backingStore.getData(null, path, '*');
                addSentinels(d[p], oldData);
            });
        }
        else {
            for (var _i = 0, _a = Object.keys(this.data); _i < _a.length; _i++) {
                var k = _a[_i];
                delete this.data[k];
            }
            for (var k in data) {
                this.data[k] = ObjUtils.clone(data[k]);
            }
        }
        this.triggerWatches(path);
    };
    Overlay.prototype.updateData = function (path, data) {
        var schema = this.getSchema(path);
        typeCheck(data, schema, path, { schema: this.getStoreSchema(path) }, 'update');
        atPath(this.data, path, true, function (d, p) {
            if (isScalar(data) || data === null || data === undefined) {
                d[p] = data;
            }
            else {
                if (!(p in d)) {
                    d[p] = {};
                }
                merge(d[p], ObjUtils.clone(data));
            }
        });
        this.triggerWatches(path);
    };
    Overlay.prototype.removeData = function (path) {
        if (this.getStoreSchema(path)) {
            if (SchemaType.isSchemaMapNode(this.getSchema(path.slice(0, -1)))) {
                // ok
            }
            else if (!this.getSchema(path)._nullable) {
                console.error('Cannot remove non-nullable key');
            }
        }
        atPath(this.data, path, true, function (d, p) {
            d[p] = DELETE_SENTINEL;
        });
        this.triggerWatches(path);
    };
    Overlay.prototype.resetData = function (path) {
        if (!path) {
            var changedPaths = accumulateChangedSubkeys([], this.data);
            for (var _i = 0, _a = Object.keys(this.data); _i < _a.length; _i++) {
                var k = _a[_i];
                delete this.data[k];
            }
            for (var _b = 0, changedPaths_1 = changedPaths; _b < changedPaths_1.length; _b++) {
                var changedP = changedPaths_1[_b];
                this.triggerWatches(changedP);
            }
            return;
        }
        var d = this.data;
        for (var i = 0; i < path.length - 1; ++i) {
            if (!d[path[i]]) {
                return;
            }
            d = d[path[i]];
        }
        var p = path[path.length - 1];
        if (d) {
            var changedPaths = accumulateChangedSubkeys(path, d[p]);
            delete d[p];
            for (var _c = 0, changedPaths_2 = changedPaths; _c < changedPaths_2.length; _c++) {
                var changedPath = changedPaths_2[_c];
                this.triggerWatches(changedPath);
            }
        }
    };
    Overlay.prototype.hasChanges = function (watcher, path) {
        // watch everything necessary
        this.getData(watcher, path, '*');
        var o = this.data;
        for (var i = 0; i < path.length; ++i) {
            if (path[i] in o) {
                o = o[path[i]];
            }
            else {
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
            for (var k in obj) {
                if (!(k in orig)) {
                    return true;
                }
                if (go(obj[k], orig[k])) {
                    return true;
                }
            }
            return false;
        }
        var origData = this.backingStore.getData(this.backingWatcher, path, '*');
        return go(o, origData);
    };
    Overlay.prototype.triggerWatches = function (path) {
        var obj = this.watchTracker.changeTree;
        for (var _i = 0, path_2 = path; _i < path_2.length; _i++) {
            var key = path_2[_i];
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
    };
    return Overlay;
}());
exports.Overlay = Overlay;
