# Visions 

Visions is very much a QueryBuilder not a full ORM. It will not handle schema definitions or migrations, but instead
reduce the amount of repetitive boilerplate queries required for basic selects and joins. There are a couple of interesting
features that are not consistently offered in existing nodejs QueryBuilder libraries.

- Clean database view support
- Model association population using proper database joins (one database query per logical query)

Support for database views are implemented by overlaying a set of view names over the original table names, then
using this "overlay" to generate and rename queries. Once the wrapper function is created, the high-level interface
will substitute all uses of the original table name with the overlayed view. This both simplifies the ease of use
as well as protecting against bugs that use the wrong view in a query.

Model associations are used to dynamically create common query patterns without the boilerplate. The high-level
interface exposes basic options when querying a model, but the `KnexWrapper.getViewName()` method can be used
along with knex to implement more specialised queries when required.

## Install

`npm install --save visions`

## Docs

https://playground-xyz.github.io/visions/

## Usage

Setup your model schema (see [JoinJs](https://github.com/archfirst/joinjs) for details on the structure for
this declaration step). The only difference is that `columnPrefix` is overwritten internally as it must 
match the query generation.

```js

const models = [
  {
    mapId: 'owner',
    idProperty: 'id',
    properties: ['age', 'birthday'],
    collections: [
      { name: 'pets', mapId: 'pet' }
    ]
  },
  {
    mapId: 'pet',
    idProperty: 'id',
    associations: [
      { name: 'owner', mapId: 'owner' }
    ]
  }
];
```

Use a middleware to determine a set of database views for the request. This part of the code example is
very vague as the structure of views in an application varies based on the use-case.

```js
const Visions = require('visions');
const app = express();
const knex = require('knex')(config.database);

app.use(async (req, res, next) => {

  // The structure of your views is completely up to your use-case
  const viewId = await determineViewIdForRequest(req.user.id);
  const views = {
    owner: `${viewId}__owner`,
    pet: `${viewId}__pet`
  };

  // Attach the querybuilder instance to the request object
  req.visions = new Visions(models, knex, views);

  next();
});
```

Finally, in your controllers you can write simple, readable queries.

```js
app.get('/owner/:id', (req, res) => {
  req.visions.generateQueryFor('owner')
      .populate('pet')
      .sort('birthday', 'asc')
      .limit(req.query.limit)
      .skip(req.query.skip)
      .where({
        key: 'id',
        value: req.params.id
      })
      .exec()
      .then(data => res.status(200).send(data))
      .catch(err => res.status(500).send({ error: err }));
});
```

Or use knex directly for more complex queries.

```js
app.get('/owner/:id', (req, res) => {
  knex
    .select()
    // This will use the view you overlayed on the owner model for this request
    // (or just "owner") if you didn't specify a view for it
    .from(req.visions.getViewNameFor('owner'))
    .rightOuterJoin(
        req.visions.getViewNameFor('pet'),
        `${req.visions.getViewNameFor('pet')}.owner`,
        `${req.visions.getViewNameFor('owner')}.id`,
    ).then(data => res.status(200).send(data));
});
```

## 1-1 and M-N Relationships

1-1 and M-N are special cases of collections respectively and require flags in the mapping
object to identify them.

### 1-1 Relationships

The only change required for 1-1 relationships is that a flag is added to the collection.

```js
const models = [
  {
    mapId: 'person',
    idProperty: 'id',
    collections: [
      { name: 'father', mapId: 'father', isOneToOne: true }
    ]
  }
];
```

### M-N Relationships

This library assumes that the database schema is properly normalised and therefore includes
a minimal join table between the 2 joined entities. This is to be defined as part of the
relationship in the mapping object.

```js
const models = [
  {
    mapId: 'employee',
    idProperty: 'id',
    collections: [
      { name: 'managers', mapId: 'manager', joinTable: 'employee_manager_join' }
    ]
  },
  {
    mapId: 'manager',
    idProperty: 'id',
    associations: [
      { name: 'staff', mapId: 'employee', joinTable: 'employee_manager_join' }
    ]
  }
];
```

with the database schema defined as:

```sql
CREATE TABLE employee ( id integer NOT NULL PRIMARY KEY );
CREATE TABLE manager ( id integer NOT NULL PRIMARY KEY );

CREATE TABLE employee_manager_join (
  employee integer NOT NULL,
  manager integer NOT NULL,
  PRIMARY_KEY(employee, manager)
);
```

Note that the keys in the join table are the same as the original tables they reference.

## Dependencies

- [JoinJs](https://github.com/archfirst/joinjs)
