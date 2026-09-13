"use strict";

const IntentionsRepository = createRepository(
    db.intentions,
    () => db.intentions.orderBy("dateDebut").toArray()
);
