"use strict";

const SettingsRepository = createRepository(
    db.settings,
    () => db.settings.toArray()
);
