# Vinylothèque

Application web/PWA personnelle pour gérer une collection de vinyles.

Fonctions principales :
- ajout, modification et suppression de vinyles ;
- recherche Discogs par texte ou code-barres ;
- récupération automatique des pochettes et métadonnées ;
- scan code-barres sur navigateur compatible ;
- photo personnelle ;
- sauvegarde/restauration JSON et export CSV ;
- installation PWA.

Le jeton Discogs n'est jamais stocké dans ce dépôt : il est saisi dans l'application et conservé localement dans le navigateur.


## Utilisation par plusieurs personnes

Vinylothèque est une PWA publique : plusieurs personnes peuvent ouvrir la même URL et installer l'application.

Chaque navigateur conserve sa propre collection localement. Les collections ne sont donc pas mélangées entre utilisateurs.

Au premier lancement sur un appareil vide, un parcours d'accueil crée un profil local. La sauvegarde JSON contient la collection et ce profil, mais jamais le jeton Discogs. Le fichier peut ensuite être restauré sur un autre appareil.

La synchronisation cloud multi-appareils n'est pas encore activée. Le mode local reste utilisable sans compte.
