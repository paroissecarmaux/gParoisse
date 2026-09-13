"use strict";

/* ============================================================
   SERVICE WORKER — cache de l'app shell (fichiers statiques)
   L'application reste fonctionnelle sans lui (toutes les données
   vivent déjà dans IndexedDB, hors ligne par nature) : ce fichier
   ne fait que garantir que les pages/scripts/styles eux-mêmes se
   rechargent instantanément et sans réseau lors des visites
   suivantes, une fois l'app installée/servie au moins une fois.

   Remarque : les navigateurs n'autorisent pas les service workers
   sur file:// — ouvrir index.html en double-clic reste le mode de
   fonctionnement normal de l'app (voir enregistrement conditionnel
   dans js/main.js). Ce cache ne s'active que si l'app est servie
   via http(s) (serveur local, hébergement statique…).
============================================================ */
const CACHE_NAME = "paroisse-secretariat-v7";

const PRECACHE_URLS = [
    "./",
    "./index.html",
    "./manifest.json",
    "./css/style.css",
    "./js/vendor/dexie.min.js",
    "./js/db.js",
    "./js/utils.js",
    "./js/icons.js",
    "./js/csv.js",
    "./js/constants.js",
    "./js/core/errors.js",
    "./js/core/logger.js",
    "./js/core/backup.js",
    "./js/repositories/repositoryFactory.js",
    "./js/repositories/requestsRepository.js",
    "./js/repositories/peopleRepository.js",
    "./js/repositories/scheduleRepository.js",
    "./js/repositories/clochersRepository.js",
    "./js/repositories/personnelRepository.js",
    "./js/repositories/intentionsRepository.js",
    "./js/repositories/historyRepository.js",
    "./js/repositories/settingsRepository.js",
    "./js/core/history.js",
    "./js/state.js",
    "./js/requests.js",
    "./js/people.js",
    "./js/schedule.js",
    "./js/clochers.js",
    "./js/personnel.js",
    "./js/intentions.js",
    "./js/trash.js",
    "./js/overview.js",
    "./js/agenda.js",
    "./js/settings.js",
    "./js/search.js",
    "./js/diagnostics.js",
    "./js/main.js",
    "./icons/icon.svg"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// Stale-while-revalidate : sert le cache immédiatement s'il existe
// (accès instantané, y compris hors ligne) tout en rafraîchissant le
// cache en arrière-plan dès que le réseau répond.
//
// V6.6 : caches.match(event.request) sans précision de cache interroge
// TOUS les caches de l'origine (API CacheStorage), pas seulement
// CACHE_NAME. Pendant la fenêtre (brève mais réelle) où l'ancien ET le
// nouveau cache coexistent — entre l'activation d'une nouvelle version
// (skipWaiting()) et la fin du nettoyage dans "activate" ci-dessus —
// une requête pouvait donc être servie depuis l'ancien cache au lieu du
// nouveau, ou l'inverse, de façon non déterministe : exactement le
// risque de "mélange entre anciens et nouveaux fichiers" à éviter.
// Restreindre explicitement à CACHE_NAME élimine ce risque.
self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return;

    event.respondWith(
        caches.open(CACHE_NAME).then(cache => cache.match(event.request)).then(cached => {
            const network = fetch(event.request).then(response => {
                if (response && response.status === 200) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                }
                return response;
            }).catch(() => cached);

            return cached || network;
        })
    );
});
