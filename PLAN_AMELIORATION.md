# 🚀 PLAN D'AMÉLIORATION STRATÉGIQUE - VISION 2026

## 1. Introduction

Ce document présente un audit de la plateforme actuelle et une feuille de route stratégique pour la transformer en un service de streaming sportif robuste, professionnel et hautement monétisable. L'objectif est de passer d'un lecteur fonctionnel à une expérience utilisateur de premier ordre, garantie par une infrastructure technique infaillible.

---

## 2. État des Lieux (Audit Actuel)

### ✅ Points Forts

- **Fondation Technique Solide** : Le `VideoPlayerHybrid` est un excellent point de départ, avec une gestion avancée des erreurs et des buffers pour HLS et MPEG-TS.
- **Monétisation Intégrée** : L'intégration VAST (pre-roll) est fonctionnelle et constitue une base de revenus essentielle.
- **Proxy de Stabilité** : L'utilisation d'une Edge Function Supabase comme proxy est une solution intelligente pour contourner les problèmes de CORS et de "mixed content".
- **Interface Utilisateur Claire** : L'UI est simple, intuitive et permet une sélection rapide des chaînes.

### ❌ Axes d'Amélioration Critiques

1.  **INSTABILITÉ DES SOURCES (Priorité #1)** : La dépendance directe à des URLs IPTV brutes (`afxtv.xyz`, etc.) est le plus grand point de défaillance. Ces serveurs sont instables, non optimisés pour une diffusion mondiale (pas de CDN) et peuvent être coupés à tout moment. **C'est le talon d'Achille de la plateforme.**
2.  **Expérience de "Zapping" Basique** : Le changement de chaîne provoque un rechargement complet visible (écran noir, chargement). Bien que fonctionnel, ce n'est pas une expérience fluide et professionnelle.
3.  **Monétisation Limitée** : Le pre-roll est efficace, mais le potentiel est bien plus grand (mid-roll, formats non intrusifs, etc.).
4.  **Gestion Statique des Chaînes** : La liste des chaînes est codée en dur dans le code. Toute mise à jour nécessite un redéploiement complet de l'application.
5.  **Complexité des Composants** : Le `VideoPlayerHybrid` est très puissant, mais il devient un composant monolithique difficile à maintenir et à faire évoluer.

---

## 3. Plan d'Action en 3 Phases

### Phase 1 : Stabilité Fondamentale & UX (Prochaines 2 semaines)

*Objectif : Éliminer 99% des problèmes de buffering et rendre l'expérience utilisateur plus agréable.*

#### **Action 1.1 : Migration des Sources vers un CDN Professionnel (Priorité absolue)**
- **Problème** : Les sources IPTV sont instables.
- **Solution** : Suivre le guide `GUIDE_STREAMING_STABLE.md` et migrer les flux vers un service comme **Mux** (recommandé pour la simplicité) ou **Cloudflare Stream**.
- **Bénéfices** :
    - **Zéro Buffering** : Transcodage ABR (qualité adaptative).
    - **Disponibilité 99.9%** : Stabilité de niveau entreprise.
    - **Performance Globale** : CDN mondial pour une latence minimale partout.
- **Action** : Créer un compte Mux, y router les 5 chaînes les plus populaires, et mettre à jour leurs URLs dans le code.

#### **Action 1.2 : Amélioration de l'Expérience de Zapping**
- **Problème** : Le changement de chaîne est brutal.
- **Solution** : Mettre en place un "overlay" de transition. Quand l'utilisateur change de chaîne, afficher un écran de chargement semi-transparent avec le logo de la nouvelle chaîne.
- **Bénéfices** : Masque le rechargement technique, rend l'expérience plus fluide et professionnelle.
- **Action** : Ajouter un état `isChangingChannel` dans `Index.tsx` pour afficher cet overlay pendant 1 à 2 secondes.

#### **Action 1.3 : Centralisation de la Configuration**
- **Problème** : La liste des chaînes est dans le composant `Index.tsx`.
- **Solution** : Créer un fichier `src/config/channels.ts` et y déplacer le tableau `PREDEFINED_CHANNELS`.
- **Bénéfices** : Code plus propre, maintenance facilitée.

---

### Phase 2 : Engagement Utilisateur & Monétisation Avancée (Prochain mois)

*Objectif : Augmenter la rétention des utilisateurs et diversifier les sources de revenus.*

#### **Action 2.1 : Système de Favoris**
- **Problème** : L'utilisateur doit chercher sa chaîne à chaque visite.
- **Solution** : Ajouter un bouton "étoile" sur chaque chaîne. Sauvegarder les favoris dans le `localStorage` du navigateur et les afficher en haut de la liste.
- **Bénéfices** : Personnalisation, accès plus rapide, augmentation de l'engagement.

#### **Action 2.2 : Introduction des Publicités Mid-Roll**
- **Problème** : La monétisation se limite au démarrage.
- **Solution** : Utiliser la librairie VAST pour déclencher une publicité "mid-roll" toutes les 30 minutes de visionnage. Afficher un avertissement "La publicité commence dans 10s".
- **Bénéfices** : **Augmentation significative des revenus publicitaires.**

#### **Action 2.3 : Panneau de Paramètres Utilisateur**
- **Solution** : Créer un petit panneau de configuration (accessible via une icône) permettant à l'utilisateur de :
    - Forcer une qualité (Basse, Moyenne, Haute) pour économiser la data.
    - Activer/désactiver l'autoplay au chargement de la page.
- **Bénéfices** : Donne le contrôle à l'utilisateur, améliore la satisfaction.

---

### Phase 3 : Scalabilité & Professionnalisation (Prochain trimestre)

*Objectif : Préparer la plateforme pour une croissance à grande échelle et une maintenance à long terme.*

#### **Action 3.1 : Refactorisation du Lecteur Vidéo**
- **Problème** : `VideoPlayerHybrid.tsx` est un "god component".
- **Solution** : Le décomposer en plusieurs hooks personnalisés :
    - `useHlsPlayer(videoRef, url)`
    - `useMpegtsPlayer(videoRef, url)`
    - `usePlayerControls(videoRef)`
    - `usePlayerAnalytics(videoRef)`
- **Bénéfices** : Code beaucoup plus lisible, maintenable, et testable. Facilite l'ajout de nouvelles fonctionnalités.

#### **Action 3.2 : API pour la Gestion des Chaînes**
- **Problème** : La liste des chaînes est statique.
- **Solution** : Créer une table `channels` dans Supabase. L'application fetchera la liste des chaînes depuis cette table au démarrage.
- **Bénéfices** : **Mise à jour des chaînes en temps réel sans redéployer le site.** Possibilité de désactiver une chaîne temporairement, d'ajouter des chaînes "événementielles", etc.

#### **Action 3.3 : Mise en Place d'Analytics Côté Client**
- **Problème** : Aucune visibilité sur les problèmes des utilisateurs.
- **Solution** : Intégrer un service d'analytics léger (comme Logflare, Tinybird ou un simple logging vers une table Supabase) pour remonter les erreurs critiques du lecteur (erreurs fatales HLS/MPEG-TS, taux de buffering élevé).
- **Bénéfices** : Détecter proactivement les problèmes, comprendre quelles chaînes sont instables, et améliorer la qualité de service en se basant sur des données réelles.