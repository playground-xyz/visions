# knex-wrapper

KnexWrapper is very much a QueryBuilder not a full ORM. It will not handle schema definitions or migrations, but instead
allows you to manage your own database without writing repetitive boilerplate queries for basic selects and joins. There are
a couple of interesting features that are not offered in existing nodejs QueryBuilder libraries:

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

`npm install --save @playgroundxyz/knex-wrapper`

## Usage

Setup your model schema (see (JoinJs)[https://github.com/archfirst/joinjs] for details on the structure for this declaration step). The only
difference is that `columnPrefix` is not required as it must match the query generation.

```js
const KnexWrapper = require('@playgroundxyz/knex-wrapper');

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
const app = express();
const knex = require('knex')(config.database);

app.use(async (req, res, next) => {

  // The structure of your views is completely up to your use-case
  const viewId = await determineViewIdForRequest(req.user.id);
  const views = {
    owner: `${viewId}__owner`,
    pet: `${viewId}__pet`
  };

  req.queries = new KnexWrapper(models, knex);
  req.queries.applyViews(views);

  next();
});
```

Finally, in your controllers you can write simple, readable queries.

```js
app.get('/owner/:id', (req, res) => {
  req.queries.selectModel('owner')
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
    .from(req.queries.getViewName('owner'))
    .rightOuterJoin(
        req.queries.getViewName('pet'),
        `${req.queries.getViewName('pet')}.owner`,
        `${req.queries.getViewName('owner')}.id`,
    ).then(data => res.status(200).send(data));
});
```

## Dependencies

- JoinJs

## API

### KnexWrapper

#### constructor(models, knex)

Creates a new KnexWrapper object with a instance of knex and a join-js representation of the models.

#### applyViews(viewsObject)

Apply a mapping of views to the models to replace all uses of the original table with the specified tables

#### selectModel(modelId)

Creates a "Prepared Query" object for the modelId selected

#### getViewName(modelId)

Returns the name of the view for the model


### PreparedQuery

#### populate(modelId)

Sets the modelId to be populated for this query

#### where(whereClauses)

Adds a where clause to the query

#### skip(int)

Sets the offset from the start of the result set

#### limit(int)

Sets the max number of results to be fetched

#### sort(prop, dir)

Sets the property and direction to sort the results based on

#### exec()

Runs the query and returns a promise resolving to the result set (in nested JSON form)

