/**
* Copyright 2015-present Ampersand Technologies, Inc.
*/
import { FindDirData, IFileStore } from './dataStorePersist';
import { Stash } from 'amper-utils/dist/types';
export declare class RamFileStore implements IFileStore {
    private storage;
    windowReadAll(): Promise<{}>;
    windowWrite(_key: string, _data: any): Promise<void>;
    find<T>(key: string): Promise<T | undefined>;
    findDir<T>(dir: string): Promise<FindDirData<T>>;
    update(key: string, data: any): Promise<void>;
    remove(key: string): Promise<void>;
    removeList(keys: string[]): Promise<void>;
    removeDir(dir: string): Promise<void>;
    removeAllExcept(exceptKeys: string[]): Promise<void>;
    localBroadcast(): void;
    registerLocalMessageHandler(): void;
    test_getData(): Stash<string>;
    test_setData(data: Stash): void;
}
