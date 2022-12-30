/**
 * Copyright 2015-present Ampersand Technologies, Inc.
 */

import * as ObjMerge from '../lib/objMerge';

import * as SchemaType from 'amper-schema/dist/types';
import { expect } from 'chai';
import { describe, it } from 'mocha';

const ENUM_TYPE = SchemaType.createEnum('ENUM_TYPE', ['ONE', 'TWO']);

describe('ObjMerge', function() {
  const schema = {
    drafts: {
      _ids: {
        editCount: SchemaType.INT,
        firstOpen: SchemaType.BOOL,
        eTest: ENUM_TYPE,
        objTest: SchemaType.OBJECT_NULLABLE,
        blobTest: SchemaType.JSONBLOB_NULLABLE,
        glossary: {
          _ids: {
            word: SchemaType.SHORTSTR,
            definition: SchemaType.LONGSTR_NULLABLE,
          },
        },
      },
    },
    custom: {
      _nullable: true,
      grapes: SchemaType.INT,
      subobj: {
        somefield: SchemaType.INT,
      },
    },
  };

  const options = {
    schema: schema,
    futureFeed: true,
  };

  const options2 = {
    schema: schema,
    futureFeed: false,
  };

  describe('pathCreate', function() {
    it('should apply defaults (PastFeed)', function() {
      const db = {
        drafts: {},
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'create', ['drafts', 'foo'], { editCount: 10 }, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            eTest: 'ONE',
            objTest: null,
            blobTest: null,
            glossary: {},
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: { _force: true },
        },
      });
    });

    it('should apply unknown fields (FutureFeed)', function() {
      const db = {
        drafts: {},
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'create', ['drafts', 'foo'], {
        editCount: 10,
        futureVal: 20,
        eTest: 'THREE',
      }, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            eTest: 'THREE',
            objTest: null,
            blobTest: null,
            futureVal: 20,
            glossary: {},
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: { _force: true },
        },
      });
    });

    it('should create unknown subobjects (FutureFeed)', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: null,
            futureVal: 20,
            glossary: {},
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'create', ['drafts', 'foo', 'futureObj', 'bar'], {
        futureVal2: 34,
      }, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: null,
            futureVal: 20,
            glossary: {},
            futureObj: {
              bar: {
                futureVal2: 34,
              },
            },
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            futureObj: { _force: true },
          },
        },
      });
    });

    it('should apply to nullable object types', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: null,
            glossary: {},
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'create', ['drafts', 'foo', 'objTest'], { foo: 10, bar: 12 }, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: { foo: 10, bar: 12 },
            glossary: {},
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            objTest: { _force: true },
          },
        },
      });
    });

    it('should apply to nullable object types without futureFeed', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: null,
            glossary: {},
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'create', ['drafts', 'foo', 'objTest'], { foo: 10, bar: 12 }, undefined, options2, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: { foo: 10, bar: 12 },
            glossary: {},
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            objTest: { _force: true },
          },
        },
      });
    });

    it('should apply with subobjects', function() {
      const db = {
        drafts: {},
        custom: null,
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'create', ['custom'], { grapes: 12, subobj: {somefield: 10} }, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {},
        custom: {
          grapes: 12,
          subobj: {
            somefield: 10,
          },
        },
      });
      expect(changeTree).to.deep.equal({
        custom: { _force: true },
      });
    });
  });

  describe('pathReplace', function() {
    it('should replace if path exists', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 20,
            firstOpen: true,
            eTest: 'TWO',
            objTest: null,
            futureKey: 73,
            glossary: {
              foo2: {},
            },
          },
          bar: {
            editCount: 30,
            firstOpen: false,
            glossary: {
              foo3: {},
            },
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'replace', ['drafts', 'foo'], { editCount: 10 }, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            eTest: 'ONE',
            objTest: null,
            glossary: {},
          },
          bar: {
            editCount: 30,
            firstOpen: false,
            glossary: {
              foo3: {},
            },
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            editCount: { _force: true },
            firstOpen: { _force: true },
            eTest: { _force: true },
            futureKey: { _force: true },
            glossary: { _force: true },
          },
        },
      });
    });

    it('should create if path does not exist', function() {
      const db = {
        drafts: {},
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'replace', ['drafts', 'foo'], {
        editCount: 10,
        futureVal: 20,
        eTest: 'THREE',
      }, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            eTest: 'THREE',
            objTest: null,
            blobTest: null,
            futureVal: 20,
            glossary: {},
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: { _force: true },
        },
      });
    });

    it('should replace if field exists', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 20,
            firstOpen: true,
            eTest: 'TWO',
            objTest: null,
            glossary: {
              foo2: {},
            },
          },
          bar: {
            editCount: 30,
            firstOpen: false,
            objTest: null,
            glossary: {
              foo3: {},
            },
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'replace', ['drafts', 'foo', 'editCount'], 10, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: true,
            eTest: 'TWO',
            objTest: null,
            glossary: {
              foo2: {},
            },
          },
          bar: {
            editCount: 30,
            firstOpen: false,
            objTest: null,
            glossary: {
              foo3: {},
            },
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            editCount: { _force: true },
          },
        },
      });
    });

    it('should not mark changed if unchanged', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 20,
            firstOpen: true,
            eTest: 'TWO',
            objTest: null,
            glossary: {
              foo2: {},
            },
          },
          bar: {
            editCount: 30,
            firstOpen: false,
            objTest: null,
            glossary: {
              foo3: {},
            },
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'replace', ['drafts', 'foo', 'editCount'], 20, undefined, options, false, changeTree);
      expect(res).to.equal(false);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 20,
            firstOpen: true,
            eTest: 'TWO',
            objTest: null,
            glossary: {
              foo2: {},
            },
          },
          bar: {
            editCount: 30,
            firstOpen: false,
            objTest: null,
            glossary: {
              foo3: {},
            },
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            editCount: {},
          },
        },
      });
    });

    it('should not mark changed if unchanged for null', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 20,
            firstOpen: true,
            eTest: 'TWO',
            objTest: null,
            glossary: {
              foo2: {},
            },
          },
          bar: {
            editCount: 30,
            firstOpen: false,
            objTest: null,
            glossary: {
              foo3: {},
            },
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'replace', ['drafts', 'foo', 'objTest'], null, undefined, options, false, changeTree);
      expect(res).to.equal(false);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 20,
            firstOpen: true,
            eTest: 'TWO',
            objTest: null,
            glossary: {
              foo2: {},
            },
          },
          bar: {
            editCount: 30,
            firstOpen: false,
            objTest: null,
            glossary: {
              foo3: {},
            },
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            objTest: {},
          },
        },
      });
    });

    it('should replace json blob field', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 20,
            firstOpen: true,
            eTest: 'TWO',
            objTest: null,
            blobTest: null,
            glossary: {
              foo2: {},
            },
          },
        },
      };
      const changeTree = {};

      let res = ObjMerge.applyAction(db, 'replace', ['drafts', 'foo', 'blobTest'], 10, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 20,
            firstOpen: true,
            eTest: 'TWO',
            objTest: null,
            blobTest: 10,
            glossary: {
              foo2: {},
            },
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            blobTest: { _force: true },
          },
        },
      });

      res = ObjMerge.applyAction(db, 'replace', ['drafts', 'foo', 'blobTest'], { replaced: 'obj' }, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 20,
            firstOpen: true,
            eTest: 'TWO',
            objTest: null,
            blobTest: { replaced: 'obj' },
            glossary: {
              foo2: {},
            },
          },
        },
      });
    });

    it('should replace json blob object', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 20,
            firstOpen: true,
            eTest: 'TWO',
            objTest: null,
            blobTest: null,
            glossary: {
              foo2: {},
            },
          },
        },
      };
      const changeTree = {};

      let res = ObjMerge.applyAction(db, 'replace', ['drafts', 'foo', 'blobTest'], { stuff: 'junk' }, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 20,
            firstOpen: true,
            eTest: 'TWO',
            objTest: null,
            blobTest: { stuff: 'junk' },
            glossary: {
              foo2: {},
            },
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            blobTest: { _force: true },
          },
        },
      });

      res = ObjMerge.applyAction(db, 'replace', ['drafts', 'foo', 'blobTest'], { replaced: 'obj' }, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 20,
            firstOpen: true,
            eTest: 'TWO',
            objTest: null,
            blobTest: { replaced: 'obj' },
            glossary: {
              foo2: {},
            },
          },
        },
      });

      res = ObjMerge.applyAction(db, 'replace', ['drafts', 'foo', 'blobTest'], 50, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 20,
            firstOpen: true,
            eTest: 'TWO',
            objTest: null,
            blobTest: 50,
            glossary: {
              foo2: {},
            },
          },
        },
      });
    });

    it('should replace map elements', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 20,
            firstOpen: true,
            eTest: 'TWO',
            objTest: null,
            blobTest: null,
            glossary: {
              foo2: {},
            },
          },
          bar: {
            editCount: 30,
            firstOpen: false,
            eTest: 'THREE',
            objTest: null,
            blobTest: null,
            glossary: {
              foo3: {},
            },
          },
        },
      };
      const changeTree = {};

      const newObjs = {
        bar: {
          editCount: 30,
          firstOpen: true,
        },
        baz: {
          editCount: 7,
          firstOpen: false,
          objTest: null,
          glossary: {
          },
        },
      };
      const res = ObjMerge.applyAction(db, 'replace', ['drafts'], newObjs, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          bar: {
            editCount: 30,
            firstOpen: true,
            eTest: 'ONE',
            objTest: null,
            blobTest: null,
            glossary: {},
          },
          baz: {
            editCount: 7,
            firstOpen: false,
            eTest: 'ONE',
            objTest: null,
            blobTest: null,
            glossary: {
            },
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: { _force: true },
          bar: {
            editCount: {},
            firstOpen: { _force: true },
            eTest: { _force: true },
            glossary: { _force: true },
          },
          baz: { _force: true },
        },
      });
    });

    it('should replace nullable object', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: { a: 2, b: 2 },
            glossary: {},
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'replace', ['drafts', 'foo', 'objTest'], { foo: 10, bar: 12 }, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: { foo: 10, bar: 12 },
            glossary: {},
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            objTest: { _force: true },
          },
        },
      });
    });

    it('should create nullable object', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: null,
            glossary: {},
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'replace', ['drafts', 'foo', 'objTest'], { foo: 10, bar: 12 }, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: { foo: 10, bar: 12 },
            glossary: {},
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            objTest: { _force: true },
          },
        },
      });
    });

    it('should create nullable object without futureFeed', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: null,
            glossary: {},
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'replace', ['drafts', 'foo', 'objTest'], { foo: 10, bar: 12 }, undefined, options2, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: { foo: 10, bar: 12 },
            glossary: {},
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            objTest: { _force: true },
          },
        },
      });
    });

    it('should replace with null for manual nullable fields', function() {
      const db = {
        custom: {
          grapes: 50,
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'replace', ['custom'], null, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        custom: null,
      });
      expect(changeTree).to.deep.equal({
        custom: { _force: true },
      });
    });
  });

  describe('pathUpdate', function() {
    it('should apply values', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: null,
            futureVal: 20,
            glossary: {},
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'update', ['drafts', 'foo'], { editCount: 15 }, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 15,
            firstOpen: false,
            objTest: null,
            futureVal: 20,
            glossary: {},
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            editCount: { _force: true },
          },
        },
      });
    });

    it('should apply leaf value', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: null,
            futureVal: 20,
            glossary: {},
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'update', ['drafts', 'foo', 'editCount'], 18, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 18,
            firstOpen: false,
            objTest: null,
            futureVal: 20,
            glossary: {},
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            editCount: { _force: true },
          },
        },
      });
    });

    it('should not mark changed if unchanged', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: null,
            futureVal: 20,
            glossary: {},
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'update', ['drafts', 'foo', 'editCount'], 10, undefined, options, false, changeTree);
      expect(res).to.equal(false);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: null,
            futureVal: 20,
            glossary: {},
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            editCount: {},
          },
        },
      });
    });

    it('should apply unknown fields (FutureFeed)', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: null,
            futureVal: 20,
            glossary: {},
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'update', ['drafts', 'foo'], { editCount: 20, futureVal2: 60 }, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 20,
            firstOpen: false,
            objTest: null,
            futureVal: 20,
            futureVal2: 60,
            glossary: {},
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            editCount: { _force: true },
            futureVal2: { _force: true },
          },
        },
      });
    });

    it('should update nullable object without futureFeed', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: null,
            glossary: {},
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'update', ['drafts', 'foo'], { objTest: { foo: 10, bar: 12 } }, undefined, options2, true, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: { foo: 10, bar: 12 },
            glossary: {},
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            objTest: { _force: true },
          },
        },
      });
    });

    it('should update a nullable string', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: null,
            glossary: {
              gloss1: {
                word: 'foo',
                definition: null,
              },
            },
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'update', ['drafts', 'foo', 'glossary', 'gloss1', 'definition'],
        'bar is rad', undefined, options, true, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: null,
            glossary: {
              gloss1: {
                word: 'foo',
                definition: 'bar is rad',
              },
            },
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            glossary: {
              gloss1: {
                definition: { _force: true },
              },
            },
          },
        },
      });
    });

    it('should apply max', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 10,
            viewCount: 20,
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'max', ['drafts', 'foo'], { editCount: 15, viewCount: 10 }, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 15,
            viewCount: 20,
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            editCount: { _force: true },
            viewCount: {},
          },
        },
      });
    });

    it('should apply min', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 10,
            viewCount: 20,
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'min', ['drafts', 'foo'], { editCount: 15, viewCount: 10 }, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 10,
            viewCount: 10,
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            editCount: {},
            viewCount: { _force: true },
          },
        },
      });
    });

    it('should apply max recursively', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 10,
            viewCount: 20,
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'max', ['drafts'], { foo: { editCount: 15, viewCount: 10 } }, undefined, options, true, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 15,
            viewCount: 20,
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            editCount: { _force: true },
            viewCount: {},
          },
        },
      });
    });

    it('should apply min recursively', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 10,
            viewCount: 20,
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'min', ['drafts'], { foo: { editCount: 15, viewCount: 10 } }, undefined, options, true, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 10,
            viewCount: 10,
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            editCount: {},
            viewCount: { _force: true },
          },
        },
      });
    });

  });

  describe('pathRemove', function() {
    it('should remove', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: null,
            futureVal: 20,
            glossary: {},
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'remove', ['drafts', 'foo'], {}, undefined, options, false, changeTree);
      expect(res).to.equal(true);
      expect(db).to.deep.equal({
        drafts: {
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: { _force: true },
        },
      });
    });

    it('should ignore unknown paths (FutureFeed)', function() {
      const db = {
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: null,
            futureVal: 20,
            glossary: {},
          },
        },
      };
      const changeTree = {};

      const res = ObjMerge.applyAction(db, 'remove', ['drafts', 'foo', 'futureMap', 'bar'], {}, undefined, options, false, changeTree);
      expect(res).to.equal(false);
      expect(db).to.deep.equal({
        drafts: {
          foo: {
            editCount: 10,
            firstOpen: false,
            objTest: null,
            futureVal: 20,
            glossary: {},
          },
        },
      });
      expect(changeTree).to.deep.equal({
        drafts: {
          foo: {
            futureMap: {},
          },
        },
      });
    });
  });

});
