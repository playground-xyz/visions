const mockDb = require('mock-knex');
const expect = require('expect');
const db = require('knex')({ client: 'pg' });

const constructQuery = require('../lib/constructQuery');

const models = [
  {
    mapId: 'student',
    viewId: 'student',
    idProperty: 'id',
    properties: ['name', 'email'],
    associations: [
      { name: 'tutor', mapId: 'tutor', viewId: 'tutor', populate: true }
    ],
    collections: [
      { name: 'friends', mapId: 'friend', viewId: 'friend_view' }
    ]
  },
  {
    mapId: 'tutor',
    viewId: 'tutor',
    idProperty: 'id',
    properties: ['name', 'email'],
    collections: [
      { name: 'students', mapId: 'student', viewId: 'student', populate: true }
    ],
    associations: []
  },
  {
    mapId: 'friend',
    viewId: 'friend_view',
    idProperty: 'id',
    properties: ['age'],
    associations: [
      { name: 'tutor', mapId: 'tutor', viewId: 'tutor' }
    ],
  },
  {
    mapId: 'human',
    viewId: 'human_view',
    idProperty: 'id',
    properties: ['height', 'weight'],
    collections: [
      { name: 'friends', mapId: 'friend', viewId: 'friend', populate: false, ignore: true },
      { name: 'students', mapId: 'student', viewId: 'student', populate: true, ignore: false }
    ],
    associations: [
      { name: 'students', mapId: 'student', viewId: 'student', populate: false, ignore: true },
      { name: 'tutors', mapId: 'tutor', viewId: 'tutor', populate: false, ignore: false }
    ]
  },
  {
    mapId: 'college',
    viewId: 'college',
    idProperty: 'id',
    properties: ['location'],
    association: [],
  }
];

