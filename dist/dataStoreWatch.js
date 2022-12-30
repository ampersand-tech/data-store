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
exports.hasWatchesInTree = exports.countWatches = exports.getTriggeredWatches = exports.destroyDataReactor = exports.createDataReactor = exports.destroyWatcher = exports.pruneUnusedWatches = exports.resetWatches = exports.removeWatch = exports.findWatch = exports.addWatchInternal = exports.createWatcher = exports.flushWatches = exports.triggerWatchesNextFrame = exports.addToPending = exports.createWatchTracker = exports.isDataWatcher = exports.init = void 0;
var DataStore = require("./dataStore");
var dataStore_1 = require("./dataStore");
var objUtils_1 = require("amper-utils/dist/objUtils");
var ResolvablePromise = /** @class */ (function () {
    function ResolvablePromise() {
        var _this = this;
        this.promise = new Promise(function (resolve, reject) {
            _this.resolve = resolve;
            _this.reject = reject;
        });
    }
    return ResolvablePromise;
}());
var gPendingTriggers = [];
var gWatchRafHandle = null;
var gFlushWatchesPromise;
var gWatcherCount = 0;
var requestAnimationFrame = requestAnimationFrameDefault;
var gIsTestClient = false;
function requestAnimationFrameDefault(cb) {
    return setTimeout(cb, 0);
}
function init(requestAnimationFrameIn, isTestClient) {
    requestAnimationFrame = requestAnimationFrameIn || requestAnimationFrameDefault;
    gIsTestClient = Boolean(isTestClient);
}
exports.init = init;
function isWatchTreeNode(node, key) {
    return Boolean(node && key !== '_watches');
}
function isDataWatcher(watcher) {
    return Boolean(watcher && watcher.getWatcher);
}
exports.isDataWatcher = isDataWatcher;
function createWatchTracker(dataStore, id) {
    var tracker = {
        id: id,
        dataStore: dataStore,
        changeTree: {},
        watchTree: {},
        watchTreeImmediate: {},
    };
    return tracker;
}
exports.createWatchTracker = createWatchTracker;
function addToPending(tracker) {
    if (tracker && gPendingTriggers.indexOf(tracker) < 0) {
        gPendingTriggers.push(tracker);
    }
}
exports.addToPending = addToPending;
function triggerWatchesNextFrame() {
    if (!gPendingTriggers.length) {
        var p = gFlushWatchesPromise;
        gFlushWatchesPromise = null;
        p && p.resolve();
        return;
    }
    triggerWatches(gPendingTriggers, true);
    if (gWatchRafHandle) {
        return;
    }
    gWatchRafHandle = requestAnimationFrame(function () {
        var pendingTriggers = gPendingTriggers;
        gPendingTriggers = [];
        gWatchRafHandle = null;
        var flushP = gFlushWatchesPromise;
        gFlushWatchesPromise = null;
        triggerWatches(pendingTriggers, false);
        flushP && flushP.resolve();
    });
}
exports.triggerWatchesNextFrame = triggerWatchesNextFrame;
function flushWatches() {
    return __awaiter(this, void 0, void 0, function () {
        var p;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (gFlushWatchesPromise) {
                        throw ('only one flushWatches call is supported at a time');
                    }
                    if (!gPendingTriggers.length) {
                        return [2 /*return*/];
                    }
                    p = gFlushWatchesPromise = new ResolvablePromise();
                    triggerWatchesNextFrame();
                    return [4 /*yield*/, p.promise];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
exports.flushWatches = flushWatches;
function createWatcher(priority, triggerCB, triggerImmediate, dataStore) {
    if (triggerImmediate === void 0) { triggerImmediate = false; }
    dataStore = dataStore || DataStore;
    priority = priority || 0;
    var watcher = {
        watcherID: gWatcherCount++,
        priority: priority,
        triggerImmediate: !!triggerImmediate || priority < 0,
        triggerCB: triggerCB,
        watches: [],
        readOnly: false,
        dataStore: dataStore,
        // convenience functions
        getData: function (path, objMask, defaults) {
            return dataStore.getData(watcher, path, objMask, defaults);
        },
    };
    return watcher;
}
exports.createWatcher = createWatcher;
function addToWatchTree(watchTree, path, watch) {
    var obj = watchTree;
    for (var i = 0; i < path.length; ++i) {
        var key = path[i];
        obj[key] = obj[key] || {};
        obj = obj[key];
    }
    obj._watches = obj._watches || [];
    obj._watches.push(watch);
}
function addWatchInternal(dataStore, watcher, path, objMask, defaults, data) {
    if (watcher.readOnly) {
        console.error('addWatchInternal called on readOnly watcher', { path: path });
        return null;
    }
    var watch = {
        watcher: watcher,
        dataStore: dataStore,
        path: path,
        pathDepth: path.length,
        pathStr: path.join('/'),
        multiData: path.indexOf('_ids') >= 0 || path.indexOf('_idxs') >= 0,
        data: data,
        objMask: objMask,
        defaults: defaults,
        count: 1,
        didChange: false,
    };
    watcher.watches.push(watch);
    var tracker = dataStore.getWatchTracker();
    addToWatchTree(watcher.triggerImmediate ? tracker.watchTreeImmediate : tracker.watchTree, path, watch);
    return watch;
}
exports.addWatchInternal = addWatchInternal;
function findWatch(dataStore, watcher, path, objMask) {
    var pathStr = path.join('/');
    for (var i = 0; i < watcher.watches.length; ++i) {
        var watch = watcher.watches[i];
        if (watch.pathStr === pathStr && watch.objMask === objMask && watch.dataStore === dataStore) {
            return watch;
        }
    }
    return null;
}
exports.findWatch = findWatch;
function removeWatch(watcher, path, objMask) {
    var pathStr = path.join('/');
    for (var i = watcher.watches.length - 1; i >= 0; --i) {
        var watch = watcher.watches[i];
        if (watch.pathStr === pathStr && watch.objMask === objMask) {
            watcher.watches.splice(i, 1);
            // mark the watch as invalidated
            watch.watcher = null;
        }
    }
}
exports.removeWatch = removeWatch;
function resetWatches(watcher) {
    for (var i = 0; i < watcher.watches.length; ++i) {
        watcher.watches[i].count = 0;
    }
    watcher.readOnly = false;
}
exports.resetWatches = resetWatches;
function pruneUnusedWatches(watcher) {
    for (var i = watcher.watches.length - 1; i >= 0; --i) {
        var watch = watcher.watches[i];
        if (watch.count === 0) {
            watcher.watches.splice(i, 1);
            // mark the watch as invalidated
            watch.watcher = null;
        }
        else {
            // reset didChange flag
            watch.didChange = false;
        }
    }
    watcher.readOnly = true;
}
exports.pruneUnusedWatches = pruneUnusedWatches;
function destroyWatcher(watcher) {
    for (var i = 0; i < watcher.watches.length; ++i) {
        var watch = watcher.watches[i];
        // mark the watch as invalidated
        watch.watcher = null;
    }
    watcher.watches = [];
}
exports.destroyWatcher = destroyWatcher;
function reactorTrigger(handle, func, watcher, changes) {
    if (handle.watcher !== watcher) {
        return;
    }
    resetWatches(watcher);
    func(watcher, changes);
    pruneUnusedWatches(watcher);
}
function createDataReactor(priority, func, triggerImmediate) {
    if (triggerImmediate === void 0) { triggerImmediate = false; }
    var handle = {
        watcher: null,
    };
    var trigger = reactorTrigger.bind(null, handle, func);
    handle.watcher = createWatcher(priority, trigger, triggerImmediate);
    trigger(handle.watcher, []);
    return handle;
}
exports.createDataReactor = createDataReactor;
function destroyDataReactor(handle) {
    if (handle.watcher) {
        destroyWatcher(handle.watcher);
        handle.watcher = null;
    }
}
exports.destroyDataReactor = destroyDataReactor;
function walkWatchTree(dataStore, watchTree, changeTree, path, triggeredWatches, testInfo) {
    var changeTreeKeys = Object.keys(changeTree);
    if (!changeTreeKeys.length) {
        return true;
    }
    var watches = watchTree._watches;
    // process watches in this branch
    if (watches) {
        for (var i = watches.length - 1; i >= 0; --i) {
            var watch = watches[i];
            if (!watch.watcher) {
                // destroyed watch
                watches.splice(i, 1);
                if (!watches.length) {
                    delete watchTree._watches;
                }
                continue;
            }
            if (!watch.multiData && watch.objMask === dataStore_1.IDS_MASK) {
                var idsChanged = changeTree._force;
                for (var _i = 0, changeTreeKeys_1 = changeTreeKeys; _i < changeTreeKeys_1.length; _i++) {
                    var key = changeTreeKeys_1[_i];
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
    var hasActiveBranches = true;
    function walkSubTree(childKey, subChangeTree, subPath) {
        var subWatcherTree = watchTree[childKey];
        if (subChangeTree !== undefined && !walkWatchTree(dataStore, subWatcherTree, subChangeTree, subPath, triggeredWatches, testInfo)) {
            // subWatcherTree has no watches in it anymore, prune the branch from watchTree
            delete watchTree[childKey];
        }
        else {
            hasActiveBranches = true;
        }
    }
    // Walk down the change map, unless we hit _force, at which point we just stay there so we always process that part of tree
    for (var key in watchTree) {
        if (key === '_watches') {
            continue;
        }
        if (key === '_ids' || key === '_idxs') {
            if (changeTree._force) {
                var dataKeys = dataStore.getData(null, path, dataStore_1.IDS_MASK);
                for (var subKey in dataKeys) {
                    walkSubTree(key, changeTree, path.concat([subKey]));
                }
            }
            else {
                for (var _a = 0, changeTreeKeys_2 = changeTreeKeys; _a < changeTreeKeys_2.length; _a++) {
                    var subKey = changeTreeKeys_2[_a];
                    walkSubTree(key, changeTree[subKey], path.concat([subKey]));
                }
            }
        }
        else {
            walkSubTree(key, changeTree._force ? changeTree : changeTree[key], path.concat([key]));
        }
    }
    return hasActiveBranches || watchTree._watches && watchTree._watches.length;
}
function cmpActiveTriggers(a, b) {
    var delta = a.priority - b.priority;
    if (delta) {
        return delta;
    }
    // sort in creation order so that react elements created earlier (ie higher in the tree) get triggered first
    return a.watcher.watcherID - b.watcher.watcherID;
}
function cmpChanges(a, b) {
    return a.pathDepth - b.pathDepth;
}
function getTriggeredWatches(trackers, triggerImmediate, testInfo) {
    // gather triggered watchers for each store
    var triggeredWatches = [];
    for (var _i = 0, trackers_1 = trackers; _i < trackers_1.length; _i++) {
        var tracker = trackers_1[_i];
        // Walk the changes map and record any watches that match in triggeredWatches
        walkWatchTree(tracker.dataStore, triggerImmediate ? tracker.watchTreeImmediate : tracker.watchTree, tracker.changeTree, [], triggeredWatches, testInfo);
        // TODO CD: This is not very performant for immediate triggers, but hopefully there aren't many of them?
        // The alternative is to perhaps have a separate changeTree for immedate triggers.
        if (!triggerImmediate) {
            // clear processed changes map
            for (var storeName in tracker.changeTree) {
                tracker.changeTree[storeName] = {};
            }
        }
    }
    // check if triggeredWatches data actually changed, and if so, record it in the 'changes' array on a trigger for the watcher
    var activeTriggers = [];
    var activeTriggersByID = {};
    var changeCount = 0;
    for (var _a = 0, triggeredWatches_1 = triggeredWatches; _a < triggeredWatches_1.length; _a++) {
        var triggered = triggeredWatches_1[_a];
        var watch = triggered.watch;
        var startTime = Date.now();
        var changed = true;
        var newData = watch.dataStore.getData(null, triggered.path, watch.objMask, watch.defaults);
        if (watch.multiData) {
            testInfo && testInfo.push({ watch: watch });
        }
        else {
            // need to do a compare to make sure only changed fields in the mask trigger a change
            // also the replace action will trigger changes where they didn't necessarily happen
            changed = !(0, objUtils_1.deepCompare)(watch.data, newData);
            if (changed) {
                watch.data = newData;
            }
            testInfo && testInfo.push({ watch: watch, changed: changed });
        }
        var deltaTime = Date.now() - startTime;
        if (deltaTime > 50 && !gIsTestClient && !testInfo) {
            console.warn('triggerWatches.slowClone', { path: watch.path, mask: watch.objMask, dataKeys: (0, objUtils_1.isObject)(newData) ? Object.keys(newData) : newData });
        }
        if (!changed) {
            continue;
        }
        if (!watch.watcher) {
            // invalid watch
            console.error('getTriggeredWatches.invalidWatcher', watch);
            continue;
        }
        watch.didChange = true;
        var trigger = activeTriggersByID[watch.watcher.watcherID];
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
        var change = {
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
    activeTriggers.sort(cmpActiveTriggers);
    return activeTriggers;
}
exports.getTriggeredWatches = getTriggeredWatches;
function triggerWatches(trackers, triggerImmediate) {
    var activeTriggers = getTriggeredWatches(trackers, triggerImmediate, null);
    // call trigger callbacks for watchers that have changes
    for (var i = 0; i < activeTriggers.length; ++i) {
        var watcher = activeTriggers[i].watcher;
        var changes = activeTriggers[i].changes;
        if (changes.length) {
            changes.sort(cmpChanges);
            watcher.triggerCB(watcher, changes);
        }
    }
}
function countWatches(obj) {
    if (!obj || !obj._watches) {
        return 0;
    }
    for (var i = obj._watches.length - 1; i >= 0; --i) {
        var watch = obj._watches[i];
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
exports.countWatches = countWatches;
function hasWatchesInTree(watchTree, path) {
    var obj = watchTree;
    if (countWatches(obj)) {
        return true;
    }
    for (var i = 0; i < path.length; ++i) {
        var key = path[i];
        var tmp = obj[key];
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
exports.hasWatchesInTree = hasWatchesInTree;
