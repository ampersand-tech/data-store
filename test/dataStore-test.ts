/**
* Copyright 2016-present Ampersand Technologies, Inc.
*/

import * as DataStore from '../lib/dataStore';
import { IDS_MASK } from '../lib/dataStore';
import * as DataStorePersist from '../lib/dataStorePersist';
import * as DataStoreWatch from '../lib/dataStoreWatch';
import { RamFileStore } from '../lib/ramFileStore';

import * as SchemaType from 'amper-schema/dist/types';
import * as JsonUtils from 'amper-utils/dist/jsonUtils';
import * as ObjUtils from 'amper-utils/dist/objUtils';
import { Stash } from 'amper-utils/dist/types';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import * as sinon from 'sinon';

describe('DataStore', function() {
  const fileStore = new RamFileStore();
  let gFireAnimationFrameTriggers;
  DataStorePersist.init(fileStore);
  DataStore.init({
    requestAnimationFrame: function(cb) {
      gFireAnimationFrameTriggers && setTimeout(cb, 0);
    },
  });

  const schema = {
    test: {
      _ids: {
        foo: SchemaType.INT,
        bar: SchemaType.BOOL,
        subMap: {
          _ids: {
            baz: SchemaType.SHORTSTR,
          },
        },
      },
    },
  };
  const storeData: Stash = { test: {} };
  const storeOptions: DataStore.Options = {
    persistType: 'local',
    schema: schema,
  };

  DataStore.registerDataStore(null, 'TestStore', storeOptions, storeData);
  const gTestStore = DataStore.test.getDataStore('TestStore');
  expect(gTestStore).to.be.an('object');

  let clock;
  afterEach(function() {
    if (DataStore.hasAnyWatches('TestStore')) {
      throw new Error('TestStore still has watches');
    }
    if (clock) {
      clock.restore();
      clock = null;
    }
  });

  describe('basic data modifications', function() {
    it('should be able to modify data in the store', async function() {
      clock = sinon.useFakeTimers({toFake: ['Date']});
      const fields = {
        foo: 12,
        bar: true,
      };

      const watchTracker = DataStore.getWatchTracker();
      DataStore.createData(['TestStore', 'test', 'foo1'], fields);
      expect(storeData.test.foo1).to.not.equal(fields);
      expect(storeData.test.foo1).to.deep.equal({
        foo: 12,
        bar: true,
        subMap: {},
      });
      expect(watchTracker.changeTree).to.deep.equal({
        TestStore: {
          test: {
            foo1: {
              _force: true,
            },
          },
        },
      });
      let fileDataArray = ObjUtils.objToArray(fileStore.test_getData());
      expect(fileDataArray.length).to.equal(1);
      expect(JsonUtils.safeParse(fileDataArray[0])).to.deep.equal({
        timeKey: '00000000000000.0001.00000',
        timestamp: 0,
        count: 1,
        sessionIdx: 0,
        windowNumber: 0,
        action: 'create',
        path: ['TestStore', 'test', 'foo1'],
        fields: {foo: 12, bar: true},
      });

      DataStore.createData(['TestStore', 'test', 'foo2'], fields);
      expect(storeData.test.foo2).to.not.equal(fields);
      expect(storeData.test.foo2).to.deep.equal({
        foo: 12,
        bar: true,
        subMap: {},
      });
      expect(watchTracker.changeTree).to.deep.equal({
        TestStore: {
          test: {
            foo1: {
              _force: true,
            },
            foo2: {
              _force: true,
            },
          },
        },
      });

      DataStore.updateData(['TestStore', 'test', 'foo2', 'bar'], false);
      expect(storeData.test.foo2).to.deep.equal({
        foo: 12,
        bar: false,
        subMap: {},
      });
      expect(watchTracker.changeTree).to.deep.equal({
        TestStore: {
          test: {
            foo1: {
              _force: true,
            },
            foo2: {
              _force: true,
            },
          },
        },
      });

      DataStore.toggleBool(['TestStore', 'test', 'foo2', 'bar']);
      expect(storeData.test.foo2).to.deep.equal({
        foo: 12,
        bar: true,
        subMap: {},
      });
      expect(watchTracker.changeTree).to.deep.equal({
        TestStore: {
          test: {
            foo1: {
              _force: true,
            },
            foo2: {
              _force: true,
            },
          },
        },
      });

      const fileData = fileStore.test_getData();
      expect(Object.keys(fileData).length).to.equal(4);
      DataStore.resetStoreToDefaultsAsInternal('TestStore');
      expect(fileStore.test_getData()).to.deep.equal({});
      expect(storeData).to.deep.equal({test: {}});

      fileStore.test_setData(fileData);
      const loadInfo = await DataStore.loadDataStores();
      expect(storeData).to.deep.equal({
        test: {
          foo1: { foo: 12, bar: true, subMap: {} },
          foo2: { foo: 12, bar: true, subMap: {} },
        },
      });
      expect(loadInfo).to.deep.equal({
        failed: {},
        modified: {TestStore: 1},
        noData: {TestStore: false},
      });
      // make sure data coalesces
      expect(fileStore.test_getData()).to.deep.equal({
        // tslint:disable-next-line:max-line-length
        'dsData/TestStore': '{"data":{"test":{"foo1":{"foo":12,"bar":true,"subMap":{}},"foo2":{"foo":12,"bar":true,"subMap":{}}}},"lastMerge":{"timestamp":0,"count":4,"sessionIdx":0,"windowNumber":0}}',
      });

      for (const storeName in watchTracker.changeTree) {
        watchTracker.changeTree[storeName] = {};
      }
    });

    it('should get immutable data from the store', function() {
      const foo1 = DataStore.getData(null, ['TestStore', 'test', 'foo1'], null, undefined);
      expect(foo1).to.deep.equal({
        foo: 12,
        bar: true,
        subMap: {},
      });
      expect(storeData.test.foo1).to.not.equal(foo1);
      expect(ObjUtils.isImmutable(foo1)).to.equal(true);

      const objMask = ObjUtils.objectMakeImmutable({ bar: 1 });
      const foo2 = DataStore.getData(null, ['TestStore', 'test', 'foo2'], objMask, undefined);
      expect(foo2).to.deep.equal({
        bar: true,
      });
      expect(storeData.test.foo2).to.not.equal(foo2);
      expect(ObjUtils.isImmutable(foo2)).to.equal(true);

      const foo3 = DataStore.getData(null, ['TestStore', 'test', 'foo3'], objMask, undefined);
      expect(foo3).to.equal(undefined);

      const defaults = {
        foo: 34,
        bar: true,
      };

      const foo4 = DataStore.getData(null, ['TestStore', 'test', 'foo4'], objMask, defaults);
      expect(foo4).to.deep.equal({ bar: true });
      expect(ObjUtils.isImmutable(foo4)).to.equal(true);

      const foo5 = DataStore.getData(null, ['TestStore', 'test', 'foo5'], null, defaults);
      expect(foo5).to.deep.equal({ foo: 34, bar: true });
      expect(foo5).to.not.equal(defaults);
      expect(ObjUtils.isImmutable(foo5)).to.equal(true);
    });

    it('should respect other masks', function() {
      expect(DataStore.getData(null, ['TestStore', 'test', 'foo1'], 1)).to.deep.equal({});

      expect(DataStore.getData(null, ['TestStore', 'test', 'foo1'], '*')).to.deep.equal({
        foo: 12,
        bar: true,
        subMap: {},
      });

      expect(DataStore.getData(null, ['TestStore', 'test', 'foo13'], 1)).to.equal(undefined);
      expect(DataStore.getData(null, ['TestStore', 'test', 'foo13'], '*')).to.equal(undefined);

      expect(DataStore.getData(null, ['TestStore', 'test', 'foo1', 'foo'], 1)).to.deep.equal(12);
      expect(DataStore.getData(null, ['TestStore', 'test', 'foo1', 'foo'], '*')).to.deep.equal(12);
    });
  });

  describe('watchers', function() {
    before(function() {
      gFireAnimationFrameTriggers = true;
    });

    it('should be triggered by change', function(done) {
      const watcher = DataStoreWatch.createWatcher(10, onTrigger);
      const foo4 = DataStore.getData(watcher, ['TestStore', 'test', 'foo4']);
      expect(foo4).to.equal(undefined);

      DataStore.createData(['TestStore', 'test', 'foo4'], { foo: 83 });

      function onTrigger(_watcher, changes) {
        expect(changes.length).to.equal(1);
        expect(changes[0].pathStr).to.equal('TestStore/test/foo4');
        expect(changes[0].data).to.deep.equal({ foo: 83, bar: false, subMap: {} });
        DataStoreWatch.destroyWatcher(watcher);
        done();
      }
    });

    it('should be triggered by removal', function(done) {
      DataStore.createData(['TestStore', 'test', 'foo44'], { foo: 88 });

      const watcher = DataStoreWatch.createWatcher(10, onTrigger);
      const foo44 = DataStore.getData(watcher, ['TestStore', 'test', 'foo44']);
      expect(foo44).to.deep.equal({ foo: 88, bar: false, subMap: {} });

      DataStore.removeData(['TestStore', 'test', 'foo44']);


      function onTrigger(_watcher, changes) {
        expect(changes.length).to.equal(1);
        expect(changes[0].pathStr).to.equal('TestStore/test/foo44');
        expect(changes[0].data).to.equal(undefined);
        DataStoreWatch.destroyWatcher(watcher);
        done();
      }
    });

    it('should collate changes', function(done) {
      const watcher = DataStoreWatch.createWatcher(10, onTrigger);
      const foo6 = DataStore.getData(watcher, ['TestStore', 'test', 'foo6'], ObjUtils.objectMakeImmutable({ foo: 1, bar: 1 }));
      expect(foo6).to.equal(undefined);

      // should ignore this one
      DataStore.createData(['TestStore', 'test', 'foo5'], { foo: 83 });

      // should collapse these two
      DataStore.createData(['TestStore', 'test', 'foo6'], { foo: 83 });
      DataStore.updateData(['TestStore', 'test', 'foo6', 'bar'], true);

      function onTrigger(_watcher, changes) {
        expect(changes.length).to.equal(1);
        expect(changes[0].pathStr).to.equal('TestStore/test/foo6');
        expect(changes[0].data).to.deep.equal({ foo: 83, bar: true });
        DataStoreWatch.destroyWatcher(watcher);
        done();
      }
    });

    it('should trigger multiple watches', function(done) {
      const watcher = DataStoreWatch.createWatcher(10, onTrigger);
      const foo7 = DataStore.getData(watcher, ['TestStore', 'test', 'foo7']);
      expect(foo7).to.equal(undefined);
      const foo8 = DataStore.getData(watcher, ['TestStore', 'test', 'foo8']);
      expect(foo8).to.equal(undefined);

      DataStore.createData(['TestStore', 'test', 'foo7'], { foo: 83 });
      DataStore.updateData(['TestStore', 'test', 'foo7', 'bar'], true);

      DataStore.createData(['TestStore', 'test', 'foo8'], { foo: 90 });

      function onTrigger(_watcher, changes) {
        expect(changes.length).to.equal(2);
        expect(changes[0].pathStr).to.equal('TestStore/test/foo7');
        expect(changes[0].data).to.deep.equal({ foo: 83, bar: true, subMap: {} });
        expect(changes[1].pathStr).to.equal('TestStore/test/foo8');
        expect(changes[1].data).to.deep.equal({ foo: 90, bar: false, subMap: {} });
        DataStoreWatch.destroyWatcher(watcher);
        done();
      }
    });

    it('should trigger multi-data', function(done) {
      const watchTracker = DataStore.getWatchTracker();
      const watcher = DataStoreWatch.createWatcher(10, onTrigger);
      DataStore.addWatch(watcher, ['TestStore', 'test', '_ids', 'foo']);

      DataStore.createData(['TestStore', 'test', 'foo9'], { foo: 83 });
      DataStore.updateData(['TestStore', 'test', 'foo9', 'bar'], true);

      DataStore.createData(['TestStore', 'test', 'foo10'], { foo: 90 });

      DataStore.updateData(['TestStore', 'test', 'foo8', 'foo'], 77);

      expect(watchTracker.changeTree).to.deep.equal({
        TestStore: {
          test: {
            foo9: {
              _force: true,
            },
            foo10: { _force: true },
            foo8: {
              foo: { _force: true },
            },
          },
        },
      });

      function onTrigger(_watcher, changes) {
        expect(changes.length).to.equal(3);
        expect(changes[0].pathStr).to.equal('TestStore/test/foo9/foo');
        expect(changes[0].data).to.deep.equal(83);
        expect(changes[1].pathStr).to.equal('TestStore/test/foo10/foo');
        expect(changes[1].data).to.deep.equal(90);
        expect(changes[2].pathStr).to.equal('TestStore/test/foo8/foo');
        expect(changes[2].data).to.deep.equal(77);
        DataStoreWatch.destroyWatcher(watcher);
        done();
      }
    });

    it('should trigger multi-data with a mask', function(done) {
      const watcher = DataStoreWatch.createWatcher(10, onTrigger);
      DataStore.addWatch(watcher, ['TestStore', 'test', '_ids'], ObjUtils.objectMakeImmutable({ bar: 1 }));

      DataStore.createData(['TestStore', 'test', 'foo11'], { foo: 83 });
      DataStore.updateData(['TestStore', 'test', 'foo11', 'bar'], true);

      DataStore.createData(['TestStore', 'test', 'foo12'], { foo: 90 });

      DataStore.updateData(['TestStore', 'test', 'foo10', 'foo'], 77);

      function onTrigger(_watcher, changes) {
        expect(changes.length).to.equal(3);
        expect(changes[0].pathStr).to.equal('TestStore/test/foo11');
        expect(changes[0].data).to.deep.equal({ bar: true });
        expect(changes[1].pathStr).to.equal('TestStore/test/foo12');
        expect(changes[1].data).to.deep.equal({ bar: false });
        expect(changes[2].pathStr).to.equal('TestStore/test/foo10');
        expect(changes[2].data).to.deep.equal({ bar: false });
        DataStoreWatch.destroyWatcher(watcher);
        done();
      }
    });

    it('should early out on IDS_MASK unforced changes', function() {
      const watchTracker = DataStore.getWatchTracker();
      const watcher = DataStoreWatch.createWatcher(10, onTrigger);
      const currentIDs = DataStore.getData(watcher, ['TestStore', 'test'], IDS_MASK);
      expect(currentIDs).to.exist;

      DataStore.createData(['TestStore', 'test', 'foo15'], { foo: 91 });
      expect(watchTracker.changeTree).to.deep.equal({
        TestStore: {
          test: {
            foo15: { _force: true },
          },
        },
      });

      let testInfo: DataStoreWatch.TestInfo[] = [];
      let triggered = DataStoreWatch.getTriggeredWatches([watchTracker], false, testInfo);
      expect(testInfo.length).to.equal(1);
      expect(testInfo[0].earlyUnchanged).to.equal(undefined);
      expect(triggered.length).to.equal(1);
      expect(triggered[0].changes.length).to.equal(1);
      expect(triggered[0].changes[0].data).to.deep.equal({
        foo1: 1,
        foo2: 1,
        foo4: 1,
        foo5: 1,
        foo6: 1,
        foo7: 1,
        foo8: 1,
        foo9: 1,
        foo10: 1,
        foo11: 1,
        foo12: 1,
        foo15: 1,
      });

      DataStore.updateData(['TestStore', 'test', 'foo15'], { foo: 92 }); // does not create a change
      expect(watchTracker.changeTree).to.deep.equal({
        TestStore: {
          test: {
            foo15: { foo: { _force: true } },
          },
        },
      });

      testInfo = [];
      triggered = DataStoreWatch.getTriggeredWatches([watchTracker], false, testInfo);
      expect(testInfo.length).to.equal(1);
      expect(testInfo[0].earlyUnchanged).to.equal(true);
      expect(triggered).to.deep.equal([]);

      DataStoreWatch.destroyWatcher(watcher);

      function onTrigger() {
        throw new Error('onTrigger');
      }
    });

    it('should only be triggered by adds when watching ids', async function() {
      const watchTracker = DataStore.getWatchTracker();
      const watcher = DataStoreWatch.createWatcher(10, onTrigger);
      let currentIDs = DataStore.getData(watcher, ['TestStore', 'test'], IDS_MASK);
      let currentCodeWatchIDs = DataStore.addCodeWatch(['TestStore', 'test'], IDS_MASK, 0, onCodeWatchTrigger);
      expect(currentCodeWatchIDs).to.exist;

      DataStore.createData(['TestStore', 'test', 'foo13'], { foo: 91 });
      expect(watchTracker.changeTree).to.deep.equal({
        TestStore: {
          test: {
            foo13: { _force: true },
          },
        },
      });

      DataStore.updateData(['TestStore', 'test', 'foo13'], { foo: 92 }); // does not create a change
      expect(watchTracker.changeTree).to.deep.equal({
        TestStore: {
          test: {
            foo13: { _force: true },
          },
        },
      });

      DataStore.createData(['TestStore', 'test', 'foo14'], { foo: 93 });
      expect(watchTracker.changeTree).to.deep.equal({
        TestStore: {
          test: {
            foo13: { _force: true },
            foo14: { _force: true },
          },
        },
      });

      let callCount = 0;
      await DataStoreWatch.flushWatches();
      expect(callCount).to.equal(1);
      DataStore.updateData(['TestStore', 'test', 'foo14'], { foo: 94 }); // does not trigger
      await DataStoreWatch.flushWatches();
      expect(callCount).to.equal(1);
      DataStoreWatch.destroyWatcher(watcher);
      DataStore.removeCodeWatch(['TestStore', 'test'], IDS_MASK, onCodeWatchTrigger);

      function onTrigger(_watcher, changes) {
        callCount++;
        expect(changes.length).to.equal(1);
        const newIDs = changes[0].data; // includes all new and old ids
        const rhsOnly = ObjUtils.objFindRHSOnlyKeys(currentIDs, newIDs);
        expect(rhsOnly).to.deep.equal(['foo13', 'foo14']);
        currentIDs = newIDs;
      }
      function onCodeWatchTrigger(ids) {
        const rhsOnly = ObjUtils.objFindRHSOnlyKeys(currentIDs, ids);
        expect(rhsOnly).to.deep.equal(['foo13', 'foo14']);
        currentCodeWatchIDs = ids;
      }
    });
  });
});
