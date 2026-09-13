"use strict";

const ScheduleRepository = createRepository(
    db.schedule,
    () => db.schedule.orderBy("updatedAt").reverse().toArray()
);
