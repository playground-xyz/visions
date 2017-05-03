const mockDb = require('mock-knex');
const expect = require('expect');
const db = require('knex')({ client: 'pg' });

const KnexWrapper = require('../index');

const models = [
  {
    mapId: 'student',
    idProperty: 'id',
    properties: ['name', 'email'],
    associations: [
      { name: 'tutor', mapId: 'tutor', columnPrefix: 'tutor_' }
    ],
    collections: [
      { name: 'friends', mapId: 'friend', columnPrefix: 'friend_' }
    ]
  },
  {
    mapId: 'tutor',
    idProperty: 'id',
    properties: ['name', 'email'],
    collections: [
      { name: 'students', mapId: 'student', columnPrefix: 'student_' }
    ]
  },
  {
    mapId: 'friend',
    idProperty: 'id',
    properties: ['age']
  }
];

const views = {
  student: 'student_view',
  tutor: 'tutor_view'
};

describe('Integration tests', function () {
  
  describe('Single skip call with views', function () {
  
    let tracker;
    let generatedQuery;
    let result;

    before(function () {
      // Mock out the knex object
      mockDb.mock(db);
      tracker = mockDb.getTracker();
      tracker.install();

      // Setup the results
      tracker.on('query', query => {

        // Save a reference to the generated query
        generatedQuery = query;
        query.response([
            {
              id: 's1',
              name: 'Jim',
              email: 'jim@school.com',
              tutor: 't1',
              friend: 'f1'
            },
            {
              id: 's1',
              name: 'Jim',
              email: 'jim@school.com',
              tutor: 't1',
              friend: 'f2'
            }
        ]);
      });

      // Run the query
      const queries = new KnexWrapper(models, db);
      queries.applyViews(views);

      return queries
        .selectModel('student')
        // Skip past the final result
        .skip(3)
        .exec()
        .then(res => {
          // Save a reference to the result
          result = res;
          tracker.uninstall();
          mockDb.unmock(db);
        });
    });

    it('Should compose a select query', function () {
      expect(generatedQuery.bindings).toEqual([3]);
      expect(generatedQuery.method).toEqual('select');

      // Should use a subquery to apply the limit
      expect(generatedQuery.sql).toContain('with "student_view-core" as (select * from "student_view" offset ?)');
      // View on student table with alias
      expect(generatedQuery.sql).toContain('select "student_view-core"."id" as "id"');
      // Original table for friend table
      expect(generatedQuery.sql).toContain('"friend"."age" as "friend_age"');
    });

  });

  describe('Single populate call with no views', function () {
  
    let tracker;
    let generatedQuery;
    let result;

    before(function () {
      // Mock out the knex object
      mockDb.mock(db);
      tracker = mockDb.getTracker();
      tracker.install();

      // Setup the results
      tracker.on('query', query => {

        // Save a reference to the generated query
        generatedQuery = query;
        query.response([
            {
              id: 's1',
              name: 'Jim',
              email: 'jim@school.com',
              tutor: 't1',
              friend_age: 22,
              friend_id: 'f1'
            },
            {
              id: 's1',
              name: 'Jim',
              email: 'jim@school.com',
              tutor: 't1',
              friend_age: 26,
              friend_id: 'f2'
            }
        ]);
      });

      // Run the query
      const queries = new KnexWrapper(models, db);
      // No views
      queries.applyViews({});

      return queries
        .selectModel('student')
        .populate('friends')
        .exec()
        .then(res => {
          // Save a reference to the result
          result = res;
          tracker.uninstall();
          mockDb.unmock(db);
        });
    });

    it('Should compose a select query', function () {
      expect(generatedQuery.bindings).toEqual([]);
      expect(generatedQuery.method).toEqual('select');

      // Un-populated tutor association uses as normal property
      expect(generatedQuery.sql).toContain('"student-core"."tutor" as "tutor"');
      // Properties of populated friends collection prefixed with friend_
      expect(generatedQuery.sql).toContain('"friend"."age" as "friend_age"');
    });

    it('Should construct a single output object', function () {
      expect(result.length).toEqual(1);
      expect(result[0].id).toEqual('s1');
      expect(result[0].name).toEqual('Jim');
      expect(result[0].email).toEqual('jim@school.com');
    });

    it('Should populate the list of friends', function () {
      const friends = result[0].friends;
      expect(friends.length).toEqual(2);
      expect(friends[0].id).toEqual('f1');
      expect(friends[1].id).toEqual('f2');
    });

    it('Should not populate the tutor field', function () {
      expect(result[0].tutor).toEqual('t1');
    });

  });
});
