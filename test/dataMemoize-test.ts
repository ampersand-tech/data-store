/**
* Copyright 2016-present Ampersand Technologies, Inc.
*/

import * as DataMemoize from '../lib/dataMemoize';
import * as DataStore from '../lib/dataStore';
import * as DataStoreWatch from '../lib/dataStoreWatch';

import * as SchemaType from 'amper-schema/dist/types';
import * as ObjUtils from 'amper-utils/dist/objUtils';
import { expect } from 'chai';
import { describe, it } from 'mocha';

describe('DataMemoize', function() {

  DataStore.init({});

  const storeDataSchema = {
    foo: SchemaType.SHORTSTR,
    bar: {
      goop: SchemaType.INT,
      kool: SchemaType.INT,
    },
    baz: {
      goop: SchemaType.INT,
      kool: SchemaType.INT,
    },
    test: {
      _ids: {
        subMap: {
          _ids: {
            baz: SchemaType.SHORTSTR,
          },
        },
      },
    },
  };

  const storeData = {
    foo: 'bar',
    bar: {
      goop: 45,
      kool: 73,
    },
    baz: {
      goop: 92,
      kool: 12,
    },
  };
  DataStore.registerDataStore(null, 'TestStoreMemo', {schema: storeDataSchema}, storeData);

  let gMemoCalls = 0;
  const getMemoized = DataMemoize.memoize(function(watcher, key1, key2) {
    gMemoCalls++;
    const data = DataStore.getData(watcher, ['TestStoreMemo', key1]);
    return DataStore.getData(watcher, ['TestStoreMemo', data, key2]);
  });

  it('should only call memoized function when data is dirty', function() {
    expect(getMemoized(null, 'foo', 'goop')).to.equal(45);
    expect(gMemoCalls).to.equal(1);

    // calling again should return memoized data
    expect(getMemoized(null, 'foo', 'goop')).to.equal(45);
    expect(gMemoCalls).to.equal(1);

    // call with other params to memoize other data
    expect(getMemoized(null, 'foo', 'kool')).to.equal(73);
    expect(gMemoCalls).to.equal(2);

    // make sure first set of params is still memoized
    expect(getMemoized(null, 'foo', 'goop')).to.equal(45);
    expect(gMemoCalls).to.equal(2);

    // now change some dependent data
    DataStore.updateData(['TestStoreMemo', 'foo'], 'baz');
    expect(gMemoCalls).to.equal(2);

    // memoized data should now be dirty
    expect(getMemoized(null, 'foo', 'goop')).to.equal(92);
    expect(gMemoCalls).to.equal(3);

    expect(getMemoized(null, 'foo', 'kool')).to.equal(12);
    expect(gMemoCalls).to.equal(4);

    expect(getMemoized(null, 'foo', 'kool')).to.equal(12);
    expect(gMemoCalls).to.equal(4);
  });

  describe('example of callbacks with memoize', function() {
    const REV_MASK = ObjUtils.objectMakeImmutable({
      _ids: {
        subMap: DataStore.IDS_MASK,
      },
    });
    let gCallCount = 0;
    const getParentIDFromSubIDs = DataMemoize.memoize(function(watcher) {
      const testData = DataStore.getData(watcher, ['TestStoreMemo', 'test'], REV_MASK);
      const parentFromSubID = {};
      for (const parentID in testData) {
        const p = testData[parentID];
        for (const subID in p.subMap) {
          parentFromSubID[subID] = parentID;
        }
      }
      gCallCount++;
      return parentFromSubID;
    });

    it('should update memoized data properly', function(done) {
      DataStore.resetToDefaults(['TestStoreMemo']);

      const watcher = DataStoreWatch.createWatcher(0, watchingFunc);
      watchingFunc();
      expect(getParentIDFromSubIDs(null)).to.deep.equal({});
      expect(gCallCount).to.equal(1);

      DataStore.createData(['TestStoreMemo', 'test', 'foo0'], {
        subMap: {
          subMap0: {baz: 'sub0'},
          subMap1: {baz: 'sub1'},
        },
      });
      expect(getParentIDFromSubIDs(null)).to.deep.equal({
        subMap0: 'foo0',
        subMap1: 'foo0',
      });

      DataStore.createData(['TestStoreMemo', 'test', 'foo1'], {
        subMap: {
          subMap2: {baz: 'sub1'},
        },
      });
      expect(getParentIDFromSubIDs(null)).to.deep.equal({
        subMap0: 'foo0',
        subMap1: 'foo0',
        subMap2: 'foo1',
      });

      function watchingFunc() {
        const data = getParentIDFromSubIDs(watcher);
        if (gCallCount <= 1) {
          expect(data).to.deep.equal({});
        } else if (gCallCount === 2) {
          expect(data).to.deep.equal({
            subMap0: 'foo0',
            subMap1: 'foo0',
          });
        } else if (gCallCount === 3) {
          DataStoreWatch.destroyWatcher(watcher);
          expect(data).to.deep.equal({
            subMap0: 'foo0',
            subMap1: 'foo0',
            subMap2: 'foo1',
          });
          done();
        } else {
          expect('unexpected call count').to.equal(1); // just cause an error
        }
      }
    });
  });
});
