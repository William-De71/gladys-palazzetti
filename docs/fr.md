# Intégration Palazzetti

Pilotez votre poêle à pellets **Palazzetti** depuis Gladys, en local, grâce à sa **Connection Box** : allumage et extinction, consigne, puissance, ventilation, températures, alarmes et consommation de pellets. Aucun compte ni cloud Palazzetti n'est nécessaire.

> Intégration communautaire, non affiliée à Palazzetti Lelio S.p.A. ni approuvée par elle. « Palazzetti » et son logo sont des marques de leur propriétaire.

## Prérequis

- Un poêle Palazzetti (ou d'une marque utilisant la même carte Fumis) équipé d'une **Connection Box** reliée à votre réseau en Wi-Fi ou en Ethernet. Un module **WPalaControl** fonctionne aussi.
- La Connection Box doit être joignable depuis la machine qui fait tourner Gladys (même réseau local).
- Conseillé : donnez à la Connection Box une **adresse IP fixe** dans votre box internet. L'intégration la retrouve seule si son adresse change, mais avec quelques minutes de délai.

## Configuration

### 1. Découvrir le poêle

Allez dans **Intégrations → Palazzetti → Découverte** et lancez une recherche. Gladys envoie la requête de découverte des Connection Box sur votre réseau (UDP, port 54549) : chaque poêle qui répond apparaît avec son nom (celui choisi dans l'application Palazzetti). Cliquez sur **Ajouter**.

### 2. Si le poêle n'est pas trouvé

Le broadcast ne traverse pas toujours le réseau (autre VLAN, Wi-Fi invité, routeur qui le filtre). Dans **Configuration**, saisissez l'adresse IP de la Connection Box dans **Adresses des Connection Box** (plusieurs adresses séparées par des virgules), enregistrez, puis relancez la recherche.

L'adresse IP se trouve dans l'application Palazzetti, dans la liste des appareils de votre box internet, ou sur l'écran du poêle selon le modèle.

### 3. Intervalle de lecture

La Connection Box ne prévient pas Gladys d'un changement : l'intégration lit chaque poêle toutes les **30 secondes** par défaut (de 10 à 300). C'est le délai maximal de réaction des scènes. Une valeur trop basse charge inutilement la liaison série entre le boîtier et le poêle.

Le bouton **Tester la connexion** recherche les boîtiers et affiche l'état de chaque poêle.

## L'appareil « poêle »

Les fonctionnalités créées dépendent de ce que votre modèle sait faire :

| Fonctionnalité                                          | Description                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Marche / arrêt                                          | Allume ou éteint le poêle (mode du thermostat : Éteint / Chauffe)        |
| Consigne                                                | Température voulue, au degré, dans la plage du poêle                     |
| Chauffe                                                 | Le poêle produit de la chaleur (allumage ou combustion)                  |
| Température ambiante                                    | La sonde sur laquelle le poêle régule (l'eau régulée sur un poêle hydro) |
| Températures des fumées, de l'eau…                      | Les autres sondes présentes                                              |
| État                                                    | En clair : Combustion, Mode éco, Refroidissement… ou l'alarme en cours   |
| Alarme                                                  | 1 tant que le poêle est en alarme                                        |
| Puissance                                               | De 1 à 5                                                                 |
| Ventilation, ventilateurs gauche/droit                  | Arrêt, vitesses 1 à 5, Maximum, Auto, selon ce que propose le modèle     |
| Mode silence                                            | Coupe tous les ventilateurs (modèles à plusieurs ventilateurs)           |
| Programmation horaire                                   | Active ou désactive la programmation hebdomadaire du poêle               |
| Pellets consommés (kg)                                  | Compteur cumulé                                                          |
| Niveau de pellets / Réservoir vide                      | Selon le capteur de réservoir du modèle                                  |
| Allumages, heures de chauffe, heures depuis l'entretien | Compteurs du poêle, relus toutes les 10 minutes                          |

**Quand peut-on allumer ou éteindre ?** Comme sur l'application Palazzetti, le poêle refuse l'ordre pendant un allumage, une extinction ou une alarme. Gladys affiche alors la raison (« ne peut pas être allumé ou éteint maintenant (Préchauffage) »). Une alarme s'acquitte sur le poêle lui-même.

**Délai d'affichage :** le boîtier met une dizaine de secondes à refléter une commande ; l'intégration relit le poêle 12 secondes après chaque ordre.

## Scènes : déclencheurs

Chaque déclencheur peut être limité à un poêle (laissez vide pour tous).

| Déclencheur                | Quand                                                                                                                          | Variables                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Changement d'état du poêle | Le poêle passe dans un nouvel état : Éteint, Allumage, En chauffe, Veille éco, Extinction, Nettoyage final, Alarme (filtrable) | nouvel et ancien état, état détaillé, température, consigne, résumé |
| Alarme                     | Une alarme apparaît, filtrable par type : plus de pellets, porte ouverte, surchauffe, tirage, nettoyage du conduit, sonde…     | libellé, type et code de l'alarme, résumé                           |
| Fin d'alarme               | Le poêle n'est plus en alarme                                                                                                  | alarme levée, nouvel état, résumé                                   |
| Pellets bientôt vides      | Le capteur du réservoir signale un niveau bas (modèles équipés)                                                                | niveau, résumé                                                      |
| Poêle injoignable          | La Connection Box n'a pas répondu à trois lectures de suite                                                                    | résumé                                                              |
| Poêle de nouveau joignable | Elle répond de nouveau                                                                                                         | état, température, résumé                                           |

Le **résumé** est une phrase prête à envoyer, par exemple « Salon est en alarme : Plus de pellets. »

Exemples :

- _Alarme « Plus de pellets » → envoyer un message « {{résumé}} »_.
- _Changement d'état vers « Éteint » → baisser les volets roulants._

## Scènes : actions

- **Palazzetti : lire le poêle** — renvoie l'état, la température, la consigne, la puissance, la ventilation, la température des fumées, les pellets consommés et un résumé, utilisables dans les actions suivantes (conditions, messages).
- **Palazzetti : régler le poêle** — en une seule action : marche/arrêt (ou inchangé), consigne, puissance et ventilation. Les champs vides ne changent rien. Les réglages sont envoyés avant l'allumage, pour que le poêle démarre directement avec la bonne consigne. Une valeur refusée (alarme, vitesse non proposée par le modèle) fait échouer l'action avec la raison.

Vous pouvez aussi utiliser les fonctionnalités de l'appareil dans l'action standard « Contrôler un appareil ».

## Widgets de tableau de bord

- **Poêle Palazzetti** — température ambiante et consigne en direct, courbe des dernières 24 heures, état (avec l'alarme en rouge), ventilation, pellets, et quatre boutons : Allumer/Éteindre (avec confirmation pour éteindre), −1 °C, +1 °C, et Puissance → suivante. Sans la courbe, la puissance s'affiche en tuile.
- **Consommation de pellets** — pellets consommés aujourd'hui, moyenne par jour, total, histogramme des derniers jours (7 à 60), sacs de 15 kg par semaine, allumages, heures de chauffe et depuis l'entretien. L'historique quotidien est calculé par l'intégration à partir du compteur du poêle : il apparaît après une première journée complète.

## Actions de la page Configuration

- **Tester la connexion** : recherche les boîtiers et lit chaque poêle.
- **Mettre à l'heure le poêle** : règle l'horloge du poêle (utilisée par sa programmation horaire) sur l'heure de Gladys — utile après une coupure de courant ou un changement d'heure.

## Dépannage

**Aucun poêle trouvé.** Vérifiez que la Connection Box est allumée et sur le même réseau que Gladys, puis saisissez son adresse IP dans la configuration. Testez-la depuis un navigateur : `http://IP_DU_BOITIER/cgi-bin/sendmsg.lua?cmd=GET+STAT` doit renvoyer du JSON.

**« Le poêle ne répond pas au boîtier ».** La Connection Box répond mais n'arrive pas à joindre le poêle : vérifiez le câble entre le boîtier et le poêle, et que le poêle est sous tension.

**Une commande est refusée.** Le poêle n'accepte pas l'allumage ni l'extinction pendant un allumage, une extinction ou une alarme ; la ventilation n'accepte que les vitesses proposées par le modèle. Le message affiché donne la raison.

**Les températures restent vides.** Une sonde à 0 est considérée comme absente : certains modèles n'ont pas toutes les sondes.

**La consommation par jour est vide.** Elle se remplit au fil des jours ; certains poêles (cartes d'autres marques) ne communiquent pas leur compteur de pellets.

Les journaux de l'intégration sont visibles dans **Intégrations → Palazzetti → Journaux**.
