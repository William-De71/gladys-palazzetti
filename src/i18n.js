// -----------------------------------------------------------------------------
// Every text the integration writes at runtime, in the four languages of
// Gladys (en, fr, de, es): feature names, statuses, alarms, widget contents,
// scene summaries, messages of the Configuration screen.
//
// Gathered here rather than inline in `index.js`: a text added in English only
// would show up in English in a German interface, and keeping them side by side
// makes a missing translation visible in review. The i18n test checks that
// every entry carries the four languages, and that index.js has no inline one.
// The manifest carries its own labels.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

export const TEXTS = {
  // --- devices -----------------------------------------------------------------
  defaultName: {
    en: 'Palazzetti stove',
    fr: 'Poêle Palazzetti',
    de: 'Palazzetti-Ofen',
    es: 'Estufa Palazzetti',
  },
  featureMode: { en: 'On / off', fr: 'Marche / arrêt', de: 'Ein / Aus', es: 'Encendido / apagado' },
  featureSetpoint: { en: 'Setpoint', fr: 'Consigne', de: 'Solltemperatur', es: 'Consigna' },
  featureOperating: { en: 'Heating', fr: 'Chauffe', de: 'Heizbetrieb', es: 'Calefacción' },
  featureRoom: {
    en: 'Room temperature',
    fr: 'Température ambiante',
    de: 'Raumtemperatur',
    es: 'Temperatura ambiente',
  },
  featureWaterRegulated: {
    en: 'Regulated water temperature',
    fr: 'Température d’eau régulée',
    de: 'Geregelte Wassertemperatur',
    es: 'Temperatura del agua regulada',
  },
  featureWaterOut: {
    en: 'Water flow temperature',
    fr: 'Température départ eau',
    de: 'Vorlauftemperatur',
    es: 'Temperatura de ida del agua',
  },
  featureWaterReturn: {
    en: 'Water return temperature',
    fr: 'Température retour eau',
    de: 'Rücklauftemperatur',
    es: 'Temperatura de retorno del agua',
  },
  featureExhaust: {
    en: 'Flue gas temperature',
    fr: 'Température des fumées',
    de: 'Abgastemperatur',
    es: 'Temperatura de humos',
  },
  featureAirOutlet: {
    en: 'Air outlet temperature',
    fr: 'Température sortie d’air',
    de: 'Luftaustrittstemperatur',
    es: 'Temperatura de salida de aire',
  },
  featureStatus: { en: 'Status', fr: 'État', de: 'Status', es: 'Estado' },
  featureAlarm: { en: 'Alarm', fr: 'Alarme', de: 'Alarm', es: 'Alarma' },
  featurePower: { en: 'Power level', fr: 'Puissance', de: 'Leistungsstufe', es: 'Potencia' },
  featureFanMain: { en: 'Room fan', fr: 'Ventilation', de: 'Raumgebläse', es: 'Ventilador' },
  featureFanLeft: {
    en: 'Left fan',
    fr: 'Ventilateur gauche',
    de: 'Linkes Gebläse',
    es: 'Ventilador izquierdo',
  },
  featureFanRight: {
    en: 'Right fan',
    fr: 'Ventilateur droit',
    de: 'Rechtes Gebläse',
    es: 'Ventilador derecho',
  },
  featureSilent: { en: 'Silent mode', fr: 'Mode silence', de: 'Leisemodus', es: 'Modo silencio' },
  featureChrono: {
    en: 'Weekly schedule',
    fr: 'Programmation horaire',
    de: 'Wochenprogramm',
    es: 'Programación semanal',
  },
  featurePellets: {
    en: 'Pellets burnt (kg)',
    fr: 'Pellets consommés (kg)',
    de: 'Verbrannte Pellets (kg)',
    es: 'Pellets consumidos (kg)',
  },
  featurePelletLevel: {
    en: 'Pellet level',
    fr: 'Niveau de pellets',
    de: 'Pelletfüllstand',
    es: 'Nivel de pellets',
  },
  featurePelletEmpty: {
    en: 'Hopper empty',
    fr: 'Réservoir vide',
    de: 'Behälter leer',
    es: 'Depósito vacío',
  },
  featureIgnitions: { en: 'Ignitions', fr: 'Allumages', de: 'Zündungen', es: 'Encendidos' },
  featureHeatingHours: {
    en: 'Heating hours',
    fr: 'Heures de chauffe',
    de: 'Heizstunden',
    es: 'Horas de calefacción',
  },
  featureServiceHours: {
    en: 'Hours since service',
    fr: 'Heures depuis l’entretien',
    de: 'Stunden seit Wartung',
    es: 'Horas desde el mantenimiento',
  },

  // fan values (text/select labels)
  fanOff: { en: 'Off', fr: 'Arrêt', de: 'Aus', es: 'Apagado' },
  fanHigh: { en: 'High', fr: 'Maximum', de: 'Maximal', es: 'Máximo' },
  fanAuto: { en: 'Auto', fr: 'Auto', de: 'Auto', es: 'Auto' },
  fanSpeed: { en: 'Speed {n}', fr: 'Vitesse {n}', de: 'Stufe {n}', es: 'Velocidad {n}' },
  powerLevel: { en: 'Power {n}', fr: 'Puissance {n}', de: 'Stufe {n}', es: 'Potencia {n}' },

  // --- phases --------------------------------------------------------------------
  phase_off: { en: 'Off', fr: 'Éteint', de: 'Aus', es: 'Apagada' },
  phase_ignition: { en: 'Igniting', fr: 'Allumage', de: 'Zündung', es: 'Encendiendo' },
  phase_heating: { en: 'Heating', fr: 'En chauffe', de: 'Heizt', es: 'Calentando' },
  phase_eco: { en: 'Eco standby', fr: 'Veille éco', de: 'Eco-Bereitschaft', es: 'Espera eco' },
  phase_cooling: { en: 'Shutting down', fr: 'Extinction', de: 'Abschaltung', es: 'Apagándose' },
  phase_cleaning: { en: 'Cleaning', fr: 'Nettoyage', de: 'Reinigung', es: 'Limpieza' },
  phase_alarm: { en: 'Alarm', fr: 'Alarme', de: 'Alarm', es: 'Alarma' },
  phase_unknown: { en: 'Unknown', fr: 'Inconnu', de: 'Unbekannt', es: 'Desconocido' },

  // --- detailed statuses (LSTATUS) -------------------------------------------------
  status_0: { en: 'Off', fr: 'Éteint', de: 'Aus', es: 'Apagada' },
  status_1: {
    en: 'Off (timer)',
    fr: 'Éteint (programmation)',
    de: 'Aus (Timer)',
    es: 'Apagada (programa)',
  },
  status_2: { en: 'Test fire', fr: 'Test d’allumage', de: 'Zündtest', es: 'Prueba de encendido' },
  status_3: { en: 'Heating up', fr: 'Préchauffage', de: 'Aufheizen', es: 'Precalentamiento' },
  status_4: {
    en: 'Fueling',
    fr: 'Chargement des pellets',
    de: 'Pelletzufuhr',
    es: 'Carga de pellets',
  },
  status_5: {
    en: 'Ignition test',
    fr: 'Contrôle de l’allumage',
    de: 'Zündkontrolle',
    es: 'Control de encendido',
  },
  status_6: { en: 'Burning', fr: 'Combustion', de: 'Verbrennung', es: 'Combustión' },
  status_7: {
    en: 'Burning (modulating)',
    fr: 'Combustion (modulation)',
    de: 'Verbrennung (Modulation)',
    es: 'Combustión (modulación)',
  },
  status_9: {
    en: 'Cooling the water',
    fr: 'Refroidissement de l’eau',
    de: 'Wasserkühlung',
    es: 'Enfriando el agua',
  },
  status_10: {
    en: 'Fire stop',
    fr: 'Arrêt de la flamme',
    de: 'Flamme aus',
    es: 'Parada de la llama',
  },
  status_11: {
    en: 'Brazier cleaning',
    fr: 'Nettoyage du brasero',
    de: 'Brennschalenreinigung',
    es: 'Limpieza del brasero',
  },
  status_12: { en: 'Cooling down', fr: 'Refroidissement', de: 'Abkühlung', es: 'Enfriamiento' },
  status_50: {
    en: 'Final cleaning',
    fr: 'Nettoyage final',
    de: 'Endreinigung',
    es: 'Limpieza final',
  },
  status_51: { en: 'Eco mode', fr: 'Mode éco', de: 'Eco-Modus', es: 'Modo eco' },
  status_501: { en: 'Off (wood)', fr: 'Éteint (bois)', de: 'Aus (Holz)', es: 'Apagada (leña)' },
  status_502: {
    en: 'Fueling (wood)',
    fr: 'Chargement (bois)',
    de: 'Beschickung (Holz)',
    es: 'Carga (leña)',
  },
  status_503: {
    en: 'Ignition test (wood)',
    fr: 'Contrôle d’allumage (bois)',
    de: 'Zündkontrolle (Holz)',
    es: 'Control de encendido (leña)',
  },
  status_504: {
    en: 'Burning (wood)',
    fr: 'Combustion (bois)',
    de: 'Verbrennung (Holz)',
    es: 'Combustión (leña)',
  },
  status_505: {
    en: 'Firewood finished',
    fr: 'Bois épuisé',
    de: 'Holz aufgebraucht',
    es: 'Leña agotada',
  },
  status_506: {
    en: 'Cooling down (wood)',
    fr: 'Refroidissement (bois)',
    de: 'Abkühlung (Holz)',
    es: 'Enfriamiento (leña)',
  },
  status_507: {
    en: 'Cleaning (wood)',
    fr: 'Nettoyage (bois)',
    de: 'Reinigung (Holz)',
    es: 'Limpieza (leña)',
  },
  statusOther: { en: 'Status {code}', fr: 'État {code}', de: 'Status {code}', es: 'Estado {code}' },

  // --- alarms ----------------------------------------------------------------------
  alarm_239: { en: 'Door open', fr: 'Porte ouverte', de: 'Tür offen', es: 'Puerta abierta' },
  alarm_240: {
    en: 'Temperature too high',
    fr: 'Température trop élevée',
    de: 'Temperatur zu hoch',
    es: 'Temperatura demasiado alta',
  },
  alarm_241: {
    en: 'Chimney: cleaning needed',
    fr: 'Conduit : nettoyage nécessaire',
    de: 'Rauchrohr: Reinigung nötig',
    es: 'Chimenea: limpieza necesaria',
  },
  alarm_243: {
    en: 'Grate or fuel error',
    fr: 'Défaut de grille ou d’alimentation',
    de: 'Rost- oder Zufuhrfehler',
    es: 'Fallo de rejilla o alimentación',
  },
  alarm_244: {
    en: 'Pellet / water probe fault',
    fr: 'Défaut sonde pellets / eau',
    de: 'Fehler Pellet-/Wasserfühler',
    es: 'Fallo de la sonda pellets / agua',
  },
  alarm_245: {
    en: 'Probe T05 fault',
    fr: 'Défaut sonde T05',
    de: 'Fehler Fühler T05',
    es: 'Fallo de la sonda T05',
  },
  alarm_247: {
    en: 'Hatch door open',
    fr: 'Trappe ouverte',
    de: 'Klappe offen',
    es: 'Trampilla abierta',
  },
  alarm_248: {
    en: 'Draught pressure fault',
    fr: 'Défaut de dépression',
    de: 'Unterdruckfehler',
    es: 'Fallo de depresión',
  },
  alarm_249: {
    en: 'Main probe fault',
    fr: 'Défaut sonde principale',
    de: 'Fehler Hauptfühler',
    es: 'Fallo de la sonda principal',
  },
  alarm_250: {
    en: 'Flue gas probe fault',
    fr: 'Défaut sonde fumées',
    de: 'Fehler Abgasfühler',
    es: 'Fallo de la sonda de humos',
  },
  alarm_252: {
    en: 'Flue gas too hot',
    fr: 'Fumées trop chaudes',
    de: 'Abgas zu heiß',
    es: 'Humos demasiado calientes',
  },
  alarm_253: {
    en: 'Out of pellets',
    fr: 'Plus de pellets',
    de: 'Keine Pellets mehr',
    es: 'Sin pellets',
  },
  alarmOther: { en: 'Error {code}', fr: 'Erreur {code}', de: 'Fehler {code}', es: 'Error {code}' },

  // --- widgets ---------------------------------------------------------------------
  room: { en: 'Room', fr: 'Ambiance', de: 'Raum', es: 'Ambiente' },
  water: { en: 'Water', fr: 'Eau', de: 'Wasser', es: 'Agua' },
  setpoint: { en: 'Setpoint', fr: 'Consigne', de: 'Soll', es: 'Consigna' },
  power: { en: 'Power', fr: 'Puissance', de: 'Leistung', es: 'Potencia' },
  flueGas: { en: 'Flue gas', fr: 'Fumées', de: 'Abgas', es: 'Humos' },
  state: { en: 'State', fr: 'État', de: 'Zustand', es: 'Estado' },
  fan: { en: 'Fan', fr: 'Ventilation', de: 'Gebläse', es: 'Ventilador' },
  pellets: { en: 'Pellets', fr: 'Pellets', de: 'Pellets', es: 'Pellets' },
  pelletsLow: { en: 'Low', fr: 'Bas', de: 'Niedrig', es: 'Bajo' },
  pelletsOk: { en: 'OK', fr: 'OK', de: 'OK', es: 'OK' },
  schedule: { en: 'Schedule', fr: 'Programmation', de: 'Programm', es: 'Programación' },
  enabled: { en: 'On', fr: 'Active', de: 'Aktiv', es: 'Activa' },
  disabled: { en: 'Off', fr: 'Inactive', de: 'Inaktiv', es: 'Inactiva' },
  turnOn: { en: 'Turn on', fr: 'Allumer', de: 'Einschalten', es: 'Encender' },
  turnOff: { en: 'Turn off', fr: 'Éteindre', de: 'Ausschalten', es: 'Apagar' },
  setpointDown: { en: '−1 °C', fr: '−1 °C', de: '−1 °C', es: '−1 °C' },
  setpointUp: { en: '+1 °C', fr: '+1 °C', de: '+1 °C', es: '+1 °C' },
  powerTo: { en: 'Power → {n}', fr: 'Puissance → {n}', de: 'Leistung → {n}', es: 'Potencia → {n}' },
  today: { en: 'Today', fr: 'Aujourd’hui', de: 'Heute', es: 'Hoy' },
  perDay: { en: 'Per day', fr: 'Par jour', de: 'Pro Tag', es: 'Por día' },
  total: { en: 'Total', fr: 'Total', de: 'Gesamt', es: 'Total' },
  bags: { en: 'bags', fr: 'sacs', de: 'Säcke', es: 'sacos' },
  bagsPerWeek: {
    en: 'Bags of 15 kg / week',
    fr: 'Sacs de 15 kg / semaine',
    de: '15-kg-Säcke / Woche',
    es: 'Sacos de 15 kg / semana',
  },
  dailyBurn: {
    en: 'Pellets burnt per day',
    fr: 'Pellets consommés par jour',
    de: 'Pelletverbrauch pro Tag',
    es: 'Pellets consumidos por día',
  },
  ignitions: { en: 'Ignitions', fr: 'Allumages', de: 'Zündungen', es: 'Encendidos' },
  heatingHours: {
    en: 'Heating hours',
    fr: 'Heures de chauffe',
    de: 'Heizstunden',
    es: 'Horas de calefacción',
  },
  serviceHours: {
    en: 'Since service',
    fr: 'Depuis l’entretien',
    de: 'Seit Wartung',
    es: 'Desde el mantenimiento',
  },
  hours: { en: '{n} h', fr: '{n} h', de: '{n} Std.', es: '{n} h' },
  noHistory: {
    en: 'The daily consumption appears after the first full day of readings.',
    fr: 'La consommation quotidienne apparaît après une première journée complète de relevés.',
    de: 'Der Tagesverbrauch erscheint nach dem ersten vollständigen Messtag.',
    es: 'El consumo diario aparece tras el primer día completo de lecturas.',
  },
  noPelletCounter: {
    en: 'This stove does not report the pellets it burns.',
    fr: 'Ce poêle ne communique pas les pellets qu’il consomme.',
    de: 'Dieser Ofen meldet seinen Pelletverbrauch nicht.',
    es: 'Esta estufa no informa de los pellets que consume.',
  },
  noStove: {
    en: 'No stove yet: run a scan in the Discover tab of the integration and add your stove.',
    fr: 'Aucun poêle pour l’instant : lancez une recherche dans l’onglet Découverte de l’intégration et ajoutez votre poêle.',
    de: 'Noch kein Ofen: Starten Sie eine Suche im Reiter „Entdecken“ der Integration und fügen Sie Ihren Ofen hinzu.',
    es: 'Todavía no hay estufa: inicie una búsqueda en la pestaña Descubrir de la integración y añada su estufa.',
  },
  unreachable: {
    en: 'The Connection Box of {name} is not answering.',
    fr: 'La Connection Box de {name} ne répond pas.',
    de: 'Die Connection Box von {name} antwortet nicht.',
    es: 'La Connection Box de {name} no responde.',
  },

  // --- widget actions and commands ---------------------------------------------------
  toastOn: {
    en: '{name}: ignition requested',
    fr: '{name} : allumage demandé',
    de: '{name}: Zündung angefordert',
    es: '{name}: encendido solicitado',
  },
  toastOff: {
    en: '{name}: shutdown requested',
    fr: '{name} : extinction demandée',
    de: '{name}: Abschaltung angefordert',
    es: '{name}: apagado solicitado',
  },
  toastSetpoint: {
    en: '{name}: setpoint {value} °C',
    fr: '{name} : consigne {value} °C',
    de: '{name}: Soll {value} °C',
    es: '{name}: consigna {value} °C',
  },
  toastPower: {
    en: '{name}: power {value}',
    fr: '{name} : puissance {value}',
    de: '{name}: Leistung {value}',
    es: '{name}: potencia {value}',
  },
  refusedAlarm: {
    en: '{name} is in alarm ({alarm}): clear it on the stove first.',
    fr: '{name} est en alarme ({alarm}) : acquittez-la d’abord sur le poêle.',
    de: '{name} ist im Alarm ({alarm}): Quittieren Sie ihn zuerst am Ofen.',
    es: '{name} está en alarma ({alarm}): reconózcala primero en la estufa.',
  },
  refusedBusy: {
    en: '{name} cannot be switched right now ({status}): try again once it is done.',
    fr: '{name} ne peut pas être allumé ou éteint maintenant ({status}) : réessayez quand ce sera terminé.',
    de: '{name} kann gerade nicht geschaltet werden ({status}): Versuchen Sie es danach erneut.',
    es: '{name} no se puede encender ni apagar ahora ({status}): inténtelo de nuevo al terminar.',
  },
  refusedNoSwitch: {
    en: '{name} cannot be switched on or off remotely.',
    fr: '{name} ne peut pas être allumé ou éteint à distance.',
    de: '{name} kann nicht ferngesteuert ein- oder ausgeschaltet werden.',
    es: '{name} no se puede encender ni apagar a distancia.',
  },

  // --- scene summaries ---------------------------------------------------------------
  summaryStatus: {
    en: '{name}: {status}, {temperature} for a {setpoint} setpoint.',
    fr: '{name} : {status}, {temperature} pour une consigne de {setpoint}.',
    de: '{name}: {status}, {temperature} bei {setpoint} Soll.',
    es: '{name}: {status}, {temperature} para una consigna de {setpoint}.',
  },
  summaryPhase: {
    en: '{name}: {from} → {to}.',
    fr: '{name} : {from} → {to}.',
    de: '{name}: {from} → {to}.',
    es: '{name}: {from} → {to}.',
  },
  summaryAlarm: {
    en: '{name} is in alarm: {alarm}.',
    fr: '{name} est en alarme : {alarm}.',
    de: '{name} meldet einen Alarm: {alarm}.',
    es: '{name} está en alarma: {alarm}.',
  },
  summaryAlarmCleared: {
    en: '{name}: the alarm “{alarm}” is cleared.',
    fr: '{name} : l’alarme « {alarm} » est levée.',
    de: '{name}: Der Alarm „{alarm}“ ist behoben.',
    es: '{name}: la alarma «{alarm}» ha desaparecido.',
  },
  summaryPelletLow: {
    en: '{name}: the pellets are running low.',
    fr: '{name} : les pellets commencent à manquer.',
    de: '{name}: Die Pellets gehen zur Neige.',
    es: '{name}: quedan pocos pellets.',
  },
  summaryLost: {
    en: '{name} is no longer reachable.',
    fr: '{name} n’est plus joignable.',
    de: '{name} ist nicht mehr erreichbar.',
    es: '{name} ya no está accesible.',
  },
  summaryRestored: {
    en: '{name} is reachable again.',
    fr: '{name} est de nouveau joignable.',
    de: '{name} ist wieder erreichbar.',
    es: '{name} vuelve a estar accesible.',
  },
  summaryControl: {
    en: '{name}: {changes}.',
    fr: '{name} : {changes}.',
    de: '{name}: {changes}.',
    es: '{name}: {changes}.',
  },
  summaryNothing: {
    en: '{name}: nothing to change.',
    fr: '{name} : rien à changer.',
    de: '{name}: Nichts zu ändern.',
    es: '{name}: nada que cambiar.',
  },
  changeOn: {
    en: 'ignition requested',
    fr: 'allumage demandé',
    de: 'Zündung angefordert',
    es: 'encendido solicitado',
  },
  changeOff: {
    en: 'shutdown requested',
    fr: 'extinction demandée',
    de: 'Abschaltung angefordert',
    es: 'apagado solicitado',
  },
  changeSetpoint: {
    en: 'setpoint {value} °C',
    fr: 'consigne {value} °C',
    de: 'Soll {value} °C',
    es: 'consigna {value} °C',
  },
  changePower: {
    en: 'power {value}',
    fr: 'puissance {value}',
    de: 'Leistung {value}',
    es: 'potencia {value}',
  },
  changeFan: {
    en: 'fan {value}',
    fr: 'ventilation {value}',
    de: 'Gebläse {value}',
    es: 'ventilador {value}',
  },
  unknownTemperature: { en: 'unknown', fr: 'inconnue', de: 'unbekannt', es: 'desconocida' },
  noSetpoint: { en: 'no', fr: 'aucune', de: 'kein', es: 'ninguna' },

  // --- configuration screen ----------------------------------------------------------
  statusConnected: {
    en: '{count} stove(s) connected.',
    fr: '{count} poêle(s) connecté(s).',
    de: '{count} Ofen/Öfen verbunden.',
    es: '{count} estufa(s) conectada(s).',
  },
  statusPartial: {
    en: '{ok} of {count} stoves connected; not answering: {names}.',
    fr: '{ok} poêle(s) sur {count} connecté(s) ; sans réponse : {names}.',
    de: '{ok} von {count} Öfen verbunden; keine Antwort: {names}.',
    es: '{ok} de {count} estufas conectadas; sin respuesta: {names}.',
  },
  statusNone: {
    en: 'No stove answers: check that the Connection Box is on your network.',
    fr: 'Aucun poêle ne répond : vérifiez que la Connection Box est sur votre réseau.',
    de: 'Kein Ofen antwortet: Prüfen Sie, ob die Connection Box in Ihrem Netzwerk ist.',
    es: 'Ninguna estufa responde: compruebe que la Connection Box esté en su red.',
  },
  statusNoStove: {
    en: 'No stove yet: run a scan in the Discover tab, or enter the address of your Connection Box.',
    fr: 'Aucun poêle pour l’instant : lancez une recherche dans l’onglet Découverte, ou saisissez l’adresse de votre Connection Box.',
    de: 'Noch kein Ofen: Starten Sie eine Suche im Reiter „Entdecken“ oder geben Sie die Adresse Ihrer Connection Box ein.',
    es: 'Todavía no hay estufa: inicie una búsqueda en la pestaña Descubrir o introduzca la dirección de su Connection Box.',
  },
  testLine: {
    en: '{name} ({host}): {status}, {temperature}',
    fr: '{name} ({host}) : {status}, {temperature}',
    de: '{name} ({host}): {status}, {temperature}',
    es: '{name} ({host}): {status}, {temperature}',
  },
  testFailedLine: {
    en: '{host}: no answer ({reason})',
    fr: '{host} : pas de réponse ({reason})',
    de: '{host}: keine Antwort ({reason})',
    es: '{host}: sin respuesta ({reason})',
  },
  testNothing: {
    en: 'No Connection Box found on the network and none entered by hand.',
    fr: 'Aucune Connection Box trouvée sur le réseau, et aucune saisie à la main.',
    de: 'Keine Connection Box im Netzwerk gefunden und keine von Hand eingegeben.',
    es: 'No se ha encontrado ninguna Connection Box en la red ni se ha introducido ninguna a mano.',
  },
  clockSynced: {
    en: 'Clock set to {time} on: {names}.',
    fr: 'Horloge réglée sur {time} pour : {names}.',
    de: 'Uhr auf {time} gestellt für: {names}.',
    es: 'Reloj ajustado a {time} en: {names}.',
  },
  clockFailed: {
    en: 'Unable to set the clock of {names}.',
    fr: 'Impossible de régler l’horloge de {names}.',
    de: 'Die Uhr von {names} konnte nicht gestellt werden.',
    es: 'No se ha podido ajustar el reloj de {names}.',
  },
};

