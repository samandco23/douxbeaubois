# Doux Beau Bois

Site vitrine responsive avec accueil, catalogue, pages de contact et de présentation, formulaire de devis et administration. Le contenu d’exploitation est dans Neon; les images téléversées sont dans Vercel Blob.

## Développement local

```sh
npm install
cp .env.example .env
npm run dev
```

Le frontend est sur `http://localhost:5173`, l’API sur `http://localhost:4179` et l’administration sur `/admin`. Sans `DATABASE_URL`, le site utilise `data/site.json`. Les images locales sont enregistrées dans `uploads/`, un dossier ignoré par Git. Pour développer avec Neon, renseigne `DATABASE_URL` dans `.env` puis lance `npm run db:setup`.

## Déploiement Vercel, Neon et Blob

1. Crée une base PostgreSQL Neon. Utilise l’URL **pooled** pour `DATABASE_URL`; l’URL directe peut être mise dans `DATABASE_URL_DIRECT` pour les sauvegardes.
2. Crée un projet Vercel depuis ce dépôt. `vercel.json` configure Vite, `npm run build` et `dist`.
3. Dans Vercel, crée un stockage **Blob public** pour les photos du catalogue et de la marque. Ajoute `BLOB_READ_WRITE_TOKEN` aux environnements Production, Preview et Development.
4. Ajoute aussi `DATABASE_URL`, `ADMIN_USER`, `ADMIN_PASSWORD` et `SESSION_SECRET` aux environnements Vercel utilisés. La configuration de production refuse de démarrer sans ces quatre valeurs et `BLOB_READ_WRITE_TOKEN`. Le mot de passe admin doit comporter au moins 12 caractères; le secret de session au moins 32 caractères. Ne mets jamais ces valeurs dans Git.
5. Ajoute `PUBLIC_SITE_URL=https://douxbeaubois.com` comme variable de build. Remplace cette URL si le domaine public est différent. Elle sert aux pages de partage et au sitemap.
6. Redéploie. La première requête API crée les tables et importe les contenus de démonstration si la base est vide. `/api/health` vérifie ensuite l’accès à la base.

### Données et médias

Les textes et réglages vont dans `site_state`; les devis dans `project_quotes`; les sessions et limites de connexion dans `admin_sessions` et `rate_limits`. Le schéma est dans `db/schema.sql` et est créé automatiquement. Les sessions sont persistantes entre les fonctions Vercel.

L’administration convertit les images en WebP avant envoi. En production, l’API contrôle la session, le type réel et la taille de l’image, puis l’envoie à Vercel Blob. Neon ne garde que l’URL. En local, les images sont écrites dans `uploads/`. Les anciens médias Blob ne sont pas supprimés lors d’un remplacement : cela permet à une sauvegarde Neon de continuer à référencer ces fichiers. Supprime les médias obsolètes dans le tableau de bord Blob seulement après la durée de rétention souhaitée.

### Sauvegarde et restauration Neon

Installe les outils client PostgreSQL, puis configure `DATABASE_URL_DIRECT` avec l’URL directe de Neon. La sauvegarde est créée avec des permissions locales restreintes au format custom :

```sh
scripts/backup-neon.sh
```

Une restauration remplace les objets de la base cible présents dans le dump. Vérifie le projet et la branche Neon avant de confirmer. Après une restauration historique, renouvelle aussi `SESSION_SECRET` dans Vercel pour invalider les anciennes sessions :

```sh
scripts/restore-neon.sh backups/nom-du-backup.dump
```

Le script demande de saisir `RESTORE` avant d’exécuter `pg_restore`. Conserve les sauvegardes hors du dépôt, avec accès restreint. Les images Blob restent stockées séparément; une restauration Neon ne télécharge ni ne supprime les fichiers Blob.

### Disponibilité et alertes

`GET /api/health` renvoie un statut de service et vérifie Neon. Les erreurs API et les téléversements refusés sont consignés en JSON avec un identifiant de requête, sans enregistrer les formulaires ou mots de passe. Le workflow GitHub Actions `.github/workflows/site-health.yml` vérifie l’API toutes les 15 minutes. Si le site n’utilise pas `https://douxbeaubois.com`, crée une variable de dépôt `SITE_URL`. Configure les notifications GitHub pour recevoir les échecs du workflow.

Les tentatives de connexion et les envois de devis sont limités côté serveur avec des compteurs persistants dans Neon; les clés de limite sont hachées. Les routes admin vérifient la session et l’origine, les données de devis et les statuts sont validés, et les réponses ne divulguent pas les détails d’erreur internes.

### Référencement et performances

Le build génère des pages HTML distinctes pour l’accueil, le catalogue, À propos, le contact et les devis, avec leurs titres, descriptions et URL canoniques. `sitemap.xml`, `robots.txt`, Open Graph et les données structurées d’entreprise sont inclus. Les images de démonstration sont passées de PNG à WebP, les images de catalogue chargent à la demande, et les médias ajoutés depuis l’admin sont redimensionnés et compressés.

## Vérifications avant publication

- Remplace les produits et les liens sociaux de démonstration par les vrais contenus du client.
- Crée les variables Neon et Blob pour chaque environnement Vercel voulu.
- Vérifie `/api/health`, un devis complet, le changement de statut dans `/admin` et le remplacement d’une image.
- Fais une sauvegarde Neon initiale et vérifie que le workflow de disponibilité est actif.
