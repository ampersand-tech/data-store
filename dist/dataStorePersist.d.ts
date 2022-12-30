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
export interface FileStoreInterface {
    find: (key: string) => Promise<any>;
    findDir: (key: string) => Promise<Stash>;
    update: (key: string, data: any) => Promise<void>;
    remove: (key: string) => Promise<void>;
    removeList: (keys: string[]) => Promise<void>;
    removeDir: (key: string) => Promise<void>;
    windowWrite: (key: string, data: any) => void;
    registerLocalMessageHandler: (msgName: string, handler: (msg: string, payload: any) => void) => void;
    localBroadcast: (msgName: string, payload: any) => void;
}
export declare function init(FileStoreIn: FileStoreInterface): void;
export declare function loadDataStore(store: DataStoreInternal, windowStorage: Stash, loadInfo: LoadInfo): Promise<void>;
export declare function initBroadcastHandlers(): void;
export declare function persistChange(store: DataStoreInternal, action: Action, path: string[], fields: any, feedCount?: number): void;
export declare function clearPersistedData(store: DataStoreInternal): Promise<void>;
