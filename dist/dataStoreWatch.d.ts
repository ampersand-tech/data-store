/**
* Copyright 2015-present Ampersand Technologies, Inc.
*/
import * as DataStore from './dataStore';
import { Stash } from 'amper-utils/dist/types';
interface WatchTree {
    _watches?: Watch[];
    [key: string]: WatchTree | Watch[] | undefined;
}
export interface WatchTracker {
    id: string;
    dataStore: DataStore.IDataStore;
    changeTree: {};
    watchTree: WatchTree;
    watchTreeImmediate: WatchTree;
}
export interface Change {
    path: string[];
    pathStr: string;
    pathDepth: number;
    objMask: any;
    data: any;
}
interface Trigger {
    priority: number;
    minPathDepth: number;
    watcher: Watcher;
    changes: Change[];
    changesByPath: Stash<Change>;
}
export type TriggerCB = (watcher: Watcher, changes: Change[]) => void;
export type CodeWatchTriggerCB = (data: any) => void;
interface Watch {
    watcher: Watcher | null;
    dataStore: DataStore.IDataStore;
    path: string[];
    pathDepth: number;
    pathStr: string;
    multiData: boolean;
    data: any;
    objMask: any;
    defaults: any;
    count: number;
    didChange: boolean;
}
export interface Watcher {
    watcherID: number;
    priority: number;
    triggerImmediate: boolean;
    triggerCB: TriggerCB;
    watches: Watch[];
    getData: (path: string[], objMask?: any, defaults?: any) => any;
    readOnly: boolean;
    dataStore: DataStore.IDataStore;
    _pathStr?: string;
    _objMask?: any;
    _codeWatchCB?: CodeWatchTriggerCB;
}
export interface WatcherHandle {
    watcher: Watcher | null;
}
export interface DataWatcher {
    getWatcher(): Watcher | null;
}
export type WatcherOpt = DataWatcher | Watcher | null;
export declare function init(requestAnimationFrameIn?: any, isTestClient?: boolean): void;
export declare function isDataWatcher(watcher: any): watcher is DataWatcher;
export declare function createWatchTracker(dataStore: DataStore.IDataStore, id: string): WatchTracker;
export declare function addToPending(tracker?: WatchTracker): void;
export declare function triggerWatchesNextFrame(): void;
export declare function flushWatches(): Promise<void>;
export declare function createWatcher(priority: number, triggerCB: TriggerCB, triggerImmediate?: boolean, dataStore?: DataStore.IDataStore): DataStore.Watcher;
export declare function addWatchInternal(dataStore: DataStore.IDataStore, watcher: Watcher, path: string[], objMask?: any, defaults?: any, data?: any): Watch | null;
export declare function findWatch(dataStore: DataStore.IDataStore, watcher: Watcher, path: string[], objMask: any): Watch | null;
export declare function removeWatch(watcher: Watcher, path: string[], objMask: any): void;
export declare function resetWatches(watcher: Watcher): void;
export declare function pruneUnusedWatches(watcher: Watcher): void;
export declare function destroyWatcher(watcher: Watcher): void;
export declare function createDataReactor(priority: number, func: TriggerCB, triggerImmediate?: boolean): WatcherHandle;
export declare function destroyDataReactor(handle: WatcherHandle): void;
export interface TestInfo {
    earlyUnchanged: boolean;
    watch: Watch;
}
export declare function getTriggeredWatches(trackers: WatchTracker[], triggerImmediate: any, testInfo: any): Trigger[];
export declare function countWatches(obj: Stash | null | undefined): any;
export declare function hasWatchesInTree(watchTree: WatchTree, path: string[]): boolean;
export {};
