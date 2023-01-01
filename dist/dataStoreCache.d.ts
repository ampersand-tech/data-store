/**
* Copyright 2018-present Ampersand Technologies, Inc.
*/
import * as DataStore from './dataStore';
import { ErrDataCB, ErrorType } from 'amper-utils/dist/types';
export interface StoredData<DataType> {
    data: DataType | undefined;
    err: string | undefined;
}
interface Props<DataType, ParamsType> {
    name: string;
    fetchData: (key: string, params: ParamsType) => Promise<DataType>;
    paramsToCachePath: (key: string, params: ParamsType) => string[] | undefined;
    getExpireDelay?: (key: string) => number;
    refetchOffline?: {
        offlineCheck: () => Promise<any>;
        retryTime: number;
    };
}
export declare class DataStoreCache<DataType, ParamsType> {
    readonly props: Props<DataType, ParamsType>;
    private cache;
    private offlineFetches;
    private offlineTimer;
    constructor(props: Props<DataType, ParamsType>);
    getPath(key: string, params: ParamsType): string[] | null;
    private tryRefetchOffline;
    private onResponse;
    prefillCache(key: string, params: ParamsType, err: ErrorType, data: DataType | undefined): void;
    getDataWithError(watcher: DataStore.WatcherOpt, key: string, params: ParamsType, errCB?: ErrDataCB<any>): StoredData<DataType>;
    getData(watcher: DataStore.WatcherOpt, key: string, params: ParamsType, subPath?: string[], errCB?: ErrDataCB<any>): any;
    private invalidateFetchObj;
    private invalidateAll;
    invalidate(key: string, params: ParamsType, noClear?: boolean): void;
    clear(): void;
}
export {};
