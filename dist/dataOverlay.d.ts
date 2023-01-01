/**
* Copyright 2017-present Ampersand Technologies, Inc.
*/
import * as DataStore from './dataStore';
import * as DataStoreWatch from './dataStoreWatch';
import { WatcherOpt } from './dataStoreWatch';
import { Stash } from 'amper-utils/dist/types';
export declare class Overlay implements DataStore.IDataStore {
    private readonly backingStore;
    readonly id: number;
    readonly data: Stash;
    watchTracker: DataStoreWatch.WatchTracker;
    backingWatcher: DataStoreWatch.Watcher | null;
    constructor(backingStore: DataStore.IDataStore);
    uninit(): void;
    getSchema(path: string[]): any;
    getStoreSchema(path: string[]): any;
    getWatchTracker(): DataStoreWatch.WatchTracker;
    getOverlayData(path: string[]): any;
    getData(watcher: WatcherOpt, path: string[], objMask?: any): any;
    createData(path: string[], data: any): void;
    replaceData(path: string[], data: any): void;
    updateData(path: string[], data: any): void;
    removeData(path: string[]): void;
    resetData(path?: string[]): void;
    hasChanges(watcher: WatcherOpt, path: string[]): boolean;
    private onBackingStoreChange;
    private triggerWatches;
}
