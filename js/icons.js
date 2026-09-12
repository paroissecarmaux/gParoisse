"use strict";

/* ============================================================
   ICÔNES
   Les formes sont définies une seule fois (sprite SVG au début
   du <body>) ; cette fonction ne fait que référencer un symbole
   par id, pour générer une icône dans du HTML construit en JS.
============================================================ */
function icon(name, extraClass) {
    return `<svg class="icon${extraClass ? " " + extraClass : ""}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}
