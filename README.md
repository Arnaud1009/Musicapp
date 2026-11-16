# Solfège Piano

Application web installable (PWA) pour travailler la lecture de notes (clés de sol et de fa) et la lecture rythmique, avec 7 niveaux progressifs chacun.

```bash
npm install
npm run dev            # http://localhost:5173
npm run dev -- --host  # pour tester sur téléphone (même réseau Wi-Fi)
npm test               # tests unitaires + rendu des portées
npm run build          # build de production dans dist/ (déployable sur n'importe quel hébergement statique)
```

Sur mobile : ouvrir l'URL puis « Ajouter à l'écran d'accueil ». L'app fonctionne ensuite hors-ligne.
Pour le rythme, lancer une fois la calibration de latence (Réglages), surtout avec un casque Bluetooth.