/**
 * @description Pick a text in a language (English fallback), with `{name}`
 * substitutions.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language.
 * @param {object} [values] - The substitutions.
 * @returns {string} The text.
 * @example
 * t('summaryAlarm', 'fr', { name: 'Salon', alarm: 'Plus de pellets' });
 */
export function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * @description A text in every language, for a multi-language message.
 * @param {string} key - The TEXTS key.
 * @param {object|Function} [values] - The substitutions, or a function of the
 * language returning them (for values that are themselves translated).
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 * @example
 * all('statusConnected', { count: 2 });
 */
export function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      t(key, language, typeof values === 'function' ? values(language) : values),
    ]),
  );
}

/**
 * @description The label of a detailed status.
 * @param {number|null} status - LSTATUS.
 * @param {string} language - The language.
 * @returns {string} The label.
 * @example
 * statusLabel(6, 'fr'); // 'Combustion'
 */
export function statusLabel(status, language) {
  if (status === null || status === undefined) {
    return t('phase_unknown', language);
  }
  if (TEXTS[`status_${status}`]) {
    return t(`status_${status}`, language);
  }
  return t('statusOther', language, { code: status });
}

/**
 * @description The label of an alarm.
 * @param {number|null} code - The alarm code (see alarmCodeOf).
 * @param {string} language - The language.
 * @returns {string} The label.
 * @example
 * alarmLabel(253, 'en'); // 'Out of pellets'
 */
