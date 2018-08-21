/**
* Copyright 2015-present Ampersand Technologies, Inc.
*/

import * as ObjSchema from 'amper-schema/dist2017/objSchema';
import * as Types from 'amper-schema/dist2017/types';
import { Stash } from 'amper-utils/dist2017/types';


export type MergeAction = 'create'|'update'|'upsert'|'replace'|'remove'|'min'|'max';
type OptChangeTree = Stash | undefined | null;
type OptSchema = Types.Schema | undefined | null;
type OptClientKey = string | number | undefined;
type AnyArray = any[];

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


function isUnset(val) {
  return val === undefined || val === null;
}

function markChanged(mergeContext: MergeContext, change: OptChangeTree) {
  mergeContext.changed = true;
  if (change) {
    change._force = true;
  }
}

function descendChangeTree(change: OptChangeTree, key: string|number) {
  if (!change || change._force) {
    return null;
  }
  change = change[key] = change[key] || {};
  if (change!._force) {
    change = null;
  }
  return change;
}

function removeReplacedFields(
  mergeContext: MergeContext,
  newObj: Stash|AnyArray,
  existingObj: Stash|AnyArray,
  schema: OptSchema,
  change: OptChangeTree,
) {
  let subChange, defaultVal;
  if (Array.isArray(existingObj)) {
    for (let i = existingObj.length - 1; i >= 0; i--) {
      if (schema && !Types.isSchemaMapNode(schema) && !Types.isSchemaArrayNode(schema)) {
        defaultVal = ObjSchema.getDefaultValuesForSchema(schema[i], false);
        if (existingObj[i] !== defaultVal) {
          subChange = descendChangeTree(change, i);
          markChanged(mergeContext, subChange);
        }
        existingObj[i] = defaultVal;
      } else {
        subChange = descendChangeTree(change, i);
        markChanged(mergeContext, subChange);
        existingObj.splice(i, 1);
      }
    }

  } else {
    for (const id in existingObj) {
      if (newObj.hasOwnProperty(id)) {
        continue;
      }
      if (schema && !Types.isSchemaMapNode(schema) && !Types.isSchemaArrayNode(schema) && schema.hasOwnProperty(id)) {
        defaultVal = ObjSchema.getDefaultValuesForSchema(schema[id], false);
        if (existingObj[id] !== defaultVal) {
          subChange = descendChangeTree(change, id);
          markChanged(mergeContext, subChange);
        }
        existingObj[id] = defaultVal;
      } else {
        subChange = descendChangeTree(change, id);
        markChanged(mergeContext, subChange);
        delete existingObj[id];
      }
    }
  }
}

