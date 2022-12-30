/**
* Copyright 2015-present Ampersand Technologies, Inc.
*/
import * as Types from 'amper-schema/dist/types';
import { Stash } from 'amper-utils/dist/types';
export type MergeAction = 'create' | 'update' | 'upsert' | 'replace' | 'remove' | 'min' | 'max';
type OptChangeTree = Stash | undefined | null;
type OptSchema = Types.Schema | undefined | null;
type OptClientKey = string | number | undefined;
export interface MergeOptions {
    futureFeed?: boolean;
    schema?: OptSchema;
}
interface MergeContext {
    action: MergeAction;
    clientKey: OptClientKey;
    options: MergeOptions;
    changed: boolean;
}
/**
 *
 * @param {*} fieldVal    New incoming value
 * @param {*} existingVal Old value
 * @param {*} schema      Schema
 * @param {*} keys        Only used for diagnostic logging
 * @param {*} clientKey   Only used for diagnostic logging
 * @param {*} options     {futureFeed: boolean, schema: ???}
 * @param {*} change      Change tree
 * @param {*} action      create|replace|etc
 */
export declare function typeCheckField(mergeContext: MergeContext, fieldVal: any, existingVal: any, schema: OptSchema, keys: string[], change: OptChangeTree): any;
export declare function applyActionNoClone(rootObj: Stash, action: MergeAction, keys: string[], fields: any, clientKey: OptClientKey, options: MergeOptions, allowSubObjects: boolean, changeTree?: OptChangeTree): boolean;
export declare function applyAction(rootObj: Stash, action: MergeAction, keys: string[], fields: any, clientKey: OptClientKey, options: MergeOptions, allowSubObjects: boolean, changeTree?: OptChangeTree): boolean;
export {};
