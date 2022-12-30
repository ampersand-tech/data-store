"use strict";
/**
* Copyright 2017-present Ampersand Technologies, Inc.
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
exports.clearPersistedData = exports.persistChange = exports.initBroadcastHandlers = exports.loadDataStore = exports.getFileStore = exports.init = void 0;
var DataStore = require("./dataStore");
var index_1 = require("amper-promise-utils/dist/index");
var ObjSchema = require("amper-schema/dist/objSchema");
var objUtils_1 = require("amper-utils/dist/objUtils");
var uuidUtils_1 = require("amper-utils/dist/uuidUtils");
var md5 = require("blueimp-md5");
var FileStore;
function init(FileStoreIn) {
    FileStore = FileStoreIn;
}
exports.init = init;
function getFileStore() {
    return FileStore;
}
exports.getFileStore = getFileStore;
function cmpMerges(a, b) {
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
function validateTable(store, data, loadInfo) {
    return __awaiter(this, void 0, void 0, function () {
        var validationErr;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!store.options.schema) {
                        return [2 /*return*/, true];
                    }
                    validationErr = ObjSchema.validateFields(store.options.schema, [], data, ObjSchema.VALIDATE_ALL_AND_FILL_DEFAULTS, null, loadInfo.modified);
                    if (!validationErr) {
                        return [2 /*return*/, true];
                    }
                    // loaded data does not validate against schema, do not use it
                    return [4 /*yield*/, FileStore.remove('dsData/' + store.storeName)];
                case 1:
                    // loaded data does not validate against schema, do not use it
                    _a.sent();
                    loadInfo.failed[store.storeName] = 'validation';
                    delete loadInfo.modified[store.storeName];
                    return [2 /*return*/, false];
            }
        });
    });
}
function cleanupFiles(files) {
    return __awaiter(this, void 0, void 0, function () {
        var removePaths;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!files) {
                        return [2 /*return*/];
                    }
                    removePaths = files.paths;
                    if (files.errors) {
                        removePaths = removePaths.concat(Object.keys(files.errors));
                    }
                    return [4 /*yield*/, FileStore.removeList(removePaths)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function validateAndApplyData(store, loadedData, loadInfo) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!loadedData) {
                        loadInfo.noData[store.storeName] = true;
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, validateTable(store, loadedData, loadInfo)];
                case 1:
                    if (_a.sent()) {
                        if (store.options.isServerSynced) {
                            DataStore.changeServerDataAsInternal('replace', [store.storeName], loadedData, undefined);
                        }
                        DataStore.changeDataAsInternal('replace', [store.storeName], loadedData, null, false, true);
                    }
                    return [2 /*return*/];
            }
        });
    });
}
function mergeChanges(store, files, loadInfo) {
    return __awaiter(this, void 0, void 0, function () {
        var mergeList, startIdx, i, mergeData, i, mergeData, dataToWrite;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mergeList = files.objects;
                    mergeList.sort(cmpMerges);
                    startIdx = 0;
                    for (i = mergeList.length - 1; i >= 0; --i) {
                        mergeData = mergeList[i];
                        if (store.options.isServerSynced && store.lastMerge && cmpMerges(mergeData, store.lastMerge) <= 0) {
                            // already applied, happens with multiple windows if one window has a pending sync while another is in mergeChanges
                            startIdx = i + 1;
                            break;
                        }
                        if (mergeData.store) {
                            // fixup old merge files
                            mergeData.path.unshift(mergeData.store);
                            delete mergeData.store;
                        }
                        if (mergeData.path.length === 1 && mergeData.action === 'replace') {
                            // found root-level replace, ignore all merges older than this one
                            startIdx = i;
                            break;
                        }
                    }
                    // apply merges
                    for (i = startIdx; i < mergeList.length; ++i) {
                        mergeData = mergeList[i];
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
                    if (!loadInfo.modified[store.storeName]) return [3 /*break*/, 2];
                    dataToWrite = {
                        data: DataStore.getDataUnsafe([store.storeName]),
                        lastMerge: store.lastMerge,
                    };
                    return [4 /*yield*/, FileStore.update('dsData/' + store.storeName, dataToWrite)];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [4 /*yield*/, cleanupFiles(files)];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function loadDataStoreInternal(store, windowStorage, loadInfo) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, loadError, loadedData, _b, err2, files;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!(store.options.persistType === 'window')) return [3 /*break*/, 2];
                    return [4 /*yield*/, validateAndApplyData(store, windowStorage && windowStorage[store.storeName], loadInfo)];
                case 1:
                    _c.sent();
                    return [2 /*return*/];
                case 2: return [4 /*yield*/, (0, index_1.withError)(FileStore.find('dsData/' + store.storeName))];
                case 3:
                    _a = _c.sent(), loadError = _a.err, loadedData = _a.data;
                    loadedData = loadedData || {};
                    if (loadError) {
                        console.log('Failed to load DS data, clearing', { store: store.storeName, err: loadError });
                        loadInfo.failed[store.storeName] = 'dsLoad';
                        delete loadInfo.modified[store.storeName];
                    }
                    else {
                        validateAndApplyData(store, loadedData.data, loadInfo);
                        store.lastMerge = loadedData.lastMerge;
                    }
                    return [4 /*yield*/, (0, index_1.withError)(FileStore.findDir('dsMerges/' + store.storeName + '/'))];
                case 4:
                    _b = _c.sent(), err2 = _b.err, files = _b.data;
                    files = files || { paths: [], objects: [] };
                    if (!loadInfo.failed[store.storeName]) return [3 /*break*/, 6];
                    return [4 /*yield*/, cleanupFiles(files)];
                case 5: 
                // store data failed to load, delete the merge files and abort
                return [2 /*return*/, _c.sent()];
                case 6:
                    err2 = err2 || files.errors;
                    if (!err2) return [3 /*break*/, 8];
                    // merges failed to load, reset table and bail out
                    console.warn('dsMergeLoadFailed', err2);
                    loadInfo.failed[store.storeName] = 'mergeLoad';
                    DataStore.resetStoreToDefaultsAsInternal(store.storeName);
                    return [4 /*yield*/, cleanupFiles(files)];
                case 7: return [2 /*return*/, _c.sent()];
                case 8: return [4 /*yield*/, mergeChanges(store, files, loadInfo)];
                case 9:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function loadDataStore(store, windowStorage, loadInfo) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, , 2, 3]);
                    return [4 /*yield*/, loadDataStoreInternal(store, windowStorage, loadInfo)];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    if (store.options.isServerSynced) {
                        store.clientChangeTree = null;
                        store.serverChangeTree = {};
                    }
                    return [7 /*endfinally*/];
                case 3: return [2 /*return*/];
            }
        });
    });
}
exports.loadDataStore = loadDataStore;
function receiveLocalMerge(_msg, mergeData) {
    var path = mergeData.path;
    if (mergeData.store) {
        // fixup old merges
        path.unshift(mergeData.store);
    }
    if (DataStore.hasDataStore(path[0])) {
        DataStore.changeDataAsInternal(mergeData.action, path, mergeData.fields);
    }
}
function initBroadcastHandlers() {
    FileStore.registerLocalMessageHandler('dsMerge', receiveLocalMerge);
}
exports.initBroadcastHandlers = initBroadcastHandlers;
function makeObjHashKey(obj) {
    if (!(0, objUtils_1.isObject)(obj)) {
        return '1';
    }
    var keys = Object.keys(obj).sort();
    return md5(keys.join());
}
function persistChange(store, action, path, fields, feedCount) {
    if (store.options.persistType === 'window') {
        // no merge files for window storage, just write out directly
        FileStore.windowWrite(store.storeName, DataStore.getDataUnsafe([store.storeName]));
        return;
    }
    var tk;
    if (feedCount !== undefined) {
        tk = [feedCount, 0, 0, 0].join('.');
    }
    else {
        tk = (0, uuidUtils_1.timeKey)();
    }
    var splitTimeKey = tk.split('.');
    var mergeData = {
        timeKey: tk,
        timestamp: Number(splitTimeKey[0]) || 0,
        count: Number(splitTimeKey[1]) || 0,
        sessionIdx: Number(splitTimeKey[2]) || 0,
        windowNumber: Number(splitTimeKey[3]) || 0,
        action: action,
        path: path,
        fields: fields,
    };
    var hash = tk;
    if (action === 'update' || action === 'upsert') {
        // for merge updates, hash the field keys so we overwrite previous merges that are now superseded
        hash = makeObjHashKey(fields);
    }
    var fileName = action + '_' + path.join('_') + '_' + hash;
    FileStore.update('dsMerges/' + store.storeName + '/' + fileName, mergeData).then(function () {
        if (!store.options.isServerSynced) {
            FileStore.localBroadcast('dsMerge', mergeData);
        }
    }).catch(function () { });
}
exports.persistChange = persistChange;
function clearPersistedData(store) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(store.options.persistType === 'window')) return [3 /*break*/, 2];
                    return [4 /*yield*/, FileStore.windowWrite(store.storeName, null)];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 2: return [4 /*yield*/, FileStore.remove('dsData/' + store.storeName)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, FileStore.removeDir('dsMerges/' + store.storeName + '/')];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5: return [2 /*return*/];
            }
        });
    });
}
exports.clearPersistedData = clearPersistedData;
