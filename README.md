# knex-wrapper

A relational DB query wrapper with support for views and model associations. Uses join-js internally to convert from relational results to nested JSON objects.

### API

#### constructor(models, knex)


#### applyViews(viewsObject)


#### selectModel(modelId)


#### populate(modelId)


#### where(whereClauses)


#### skip(int)


#### limit(int)


#### sort(prop, dir)


#### exec()