describe('ConstructQuery', () => {

  let tracker;
  let generatedQuery;
  before(() => {
    mockDb.mock(db);
    tracker = mockDb.getTracker();
    tracker.install();

    tracker.on('query', query => {
      generatedQuery = query;
      query.response([]);
    });
  });

  after(() => {
    tracker.uninstall();
    mockDb.unmock(db);
  });

  describe('#addCollectionSelects', () => {

    it('should select the properties of a collection', () => {
      const selects = constructQuery._addCollectionSelects(
          models[0].collections[0], models[0], models);

      expect(selects).toEqual([
        'friend_view.age as friend_age',
        'friend_view.id as friend_id',
      ]);
    });

    it('should select the associations of the collection when populate=true', () => {
      const selects = constructQuery._addCollectionSelects(
          models[1].collections[0], models[1], models);

      expect(selects).toEqual([
        'student.name as student_name',
        'student.email as student_email',
        'student.id as student_id',
        'student.tutor as student_tutor'
      ]);
    });

    it('should return no selects if a collection is set to ignore true', () => {
      const selects = constructQuery._addCollectionSelects(
          models[3].collections[0], models[3], models);

      expect(selects).toEqual([]);
    });

    it(
      'should select the associations of the selection when ignore false and populate true',
    () => {
      const selects = constructQuery._addCollectionSelects(
          models[3].collections[1], models[3], models);

      expect(selects).toEqual([
        'student.name as student_name',
        'student.email as student_email',
        'student.id as student_id',
        'student.tutor as student_tutor'
      ]);
    });

  });

  describe('#addAssociationSelects', () => {

    it('should only select the id property on the (core) table when populate=false', () => {
      const selects = constructQuery._addAssociationSelects(
          models[2].associations[0], models[2], models);

      expect(selects).toEqual(['friend_view-core.tutor as tutor']);
    });

    it('should select properties on the association when populate=true', () => {
      const selects = constructQuery._addAssociationSelects(
          models[0].associations[0], models[0], models);

      expect(selects).toEqual([
        'tutor.name as tutor_name',
        'tutor.email as tutor_email',
        'tutor.id as tutor_id'
      ]);
    });

    it('should return an empty select array when ignore is true', () => {
      const selects = constructQuery._addAssociationSelects(
        models[3].associations[0], models[3], models);

      expect(selects).toEqual([]);
    });

    it(
      'should only select the ID property on the core table when populate false and ignore false',
    () => {
      const selects = constructQuery._addAssociationSelects(
        models[3].associations[1], models[3], models);

      expect(selects).toEqual([
        'human_view-core.tutor as tutor'
      ]);
    });

  });

  describe('#constructSelects', () => {
    it('should select all the relevant fields', () => {
      const selects = constructQuery._constructSelects(models, models[0], false);
      expect(selects).toEqual([
        // The main model properties
        'student-core.id as id',
        'student-core.name as name',
        'student-core.email as email',

        // the associations properties
        'tutor.name as tutor_name',
        'tutor.email as tutor_email',
        'tutor.id as tutor_id',

        // The collections properties
        'friend_view.age as friend_age',
        'friend_view.id as friend_id'
      ]);
    });

    it('should include the full_count select', () => {
      const selects = constructQuery._constructSelects(models, models[0], true);
      expect(selects).toEqual([
        // The main model properties
        'student-core.id as id',
        'student-core.name as name',
        'student-core.email as email',

        // the associations properties
        'tutor.name as tutor_name',
        'tutor.email as tutor_email',
        'tutor.id as tutor_id',

        // The collections properties
        'friend_view.age as friend_age',
        'friend_view.id as friend_id',
        'full_count AS full_count'
      ]);
    });
  });

  describe('#constructSubQuery', () => {

    it('should construct a subQuery and apply the parameters given', () => {

      const qb = constructQuery._constructSubQuery(
          db,
          db,
          'student',
          4,         // limit
          7,         // skip
          'name',    // sortAttr
          'asc',     // sortDir
          []
      );

      return qb.then(() => {
        expect(generatedQuery.sql).toEqual(
            'select "student".* from "student" order by "student"."name" asc limit ? offset ?');
        expect(generatedQuery.bindings).toEqual([4, 7]);
      });

    });
  });

  describe('#constructQuery', () => {

    it('should generate a standard query for the supplied model', () => {

      const qb = constructQuery(
          models,
          models[0],
          db,
          [{ key: 'id', values: ['ID_1', 'ID_2'] }],
          'name',    // sortAttr
          'asc',     // sortDir
          4,         // limit
          7          // skip
      );

      return qb.then(() => {
        // Subquery
        expect(generatedQuery.sql).toContain(
            'select "student".* from "student" where "student"."id" in (?, ?) order ' +
            'by "student"."name" asc limit ? offset ?');

        // join tutor (assoc)
        expect(generatedQuery.sql).toContain(
            'left join "tutor" on "tutor"."id" = "student-core"."tutor"');

        // join friend (coll)
        expect(generatedQuery.sql).toContain(
            'left join "friend_view" on "student-core"."id" = "friend_view"."student"');

        // Outer query sorting
        expect(generatedQuery.sql).toContain('order by "student-core"."name" asc');
        // Bindings
        expect(generatedQuery.bindings).toEqual(['ID_1', 'ID_2', 4, 7]);
      });

    });
  });

  describe('#constructWhere', () => {
    it('should generate a query with operator in the where clause', () => {

      const qb = constructQuery(
          models,
          models[0],
          db,
          [{ key: 'id', operator: 'like', value: '%test%' }],
          'name',    // sortAttr
          'asc',     // sortDir
          4,         // limit
          7          // skip
      );

      return qb.then(() => {
        // Subquery
        expect(generatedQuery.sql).toContain(
            'select "student".* from "student" where "student"."id" like ? order ' +
            'by "student"."name" asc limit ? offset ?');

        // Bindings
        expect(generatedQuery.bindings).toEqual(['%test%', 4, 7]);
      });
    });
  });

  describe('#constructWhereAfterJoin', () => {
    it('should generate a query that filters on a non-core table', () => {
      const qb = constructQuery(
        models,
        models[0],
        db,
        [],
        null,
        null,
        null,
        null,
        null,
        {
          primaryJoin: 'tutor',
          secondaryJoin: 'college',
          value: 'test',
        }
      );

      return qb.then(() => {
        expect(generatedQuery.sql).toContain(
          'with "student-core" as (select "student".* from "student" left join ' +
          '"tutor" on "tutor"."id" = "student"."tutor" where "tutor"."college" = ?'
        );
      });
    });
  });

  describe('#constructOuterQuery', () => {
    it('should generate a query with a view lookup', () => {

      const qb = constructQuery(
          models,
          models[0],
          db,
          [{ model: 'student', key: 'id', value: '10' }]
      );

      return qb.then(() => {
        // Subquery
        expect(generatedQuery.sql).toContain(
          // The main model properties
          '"student-core"."id" as "id"'
        );
        expect(generatedQuery.sql).toContain(
          'left join "tutor" on "tutor"."id" = "student-core"."tutor"');
        // join friend (coll)
        expect(generatedQuery.sql).toContain(
          'left join "friend_view" on "student-core"."id" = "friend_view"."student"');
        // Bindings
        expect(generatedQuery.bindings).toEqual(['10']);
      });
    });
  });
});
