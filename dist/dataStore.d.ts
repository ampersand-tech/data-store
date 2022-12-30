/**
* Copyright 2015-present Ampersand Technologies, Inc.
*/
import * as DataStorePersist from './dataStorePersist';
import * as DataStoreWatch from './dataStoreWatch';
import { DataWatcher, WatchTracker, Watcher, WatcherOpt } from './dataStoreWatch';
import { Schema } from 'amper-schema/dist/types';
export { DataWatcher, Watcher, WatcherHandle, WatcherOpt } from './dataStoreWatch';
export type Action = 'create' | 'remove' | 'update' | 'upsert' | 'replace' | 'max';
export interface IDataStore {
    getSchema(path: string[]): any;
    getData(watcher: WatcherOpt, path: string[], mask?: any, defaults?: any): any;
    getWatchTracker(): WatchTracker;
}
export interface IWritableDataStore extends IDataStore {
    replaceData(path: string[], data: any): void;
    updateData(path: string[], data: any): void;
    removeData(path: string[]): void;
    createData(path: string[], data: any): void;
}
export interface Options {
    schema?: Schema | null;
    isServerSynced?: boolean;
    allowSubobjectCreate?: boolean;
    persistType?: 'window' | 'local';
    futureFeed?: boolean;
}
export declare const IDS_MASK: Readonly<{
    _ids: number;
}>;
export declare const ALL_MASK: "*";
export declare function init(params: {
    requestAnimationFrame?: any;
    isTestClient?: any;
    debugObj?: any;
}): void;
export declare function getWatchTracker(): DataStoreWatch.WatchTracker;
export declare function validateMask(funcName: string, path: string[], objMask: any): void;
export interface DataStoreInternal {
    storeName: string;
    data: {};
    options: Options;
    lastMerge: {
        timestamp: number;
        count: number;
        sessionIdx: number;
        windowNumber: number;
    } | null;
    serverData?: {};
    clientChangeTree: null | {};
    serverChangeTree?: {};
}
export declare function registerDataStore(theModule: any, storeName: string, options?: Options, optData?: any): void;
export declare function loadDataStores(): Promise<DataStorePersist.LoadInfo>;
export declare function resetToDefaults(path: string[]): void;
export declare function resetStoreToDefaultsAsInternal(storeName: string): Promise<void>;
export declare function hasDataStore(storeName: string): boolean;
export declare function hasData(path: string[]): boolean;
export declare function getDataUnsafe(path: string[]): any;
export declare function getData(watcherIn: WatcherOpt, path: string[], objMask?: any, defaults?: any): any;
export declare function getDataNoOverlay(watcherIn: WatcherOpt, path: string[], objMask?: any, defaults?: any): any;
export declare function getServerDataUnsafe(path: string[]): any;
export declare function resetServerChangeTree(storeName: string): void;
export declare function resetClientToServer(storeName: string, force?: boolean): void;
declare function resetAll(): Promise<void>;
export declare function changeServerDataAsInternal(action: Action, path: string[], fields: any, feedCount?: number): boolean;
export declare function changeServerData(action: Action, path: string[], fields: any, feedCount: number): boolean;
export declare function changeDataAsInternal(action: Action, path: string[], fields: any, clientKey?: any, allowSubobjectCreate?: boolean, noWatchTrigger?: boolean): boolean;
export declare function changeDataNoClone(action: Action, path: string[], fields: any, clientKey?: any, allowSubobjectCreate?: boolean, noWatchTrigger?: boolean): boolean;
export declare function changeData(action: Action, path: string[], fields?: any, clientKey?: any, allowSubobjectCreate?: boolean, noWatchTrigger?: boolean): boolean;
export declare function toggleBool(path: string[]): boolean | undefined;
export declare function hasWatches(path: string[]): boolean;
export declare function hasAnyWatches(storeName: string): boolean;
export declare function addWatch(watcherIn: Watcher | DataWatcher, path: string[], objMask?: any, defaults?: any): any;
export declare function addCodeWatch(path: string[], objMask: any, priority: number, cb: DataStoreWatch.CodeWatchTriggerCB): any;
export declare function removeCodeWatch(path: string[], objMask: any, cb: DataStoreWatch.TriggerCB): void;
export declare function getSchema(path: string[]): any;
type WrappedChangeDataFunc = (path: string[], fields?: any) => boolean;
export declare const createData: WrappedChangeDataFunc;
export declare const updateData: WrappedChangeDataFunc;
export declare const upsertData: WrappedChangeDataFunc;
export declare const replaceData: WrappedChangeDataFunc;
export declare const removeData: WrappedChangeDataFunc;
export declare const createDataNoClone: WrappedChangeDataFunc;
export declare const updateDataNoClone: WrappedChangeDataFunc;
export declare const upsertDataNoClone: WrappedChangeDataFunc;
export declare const replaceDataNoClone: WrappedChangeDataFunc;
export declare const removeDataNoClone: WrappedChangeDataFunc;
export declare const test: {
    getDataStore: (storeName: any) => DataStoreInternal;
    resetAll: typeof resetAll;
    changeData: (action: Action, path: string[], fields: any, feedCount?: number) => boolean;
};
