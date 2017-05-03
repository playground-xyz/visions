# knex-wrapper

A relational DB query wrapper with support for views and model associations. Uses join-js internally to convert from relational results to nested JSON objects.

### API

#### constructor(models, knex)

Creates a new KnexWrapper object with a instance of knex and a join-js representation of the models.

#### applyViews(viewsObject)

Apply a mapping of views to the models to replace all uses of the original table with the specified tables

#### selectModel(modelId)

Creates a "Prepared Query" object for the modelId selected

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

