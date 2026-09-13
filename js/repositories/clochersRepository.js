"use strict";

const ClochersRepository = createRepository(
    db.clochers,
    () => db.clochers.orderBy("updatedAt").reverse().toArray()
);
