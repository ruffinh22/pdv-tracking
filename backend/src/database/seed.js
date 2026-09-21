// OBSOLÈTE — ce script créait des données incohérentes (PDV à Paris, noms européens,
// produits « Bonbons / Boisson / Recharge mobile / Cigarettes » qui ne sont pas les
// vrais produits). Il est remplacé par seed-reset.js, qui purge puis recrée un jeu
// de données cohérent (Côte d'Ivoire, 6 produits réels).
//
//   npm run seed:reset -- --yes
console.error('Script obsolète : utilisez  npm run seed:reset -- --yes');
process.exit(1);