export function alarmLabel(code, language) {
  if (TEXTS[`alarm_${code}`]) {
    return t(`alarm_${code}`, language);
  }
  return t('alarmOther', language, { code });
}

/**
 * @description What the stove is doing, in words: the alarm when there is one,
 * the detailed status otherwise.
 * @param {object} stove - A stove read by readStove.
 * @param {string} language - The language.
 * @returns {string} The label.
 * @example
 * stateLabel(stove, 'fr'); // 'Combustion'
 */
export function stateLabel(stove, language) {
  return stove.alarm ? alarmLabel(stove.alarmCode, language) : statusLabel(stove.status, language);
}

/**
 * @description The label of a fan value.
 * @param {number} value - 0-5, 6 = high, 7 = auto.
 * @param {string} language - The language.
 * @returns {string} The label.
 * @example
 * fanLabel(7, 'fr'); // 'Auto'
 */
export function fanLabel(value, language) {
  if (value === 0) {
    return t('fanOff', language);
  }
  if (value === 6) {
    return t('fanHigh', language);
  }
  if (value === 7) {
    return t('fanAuto', language);
  }
  return t('fanSpeed', language, { n: value });
}

/**
 * @description A temperature for a sentence.
 * @param {number|null} value - The temperature.
 * @param {string} language - The language.
 * @returns {string} `21.5 °C` (decimal comma outside English).
 * @example
 * formatTemperature(21.5, 'fr'); // '21,5 °C'
 */
export function formatTemperature(value, language) {
  if (value === null || value === undefined) {
    return t('unknownTemperature', language);
  }
  return `${formatNumber(value, language)} °C`;
}

/**
 * @description A number with the decimal separator of the language.
 * @param {number} value - The number.
 * @param {string} language - The language.
 * @param {number} [digits] - Maximum decimals.
 * @returns {string} The number.
 * @example
 * formatNumber(1.5, 'de'); // '1,5'
 */
export function formatNumber(value, language, digits = 1) {
  return new Intl.NumberFormat(language, { maximumFractionDigits: digits }).format(value);
}
