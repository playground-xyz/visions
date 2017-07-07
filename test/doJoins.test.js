const expect = require('expect');

const doJoins = require('../lib/doJoins');

const models = [
  {
    mapId: 'student',
    viewId: 'student',
    idProperty: 'id',
    properties: ['name', 'email'],
    associations: [
      { name: 'tutor', mapId: 'tutor', viewId: 'tutor', columnPrefix: 'tutor_' }
    ],
    collections: [
      { name: 'friends', mapId: 'friend', viewId: 'friend_view', columnPrefix: 'friend_' }
    ]
  },
  {
    mapId: 'tutor',
    viewId: 'tutor',
    idProperty: 'id',
    properties: ['name', 'email'],
    collections: [
      { name: 'students', mapId: 'student', viewId: 'student', columnPrefix: 'student_' }
    ],
    associations: []
  },
  {
    mapId: 'friend',
    viewId: 'friend_view',
    idProperty: 'id',
    properties: ['age'],
    associations: [
      { name: 'tutor', mapId: 'tutor', viewId: 'tutor', columnPrefix: 'tutor_' }
    ],
    collections: []
  }
];

describe('DoJoins', () => {

  it('Association and Collection', () => {
    const modifiedModel = {
      mapId: 'student',
      viewId: 'student-view',
      idProperty: 'id',
      properties: ['name', 'email'],
      associations: [
        { name: 'tutor', mapId: 'tutor', viewId: 'tutor', populate: true, columnPrefix: 'tutor_' }
      ],
      collections: [
        { name: 'friends', mapId: 'friend', viewId: 'friend_view', columnPrefix: 'friend_' }
      ]
    };
    const results = [
      {
        id: 'JAMES_ID',
        name: 'James',
        email: 'james@email.com',
        tutor_id: 'TIM_ID',
        tutor_name: 'Tim',
        tutor_email: 'tim@email.com',
        friend_id: 'FRED_ID',
        friend_age: 22,
        friend_tutor: 'TIM_ID'
      },
      {
        id: 'JAMES_ID',
        name: 'James',
        email: 'james@email.com',
        tutor_id: 'TIM_ID',
        tutor_name: 'Tim',
        tutor_email: 'tim@email.com',
        friend_id: 'JOE_ID',
        friend_age: 22,
        friend_tutor: 'TIM_ID'
      }
    ];
    expect(doJoins(results, models, models[0], modifiedModel)).toEqual([
      {
        id: 'JAMES_ID',
        name: 'James',
        email: 'james@email.com',
        friends: [
          'FRED_ID',
          'JOE_ID'
        ],
        tutor: {
          id: 'TIM_ID',
          name: 'Tim',
          email: 'tim@email.com'
        }
      }
    ]);
  });

  it('Association only', () => {
    const modifiedModel = {
      mapId: 'friend',
      viewId: 'friend_view',
      idProperty: 'id',
      properties: ['age'],
      associations: [
        { name: 'tutor', mapId: 'tutor', viewId: 'tutor', columnPrefix: 'tutor_', populate: true }
      ],
      collections: []
    };
    const results = [
      {
        id: 'JAMES_ID',
        age: 23,
        tutor_id: 'TIM_ID',
        tutor_name: 'Tim',
        tutor_email: 'tim@email.com',
      },
      {
        id: 'JOE_ID',
        age: 29,
        tutor_id: 'TIM_ID',
        tutor_name: 'Tim',
        tutor_email: 'tim@email.com',
      }
    ];
    expect(doJoins(results, models, models[2], modifiedModel)).toEqual([
      {
        id: 'JAMES_ID',
        age: 23,
        tutor: {
          id: 'TIM_ID',
          name: 'Tim',
          email: 'tim@email.com',
        }
      },
      {
        id: 'JOE_ID',
        age: 29,
        tutor: {
          id: 'TIM_ID',
          name: 'Tim',
          email: 'tim@email.com',
        }
      }
    ]);
  });


});

