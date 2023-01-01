/**
* Copyright 2017-present Ampersand Technologies, Inc.
*/
import { Action, DataStoreInternal } from './dataStore';
import { Stash } from 'amper-utils/dist/types';
export interface LoadInfo {
    modified: Stash<number>;
    failed: Stash<string>;
    noData: Stash<boolean>;
}
export interface FindDirData<T> {
    paths: string[];
    objects: T[];
    errors?: any;
}
export interface IFileStore {
    registerLocalMessageHandler: (msgName: string, handler: (msg: string, payload: any) => void) => void;
    localBroadcast: (msgName: string, payload: any) => void;
    find<T>(key: string): Promise<T | undefined>;
    findDir<T>(key: string): Promise<FindDirData<T>>;
    update(key: string, data: any): Promise<void>;
    remove(key: string): Promise<void>;
    removeList(keys: string[]): Promise<void>;
    removeDir(key: string): Promise<void>;
    removeAllExcept(exceptKeys: string[]): Promise<void>;
    windowReadAll(): Promise<Stash>;
    windowWrite(key: string, data: any): Promise<void>;
}
export declare function init(FileStoreIn: IFileStore): void;
export declare function getFileStore(): IFileStore;
export declare function loadDataStore(store: DataStoreInternal, windowStorage: Stash, loadInfo: LoadInfo): Promise<void>;
export declare function initBroadcastHandlers(): void;
export declare function persistChange(store: DataStoreInternal, action: Action, path: string[], fields: any, feedCount?: number): void;
export declare function clearPersistedData(store: DataStoreInternal): Promise<void>;
