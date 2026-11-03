# Doux Beau Bois

Site vitrine responsive avec accueil, catalogue, page À propos, formulaire de devis et administration. Le contenu public et les réglages du site sont chargés depuis le stockage; les données de démonstration servent au premier démarrage.

## Développement local

```sh
npm install
cp .env.example .env
npm run dev
```

Le frontend est servi sur `http://localhost:5173` et l’API sur le port `4179`. Sans `DATABASE_URL`, le développement conserve les données dans `data/site.json`.

Pour tester localement avec Neon, ajoute l’URL de connexion de la branche de développement à `.env`, puis lance `npm run db:setup`. Le schéma est aussi créé automatiquement lors du premier appel API.

## Déploiement Vercel + Neon

1. Crée une base Neon (PostgreSQL) et copie sa connection string **pooled** depuis le tableau de bord Neon.
2. Importe le dépôt du projet dans Vercel. Le framework est Vite, la commande de build est `npm run build` et le dossier généré est `dist` (ces valeurs sont déjà indiquées dans `vercel.json`).
3. Dans les variables d’environnement Vercel, ajoute `DATABASE_URL`, `ADMIN_USER`, `ADMIN_PASSWORD` et `SESSION_SECRET` pour **Production, Preview et Development** selon les environnements utilisés. Utilise un mot de passe admin unique et un secret de session aléatoire d’au moins 32 caractères.
4. Redéploie. La première requête API crée les tables Neon et copie le contenu initial de `data/demo-seed.json` si la base est vide. Le script `npm run db:setup` permet aussi d’initialiser une base depuis un environnement ayant accès à Neon.
5. Après déploiement, vérifie le site, `/api/site`, le formulaire de devis et l’accès `/admin`. Les connexions de session sont stockées dans Neon pour fonctionner entre les instances serverless.

Les données du site sont enregistrées dans `site_state`, les demandes du formulaire dans `project_quotes` et les sessions admin dans `admin_sessions`. Le schéma est documenté dans `db/schema.sql`. La configuration en production refuse de démarrer si `DATABASE_URL`, `ADMIN_USER`, `ADMIN_PASSWORD` ou `SESSION_SECRET` manque; le mot de passe doit faire au moins 12 caractères et le secret 32. Aucun identifiant de production n’est inclus dans le dépôt.

Les images téléversées depuis l’administration sont conservées dans les données du site sous forme encodée; elles sont soumises à une limite de requête de 4 Mo. Pour des médias plus lourds, utiliser ultérieurement un stockage objet (par exemple Vercel Blob) avant d’augmenter les limites.

## Administration

Accès sur `/admin`. L’administration gère l’identité visuelle, les couleurs, les textes, le logo, la bannière, les produits, les réseaux sociaux, les coordonnées et les demandes de devis. N’expose pas une instance publique avec les identifiants de développement.

## Build

```sh
npm run build
```
