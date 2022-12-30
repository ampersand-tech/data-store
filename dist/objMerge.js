"use strict";
/**
* Copyright 2015-present Ampersand Technologies, Inc.
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyAction = exports.applyActionNoClone = exports.typeCheckField = void 0;
var ObjSchema = require("amper-schema/dist/objSchema");
var Types = require("amper-schema/dist/types");
var objUtils_1 = require("amper-utils/dist/objUtils");
function isUnset(val) {
    return val === undefined || val === null;
}
function markChanged(mergeContext, change) {
    mergeContext.changed = true;
    if (change) {
        change._force = true;
    }
}
function descendChangeTree(change, key) {
    if (!change || change._force) {
        return null;
    }
    change = change[key] = change[key] || {};
    if (change._force) {
        change = null;
    }
    return change;
}
function removeReplacedFields(mergeContext, newObj, existingObj, schema, change) {
    var subChange, defaultVal;
    if (Array.isArray(existingObj)) {
        for (var i = existingObj.length - 1; i >= 0; i--) {
            if (schema && !Types.isSchemaMapNode(schema) && !Types.isSchemaArrayNode(schema)) {
                defaultVal = ObjSchema.getDefaultValuesForSchema(schema[i], false);
                if (existingObj[i] !== defaultVal) {
                    subChange = descendChangeTree(change, i);
                    markChanged(mergeContext, subChange);
                }
                existingObj[i] = defaultVal;
            }
            else {
                subChange = descendChangeTree(change, i);
                markChanged(mergeContext, subChange);
                existingObj.splice(i, 1);
            }
        }
    }
    else {
        for (var id in existingObj) {
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
            }
            else {
                subChange = descendChangeTree(change, id);
                markChanged(mergeContext, subChange);
                delete existingObj[id];
            }
        }
    }
}
function getVal(mergeContext, change, fieldVal, existingVal) {
    if (mergeContext.action === 'max') {
        fieldVal = Math.max(fieldVal, existingVal);
    }
    else if (mergeContext.action === 'min') {
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
function typeCheckField(mergeContext, fieldVal, existingVal, schema, keys, change) {
    var logKey = 'ObjMerge.' + mergeContext.action;
    if (!schema) {
        if (mergeContext.options.futureFeed || !mergeContext.options.schema) {
            // allow fields that are not in the schema (FutureFeed)
            return getVal(mergeContext, change, fieldVal, existingVal);
        }
        console.error(logKey + ' fields contain a key that is not in the schema', {
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
        console.error(logKey + ' fields contain a value with a type that does not match the schema', {
            clientKey: mergeContext.clientKey,
            path: keys.join('/'),
            fieldValue: fieldVal,
        });
        return existingVal;
    }
    if (!(0, objUtils_1.isObject)(fieldVal) && !Array.isArray(fieldVal)) {
        if (Types.isNullable(schema) && fieldVal === null) {
            // valid value!
            return getVal(mergeContext, change, fieldVal, existingVal);
        }
        console.error(logKey + ' fields contain a value with a type that does not match the schema', {
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
    for (var id in fieldVal) {
        var subChange = descendChangeTree(change, id);
        existingVal[id] = typeCheckField(mergeContext, fieldVal[id], existingVal[id], ObjSchema.descendSchema(schema, id), keys.concat([id]), subChange);
    }
    return existingVal;
}
exports.typeCheckField = typeCheckField;
function pathCreate(mergeContext, rootObj, keys, fields, allowSubObjects, changeTree) {
    var obj = rootObj;
    var change = changeTree;
    var schema = mergeContext.options.schema;
    var prevObj;
    // Walk the path creating objects along the way
    for (var i = 0; i < keys.length; i++) {
        var isLastKey = (i === keys.length - 1);
        var key = keys[i];
        prevObj = obj;
        obj = prevObj[key];
        schema = ObjSchema.descendSchema(schema, key);
        change = descendChangeTree(change, key);
        if (isUnset(obj)) {
            // allow intermediate subobject create without error if the path is not in the schema (FutureFeed)
            if (schema && !allowSubObjects && !isLastKey) {
                // otherwise warn and ignore update (this can happen if, for example, a user removes an object and then gets a feed update from someone else)
                console.warn('ObjMerge.createMissingObjectInPath', {
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
        }
        else if (isLastKey) {
            console.warn('ObjMerge.createPathAlreadyExists', { clientKey: mergeContext.clientKey, path: keys.join('/') });
            return;
        }
    }
    if (change && change._force) {
        change = null;
    }
    if (!(0, objUtils_1.isObject)(obj)) {
        console.error('ObjMerge.create on non-object path', { clientKey: mergeContext.clientKey, path: keys.join('/'), fields: fields });
        return;
    }
    if (!(0, objUtils_1.isObject)(fields)) {
        console.error('ObjMerge.create with non-object fields', { clientKey: mergeContext.clientKey, path: keys.join('/'), fields: fields });
        return;
    }
    if (Types.isType(schema)) {
        var lastKey = keys[keys.length - 1];
        prevObj[lastKey] = typeCheckField(mergeContext, fields, prevObj[lastKey], schema, keys, change);
    }
    else {
        for (var id in fields) {
            var subChange = descendChangeTree(change, id);
            obj[id] = typeCheckField(mergeContext, fields[id], obj[id], ObjSchema.descendSchema(schema, id), keys.concat(id), subChange);
        }
    }
}
function pathRemove(mergeContext, rootObj, keys, fields, allowSubObjects, changeTree) {
    var obj = rootObj;
    var change = changeTree;
    var schema = mergeContext.options.schema;
    var key;
    for (var i = 0; i < keys.length - 1; i++) {
        key = keys[i];
        obj = obj[key];
        schema = ObjSchema.descendSchema(schema, key);
        change = descendChangeTree(change, key);
        if (isUnset(obj)) {
            // ignore remove if path not in schema (FutureFeed)
            schema && !allowSubObjects && console.warn('ObjMerge.removeMissingParent', {
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
    }
    else {
        delete obj[keys[keys.length - 1]];
    }
}
function isAllowedObject(field, schema) {
    if (!(0, objUtils_1.isObject)(field)) {
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
function isLeafUpdate(schema, fields, obj) {
    return Types.isType(schema) || !(0, objUtils_1.isObject)(fields) || !(0, objUtils_1.isObject)(obj);
}
function pathUpdate(mergeContext, rootObj, keys, fields, allowSubObjects, changeTree) {
    var obj = rootObj;
    var change = changeTree;
    var schema = mergeContext.options.schema;
    var prevObj;
    var prevSchema;
    var prevChange;
    var isReplace = mergeContext.action === 'replace';
    var isUpsert = mergeContext.action === 'upsert' || isReplace;
    allowSubObjects = allowSubObjects || isReplace;
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var isLastKey = i === keys.length - 1;
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
                console.warn('ObjMerge.updateMissingPath', { clientKey: mergeContext.clientKey, path: keys.join('/'), fields: fields });
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
        var lastKey = keys[keys.length - 1];
        keys = keys.slice(0, -1); // do NOT pop this array, can't modify passed in data!
        var fieldVal = fields;
        fields = {};
        fields[lastKey] = fieldVal;
        obj = prevObj;
        schema = prevSchema;
        change = prevChange;
    }
    else if (isReplace) {
        removeReplacedFields(mergeContext, fields, obj, schema, change);
    }
    for (var id in fields) {
        if (!allowSubObjects && !isAllowedObject(fields[id], ObjSchema.descendSchema(schema, id))) {
            console.error('ObjMerge.update fields contain a sub-object, not allowed', {
                clientKey: mergeContext.clientKey,
                path: keys.join('/'),
                field: id,
                fields: fields,
            });
        }
        else if (obj[id] !== fields[id]) {
            var subChange = descendChangeTree(change, id);
            obj[id] = typeCheckField(mergeContext, fields[id], obj[id], ObjSchema.descendSchema(schema, id), keys.concat(id), subChange);
        }
    }
}
function applyActionNoClone(rootObj, action, keys, fields, clientKey, options, allowSubObjects, changeTree) {
    var mergeContext = {
        action: action,
        clientKey: clientKey,
        options: options,
        changed: false,
    };
    if (action === 'create') {
        pathCreate(mergeContext, rootObj, keys, fields, allowSubObjects, changeTree);
    }
    else if (action === 'remove') {
        pathRemove(mergeContext, rootObj, keys, fields, allowSubObjects, changeTree);
    }
    else {
        pathUpdate(mergeContext, rootObj, keys, fields, allowSubObjects, changeTree);
    }
    return mergeContext.changed;
}
exports.applyActionNoClone = applyActionNoClone;
function applyAction(rootObj, action, keys, fields, clientKey, options, allowSubObjects, changeTree) {
    var safeFields = (0, objUtils_1.clone)(fields);
    return applyActionNoClone(rootObj, action, keys, safeFields, clientKey, options, allowSubObjects, changeTree);
}
exports.applyAction = applyAction;
