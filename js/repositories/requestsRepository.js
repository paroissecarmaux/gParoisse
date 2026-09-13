"use strict";

const RequestsRepository = createRepository(
    db.requests,
    () => db.requests.orderBy("updatedAt").reverse().toArray()
);
