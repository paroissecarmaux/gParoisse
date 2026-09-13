"use strict";

const DirectoryRepository = createRepository(
    db.directory,
    () => db.directory.orderBy("updatedAt").reverse().toArray()
);
