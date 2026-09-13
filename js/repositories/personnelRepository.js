"use strict";

const PersonnelRepository = createRepository(
    db.personnel,
    () => db.personnel.orderBy("updatedAt").reverse().toArray()
);