function getVal(mergeContext: MergeContext, change: OptChangeTree, fieldVal: any, existingVal: any) {
  if (mergeContext.action === 'max') {
    fieldVal = Math.max(fieldVal, existingVal);
  } else if (mergeContext.action === 'min') {
    fieldVal = Math.min(fieldVal, existingVal);
  }
  if (fieldVal !== existingVal) {
    markChanged(mergeContext, change);
  }
  return fieldVal;
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
export function typeCheckField(
  mergeContext: MergeContext,
  fieldVal: any,
  existingVal: any,
  schema: OptSchema,
  keys: string[],
  change: OptChangeTree,
) {
  const logKey = 'ObjMerge.' + mergeContext.action;
  if (!schema) {
    if (mergeContext.options.futureFeed || !mergeContext.options.schema) {
      // allow fields that are not in the schema (FutureFeed)
      return getVal(mergeContext, change, fieldVal, existingVal);
    }
    Log.errorNoCtx('@caller', logKey + ' fields contain a key that is not in the schema', {
      clientKey: mergeContext.clientKey,
      path: keys.join('/'),
      fieldValue: fieldVal,
    });
    return existingVal;
  }
  if (Types.isType(schema)) {
    // leaf node, schema is a Type
    if (Types.validateType(fieldVal, schema, false, mergeContext.options.futureFeed)) {
      // valid value!
      return getVal(mergeContext, change, fieldVal, existingVal);
    }
    Log.errorNoCtx('@conor', logKey + ' fields contain a value with a type that does not match the schema', {
      clientKey: mergeContext.clientKey,
      path: keys.join('/'),
      fieldValue: fieldVal,
    });
    return existingVal;
  }
  if (!Util.isObject(fieldVal) && !Array.isArray(fieldVal)) {
    if (Types.isNullable(schema) && fieldVal === null) {
      // valid value!
      return getVal(mergeContext, change, fieldVal, existingVal);
    }
    Log.errorNoCtx('@conor', logKey + ' fields contain a value with a type that does not match the schema', {
      clientKey: mergeContext.clientKey,
      path: keys.join('/'),
      fieldValue: fieldVal,
    });
    return existingVal;
  }

  // subobject, recurse
  if (mergeContext.action === 'replace') {
    removeReplacedFields(mergeContext, fieldVal, existingVal, schema, change);
  }
  if (!existingVal) {
    markChanged(mergeContext, change);
    change = null;
  }
  existingVal = existingVal || (schema ? ObjSchema.getDefaultValuesForSchema(schema, true) : {});
  for (const id in fieldVal) {
    const subChange = descendChangeTree(change, id);
    existingVal[id] = typeCheckField(
      mergeContext,
      fieldVal[id],
      existingVal[id],
      ObjSchema.descendSchema(schema, id),
      keys.concat([id]),
      subChange,
    );
  }
  return existingVal;
}

function pathCreate(
  mergeContext: MergeContext,
  rootObj: Stash,
  keys: string[],
  fields: any,
  allowSubObjects: boolean,
  changeTree: OptChangeTree,
): void {
  let obj = rootObj;
  let change = changeTree;
  let schema = mergeContext.options.schema;
  let prevObj;

  // Walk the path creating objects along the way
  for (let i = 0; i < keys.length; i++) {
    const isLastKey = (i === keys.length - 1);
    const key = keys[i];
    prevObj = obj;
    obj = prevObj[key];
    schema = ObjSchema.descendSchema(schema, key);
    change = descendChangeTree(change, key);

    if (isUnset(obj)) {
      // allow intermediate subobject create without error if the path is not in the schema (FutureFeed)
      if (schema && !allowSubObjects && !isLastKey) {
        // otherwise warn and ignore update (this can happen if, for example, a user removes an object and then gets a feed update from someone else)
        Log.warnNoCtx('@conor', 'ObjMerge.createMissingObjectInPath', {
          clientKey: mergeContext.clientKey,
          path: keys.join('/'),
          missing: keys.slice(0, i + 1).join('/'),
        });
        return;
      }

      // fill in fields with defaults if we have the schema (PastFeed)
      obj = prevObj[key] = schema ? ObjSchema.getDefaultValuesForSchema(schema, true) : {};
      markChanged(mergeContext, change);
      change = null;
    } else if (isLastKey) {
      Log.warnNoCtx('@conor', 'ObjMerge.createPathAlreadyExists', { clientKey: mergeContext.clientKey, path: keys.join('/') });
      return;
    }
  }

  if (change && change._force) {
    change = null;
  }

  if (!Util.isObject(obj)) {
    Log.errorNoCtx('@conor', 'ObjMerge.create on non-object path', { clientKey: mergeContext.clientKey, path: keys.join('/'), fields });
    return;
  }

  if (!Util.isObject(fields)) {
    Log.errorNoCtx('@conor', 'ObjMerge.create with non-object fields', { clientKey: mergeContext.clientKey, path: keys.join('/'), fields });
    return;
  }

  if (Types.isType(schema)) {
    const lastKey = keys[keys.length - 1];
    prevObj[lastKey] = typeCheckField(mergeContext, fields, prevObj[lastKey], schema, keys, change);
  } else {
    for (const id in fields) {
      const subChange = descendChangeTree(change, id);
      obj[id] = typeCheckField(mergeContext, fields[id], obj[id], descendSchema(schema, id), keys.concat(id), subChange);
    }
  }
}

function pathRemove(
  mergeContext: MergeContext,
  rootObj: Stash,
  keys: string[],
  fields: any,
  allowSubObjects: boolean,
  changeTree: OptChangeTree,
): void {
  let obj = rootObj;
  let change = changeTree;
  let schema = mergeContext.options.schema;

  let key;
  for (let i = 0; i < keys.length - 1; i++) {
    key = keys[i];
    obj = obj[key];
    schema = ObjSchema.descendSchema(schema, key);
    change = descendChangeTree(change, key);

    if (isUnset(obj)) {
      // ignore remove if path not in schema (FutureFeed)
      schema && !allowSubObjects && Log.warnNoCtx('@conor', 'ObjMerge.removeMissingParent', {
        clientKey: mergeContext.clientKey,
        path: keys.join('/'),
        missing: keys.slice(0, i + 1).join('/'),
      });
      return;
    }
  }

  key = keys[keys.length - 1];
  if (!obj.hasOwnProperty(key)) {
    // not an error, feed removes now supersede previous creates so this is an expected situation
    return;
  }

  change = descendChangeTree(change, key);
  markChanged(mergeContext, change);
  change = null;

  if (fields && fields._replaceWithObject) {
    obj[key] = {};
  } else {
    delete obj[keys[keys.length - 1]];
  }
}

function isAllowedObject(field: any, schema: OptSchema) {
  if (!Util.isObject(field)) {
    return true;
  }
  if (!Types.isType(schema)) {
    return false;
  }
  if (schema._sqlTypeName === 'OBJECT' || schema._sqlTypeName === 'OBJECT_NULLABLE') {
    return true;
  }
  return false;
}

function isLeafUpdate(schema: OptSchema, fields: any, obj: any) {
  return Types.isType(schema) || !Util.isObject(fields) || !Util.isObject(obj);
}

function pathUpdate(
  mergeContext: MergeContext,
  rootObj: Stash,
  keys: string[],
  fields: any,
  allowSubObjects: boolean,
  changeTree: OptChangeTree,
): void {
  let obj = rootObj;
  let change = changeTree;
  let schema = mergeContext.options.schema;
  let prevObj;
  let prevSchema;
  let prevChange;

  const isReplace = mergeContext.action === 'replace';
  let isUpsert = mergeContext.action === 'upsert' || isReplace;
  allowSubObjects = allowSubObjects || isReplace;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const isLastKey = i === keys.length - 1;

    prevObj = obj;
    prevSchema = schema;
    prevChange = change;

    obj = prevObj[key];
    schema = ObjSchema.descendSchema(schema, key);
    change = descendChangeTree(change, key);

    if (isUnset(obj)) {
      if (isLastKey && isLeafUpdate(schema, fields, {})) {
        isUpsert = true;
        continue;
      }
      if (!isUpsert) {
        Log.warnNoCtx('@conor', 'ObjMerge.updateMissingPath', {clientKey: mergeContext.clientKey, path: keys.join('/'), fields});
        return;
      }

      // fill in fields with defaults if we have the schema (PastFeed)
      obj = prevObj[key] = schema ? ObjSchema.getDefaultValuesForSchema(schema, true) : {};
      markChanged(mergeContext, change);
      change = null;
    }
  }

  if (change && change._force) {
    change = null;
  }

  if (isLeafUpdate(schema, fields, obj)) {
    // update on a leaf node directly, create a wrapper fields object and pop back up the path by one step
    const lastKey = keys[keys.length - 1];
    keys = keys.slice(0, -1); // do NOT pop this array, can't modify passed in data!
    const fieldVal = fields;
    fields = {};
    fields[lastKey] = fieldVal;
    obj = prevObj;
    schema = prevSchema;
    change = prevChange;
  } else if (isReplace) {
    removeReplacedFields(mergeContext, fields, obj, schema, change);
  }

  for (const id in fields) {
    if (!allowSubObjects && !isAllowedObject(fields[id], ObjSchema.descendSchema(schema, id))) {
      Log.errorNoCtx('@conor', 'ObjMerge.update fields contain a sub-object, not allowed', {
        clientKey: mergeContext.clientKey,
        path: keys.join('/'),
        field: id,
        fields,
      });
    } else if (obj[id] !== fields[id]) {
      const subChange = descendChangeTree(change, id);
      obj[id] = typeCheckField(mergeContext, fields[id], obj[id], ObjSchema.descendSchema(schema, id), keys.concat(id), subChange);
    }
  }
}

export function applyActionNoClone(
  rootObj: Stash,
  action: MergeAction,
  keys: string[],
  fields: any,
  clientKey: OptClientKey,
  options: MergeOptions,
  allowSubObjects: boolean,
  changeTree?: OptChangeTree,
) {
  const mergeContext: MergeContext = {
    action,
    clientKey,
    options,
    changed: false,
  };
  if (action === 'create') {
    pathCreate(mergeContext, rootObj, keys, fields, allowSubObjects, changeTree);
  } else if (action === 'remove') {
    pathRemove(mergeContext, rootObj, keys, fields, allowSubObjects, changeTree);
  } else {
    pathUpdate(mergeContext, rootObj, keys, fields, allowSubObjects, changeTree);
  }
  return mergeContext.changed;
}

export function applyAction(
  rootObj: Stash,
  action: MergeAction,
  keys: string[],
  fields: any,
  clientKey: OptClientKey,
  options: MergeOptions,
  allowSubObjects: boolean,
  changeTree?: OptChangeTree,
) {
  const safeFields = Util.clone(fields);
  return applyActionNoClone(rootObj, action, keys, safeFields, clientKey, options, allowSubObjects, changeTree);
}
