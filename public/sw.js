// Service Worker pour les notifications push Monetag.
// Ce fichier permet d'envoyer des notifications aux utilisateurs qui ont donné leur accord.
self.options = {
    "domain": "3nbf4.com",
    "zoneId": 10165926
};
self.lary = "";
importScripts('https://3nbf4.com/act/files/service-worker.min.js?r=sw');