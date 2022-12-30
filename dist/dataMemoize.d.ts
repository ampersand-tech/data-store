/**
* Copyright 2015-present Ampersand Technologies, Inc.
*/
import * as DataStoreWatch from './dataStoreWatch';
import { Watcher, WatcherOpt } from './dataStoreWatch';
export interface MemoizedFunc {
    (watcher: WatcherOpt, ...args: any[]): any;
    isMyChange: (change: any) => boolean;
}
interface Memoizer0<R0> {
    (watcher: WatcherOpt): R0;
    isMyChange: (change: DataStoreWatch.Change) => boolean;
}
interface Memoizer1<R0, T0> {
    (watcher: WatcherOpt, a0: T0): R0;
    isMyChange: (change: DataStoreWatch.Change) => boolean;
}
interface Memoizer2<R0, T0, T1> {
    (watcher: WatcherOpt, a0: T0, a1: T1): R0;
    isMyChange: (change: DataStoreWatch.Change) => boolean;
}
interface Memoizer3<R0, T0, T1, T2> {
    (watcher: WatcherOpt, a0: T0, a1: T1, a2: T2): R0;
    isMyChange: (change: DataStoreWatch.Change) => boolean;
}
interface Memoizer4<R0, T0, T1, T2, T3> {
    (watcher: WatcherOpt, a0: T0, a1: T1, a2: T2, a3: T3): R0;
    isMyChange: (change: DataStoreWatch.Change) => boolean;
}
interface Memoizer5<R0, T0, T1, T2, T3, T4> {
    (watcher: WatcherOpt, a0: T0, a1: T1, a2: T2, a3: T3, a4: T4): R0;
    isMyChange: (change: DataStoreWatch.Change) => boolean;
}
interface Memoizer6<R0, T0, T1, T2, T3, T4, T5> {
    (watcher: WatcherOpt, a0: T0, a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): R0;
    isMyChange: (change: DataStoreWatch.Change) => boolean;
}
interface Memoizer7<R0, T0, T1, T2, T3, T4, T5, T6> {
    (watcher: WatcherOpt, a0: T0, a1: T1, a2: T2, a3: T3, a4: T4, a5: T5, a6: T6): R0;
    isMyChange: (change: DataStoreWatch.Change) => boolean;
}
export declare function memoize<R0>(func: ((watcher: Watcher) => R0)): Memoizer0<R0>;
export declare function memoize<R0, T0>(func: ((watcher: Watcher, a0: T0) => R0)): Memoizer1<R0, T0>;
export declare function memoize<R0, T0, T1>(func: ((watcher: Watcher, a0: T0, a1: T1) => R0)): Memoizer2<R0, T0, T1>;
export declare function memoize<R0, T0, T1, T2>(func: ((watcher: Watcher, a0: T0, a1: T1, a2: T2) => R0)): Memoizer3<R0, T0, T1, T2>;
export declare function memoize<R0, T0, T1, T2, T3>(func: ((watcher: Watcher, a0: T0, a1: T1, a2: T2, a3: T3) => R0)): Memoizer4<R0, T0, T1, T2, T3>;
export declare function memoize<R0, T0, T1, T2, T3, T4>(func: ((watcher: Watcher, a0: T0, a1: T1, a2: T2, a3: T3, a4: T4) => R0)): Memoizer5<R0, T0, T1, T2, T3, T4>;
export declare function memoize<R0, T0, T1, T2, T3, T4, T5>(func: ((watcher: Watcher, a0: T0, a1: T1, a2: T2, a3: T3, a4: T4, a5: T5) => R0)): Memoizer6<R0, T0, T1, T2, T3, T4, T5>;
export declare function memoize<R0, T0, T1, T2, T3, T4, T5, T6>(func: ((watcher: Watcher, a0: T0, a1: T1, a2: T2, a3: T3, a4: T4, a5: T5, a6: T6) => R0)): Memoizer7<R0, T0, T1, T2, T3, T4, T5, T6>;
export {};
