const mockDb = require('mock-knex');
const expect = require('expect');
const db = require('knex')({ client: 'pg' });

const Visions = require('../lib/index');

const models = [
  {
    mapId: 'student',
    idProperty: 'id',
    properties: ['name', 'email'],
    associations: [
      { name: 'tutor', mapId: 'tutor' }
    ],
    collections: [
      { name: 'friends', mapId: 'friend' }
    ]
  },
  {
    mapId: 'tutor',
    idProperty: 'id',
    properties: ['name', 'email'],
    collections: [
      { name: 'students', mapId: 'student' }
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

describe('#getViewNameFor', () => {
  it('returns the view when it exists', () => {
    const visions = new Visions(models, db, views);
    expect(visions.getViewNameFor('student')).toEqual('student_view');
  });

  it('returns the mapId when no view is specified', () => {
    const visions = new Visions(models, db, views);
    expect(visions.getViewNameFor('friend')).toEqual('friend');
  });

  it('throws an error when an invalid view is specified', () => {
    const visions = new Visions(models, db, views);
    expect(() => visions.getViewNameFor('tut')).toThrow(/Invalid model/);
  });
});

describe('#generateQueryFor', () => {

  describe('Single skip and limit calls with views', () => {

    let tracker;
    let generatedQuery;

    before(() => {
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
      const visions = new Visions(models, db, views);

      return visions
        .generateQueryFor('student')
        // Skip past the final result
        .skip(3)
        .limit(9)
        .exec()
        .then(() => {
          tracker.uninstall();
          mockDb.unmock(db);
        });
    });

    it('Should compose a select query', () => {
      expect(generatedQuery.bindings).toEqual([9, 3]);
      expect(generatedQuery.method).toEqual('select');

      // Should use a subquery to apply the limit
      expect(generatedQuery.sql).toContain(
          'with "student_view-core" as (select * from "student_view" limit ? offset ?)');
      // View on student table with alias
      expect(generatedQuery.sql).toContain('select "student_view-core"."id" as "id"');
      // Original table for friend table
      expect(generatedQuery.sql).toContain('"friend"."age" as "friend_age"');
    });

  });

  describe('Single sort call with no views', () => {

    let tracker;
    let generatedQuery;
    let result;

    before(() => {
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
            friend_id: 'f1'
          },
          {
            id: 's1',
            name: 'Jim',
            email: 'jim@school.com',
            tutor: 't1',
            friend_ie: 'f2'
          }
        ]);
      });

      // Run the query
      const visions = new Visions(models, db, {});

      return visions
        .generateQueryFor('student')
        .sort('email', 'asc')
        .exec()
        .then(res => {
          // Save a reference to the result
          result = res;
          tracker.uninstall();
          mockDb.unmock(db);
        });
    });

    it('Should compose a core subquery with the correct sorting applied to it', () => {
      expect(generatedQuery.bindings).toEqual([]);
      expect(generatedQuery.method).toEqual('select');

      expect(generatedQuery.sql).toContain(
          '(select * from "student" order by "student"."email" asc)');
    });

    it('Should construct a single output object', () => {
      expect(result.length).toEqual(1);
      expect(result[0].id).toEqual('s1');
      expect(result[0].name).toEqual('Jim');
      expect(result[0].email).toEqual('jim@school.com');
    });

    it('Should not populate the list of friends', () => {
      const friends = result[0].friends;
      expect(friends.length).toEqual(2);
      expect(friends[0]).toEqual('f1');
      expect(friends[1]).toEqual('f2');
    });

    it('Should not populate the tutor field', () => {
      expect(result[0].tutor).toEqual('t1');
    });

  });

  describe('Single populate call with no views', () => {

    let tracker;
    let generatedQuery;
    let result;

    before(() => {
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
      const visions = new Visions(models, db, {});

      return visions
        .generateQueryFor('student')
        .populate('friends')
        .exec()
        .then(res => {
          // Save a reference to the result
          result = res;
          tracker.uninstall();
          mockDb.unmock(db);
        });
    });

    it('Should compose a select query', () => {
      expect(generatedQuery.bindings).toEqual([]);
      expect(generatedQuery.method).toEqual('select');

      // Un-populated tutor association uses as normal property
      expect(generatedQuery.sql).toContain('"student-core"."tutor" as "tutor"');
      // Properties of populated friends collection prefixed with friend_
      expect(generatedQuery.sql).toContain('"friend"."age" as "friend_age"');
    });

    it('Should construct a single output object', () => {
      expect(result.length).toEqual(1);
      expect(result[0].id).toEqual('s1');
      expect(result[0].name).toEqual('Jim');
      expect(result[0].email).toEqual('jim@school.com');
    });

    it('Should populate the list of friends', () => {
      const friends = result[0].friends;
      expect(friends.length).toEqual(2);
      expect(friends[0].id).toEqual('f1');
      expect(friends[1].id).toEqual('f2');
    });

    it('Should not populate the tutor field', () => {
      expect(result[0].tutor).toEqual('t1');
    });

  });
});
