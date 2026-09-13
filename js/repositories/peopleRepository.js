"use strict";

const PeopleRepository = createRepository(
    db.people,
    () => db.people.orderBy("updatedAt").reverse().toArray()
);
