"use strict";

const HistoryRepository = createRepository(
    db.history,
    () => db.history.toArray()
);
