import { WatcherOpt } from './dataStore';
import * as SchemaType from 'amper-schema/dist/types';
import { ErrDataCB, ErrorType, Stash } from 'amper-utils/dist/types';
export interface CachedFetchedData {
    cmd: string;
    params: Stash;
    data?: Stash;
}
export type SvrCmdExecutor = (cmd: string, params: Stash) => Promise<Stash>;
export declare function init(cmdDefs: Stash<SchemaType.Schema>, svrCmdExecutor: SvrCmdExecutor, dataCache: CachedFetchedData[]): void;
export declare function svrCmdToPath(cmdName: string, params: Stash): string[] | null;
export declare function getServerDataWithError(watcher: WatcherOpt, cmdName: string, params: Stash, errCB?: ErrDataCB<any>): import("./dataStoreCache").StoredData<Stash<any>>;
export declare function getServerData(watcher: WatcherOpt, cmdName: string, params: Stash, subPath?: string[], errCB?: ErrDataCB<any>): any;
export declare function invalidateServerData(cmdName: string, params?: Stash, noClear?: boolean): void;
export declare const test: {
    fillDataCache: (cmdName: string, params: Stash, err: ErrorType, data: any) => void;
    clear: () => void;
};
