"use strict";
/*
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
exports.test = exports.invalidateServerData = exports.getServerData = exports.getServerDataWithError = exports.svrCmdToPath = exports.init = void 0;
var dataStoreCache_1 = require("./dataStoreCache");
var SchemaType = require("amper-schema/dist/types");
var DEFAULT_SVRCMD_EXPIRE = 15 * 60 * 1000;
var gSvrCmds = {};
var gCache = new dataStoreCache_1.DataStoreCache({
    name: 'DataServerCmd',
    fetchData: runSvrCmd,
    paramsToCachePath: paramsToCachePath,
    getExpireDelay: function (cmdName) {
        if (gSvrCmds[cmdName]) {
            return gSvrCmds[cmdName].expireDelay;
        }
        return Infinity;
    },
});
function registerSvrCmd(cmdName, paramTypes, expireDelay) {
    if (gSvrCmds.hasOwnProperty(cmdName)) {
        console.error('DataStore.registerSvrCmd duplicate cmd', { cmdName: cmdName });
        return;
    }
    var paramNames = Object.keys(paramTypes);
    for (var _i = 0, paramNames_1 = paramNames; _i < paramNames_1.length; _i++) {
        var paramName = paramNames_1[_i];
        var type = paramTypes[paramName];
        if (!type._validateType) {
            console.error('DataStore.registerSvrCmd invalid param type', { cmdName: cmdName, paramName: paramName });
            return;
        }
        var typeStr = type.toString();
        if (typeStr === 'OBJECT' || typeStr === 'ARRAY' || typeStr === 'BINSTR') {
            console.error('DataStore.registerSvrCmd invalid param type', { cmdName: cmdName, paramName: paramName, type: typeStr });
            return;
        }
    }
    gSvrCmds[cmdName] = {
        paramNames: paramNames,
        paramTypes: paramTypes,
        expireDelay: expireDelay || DEFAULT_SVRCMD_EXPIRE,
    };
}
var gSvrCmd = null;
function runSvrCmd(cmd, params) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!gSvrCmd) {
                        throw new Error('dataServerCmd not initialized');
                    }
                    return [4 /*yield*/, gSvrCmd(cmd, params)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function init(cmdDefs, svrCmdExecutor, dataCache) {
    gSvrCmd = svrCmdExecutor;
    for (var cmdName in cmdDefs) {
        registerSvrCmd(cmdName, cmdDefs[cmdName]);
    }
    for (var _i = 0, dataCache_1 = dataCache; _i < dataCache_1.length; _i++) {
        var cachedData = dataCache_1[_i];
        gCache.prefillCache(cachedData.cmd, cachedData.params, null, cachedData.data);
    }
}
exports.init = init;
function svrCmdToPath(cmdName, params) {
    return gCache.getPath(cmdName, params);
}
exports.svrCmdToPath = svrCmdToPath;
function paramsToCachePath(cmdName, params) {
    var svrCmd = gSvrCmds[cmdName];
    if (!svrCmd) {
        console.error('DataStore unknown svrCmd', { cmdName: cmdName });
        return undefined;
    }
    var path = [];
    for (var _i = 0, _a = svrCmd.paramNames; _i < _a.length; _i++) {
        var paramName = _a[_i];
        var paramValue = params ? params[paramName] : '';
        if (!SchemaType.validateType(paramValue, svrCmd.paramTypes[paramName], true)) {
            console.error('DataStore invalid param value', { cmdName: cmdName, paramName: paramName, paramValue: paramValue });
            return undefined;
        }
        path.push(paramValue);
    }
    if (params) {
        for (var key in params) {
            if (!svrCmd.paramTypes[key]) {
                console.error('DataStore extraneous param', { cmdName: cmdName, paramName: key, paramValue: params[key] });
            }
        }
    }
    return path;
}
// note: errCB gets called ONLY if a fetch gets triggered, so that you don't toast multiple times for the same error
// if you want to render the error, use the return value instead
function getServerDataWithError(watcher, cmdName, params, errCB) {
    return gCache.getDataWithError(watcher, cmdName, params, errCB);
}
exports.getServerDataWithError = getServerDataWithError;
function getServerData(watcher, cmdName, params, subPath, errCB) {
    return gCache.getData(watcher, cmdName, params, subPath, errCB);
}
exports.getServerData = getServerData;
function invalidateServerData(cmdName, params, noClear) {
    gCache.invalidate(cmdName, params, noClear);
}
exports.invalidateServerData = invalidateServerData;
exports.test = {
    fillDataCache: function (cmdName, params, err, data) {
        gCache.prefillCache(cmdName, params, err, data);
    },
    clear: function () {
        gCache.clear();
    },
};
