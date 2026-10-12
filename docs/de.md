# Palazzetti-Integration

Steuern Sie Ihren **Palazzetti**-Pelletofen aus Gladys, lokal über seine **Connection Box**: Ein- und Ausschalten, Solltemperatur, Leistungsstufe, Gebläse, Temperaturen, Alarme und Pelletverbrauch. Ein Palazzetti-Konto oder die Cloud wird nicht benötigt.

> Community-Integration, weder mit Palazzetti Lelio S.p.A. verbunden noch von ihr unterstützt. „Palazzetti“ und sein Logo sind Marken ihres Inhabers.

![Gladys, die Integration und Ihr Ofen: Die Integration liest die Connection Box per HTTP, eine Anfrage nach der anderen, die Box leitet über eine serielle Verbindung an den Ofen weiter, die Suche läuft über die UDP-Anfrage, die Gladys sendet, und die Palazzetti-Cloud wird nie genutzt](images/overview.svg)

## Voraussetzungen

- Ein Palazzetti-Ofen (oder einer anderen Marke mit derselben Fumis-Platine) mit einer **Connection Box** in Ihrem Netzwerk, per WLAN oder Ethernet. Ein **WPalaControl**-Modul funktioniert ebenfalls.
- Die Connection Box muss vom Rechner, auf dem Gladys läuft, erreichbar sein (gleiches lokales Netzwerk).
- Empfohlen: Geben Sie der Connection Box eine **feste IP-Adresse** in Ihrem Router. Die Integration findet sie zwar selbst wieder, wenn sich die Adresse ändert, aber mit einigen Minuten Verzögerung.

## Einrichtung

### 1. Den Ofen entdecken

Öffnen Sie **Integrationen → Palazzetti → Entdecken** und starten Sie eine Suche. Gladys sendet die Suchanfrage der Connection Box in Ihr Netzwerk (UDP, Port 54549): Jeder antwortende Ofen erscheint mit seinem Namen (dem in der Palazzetti-App gewählten). Klicken Sie auf **Hinzufügen**.

### 2. Wenn der Ofen nicht gefunden wird

Der Broadcast durchquert nicht immer das Netzwerk (anderes VLAN, Gäste-WLAN, Router filtert ihn). Tragen Sie unter **Konfiguration** die IP-Adresse der Connection Box in **Adressen der Connection Box** ein (mehrere Adressen durch Kommas getrennt), speichern Sie und starten Sie die Suche erneut.

Die IP-Adresse finden Sie in der Palazzetti-App, in der Geräteliste Ihres Routers oder je nach Modell auf dem Display des Ofens.

### 3. Abfrageintervall

Die Connection Box meldet Gladys keine Änderung von sich aus: Die Integration liest jeden Ofen standardmäßig alle **30 Sekunden** (10 bis 300). Das ist die maximale Reaktionszeit der Szenen. Ein sehr niedriger Wert belastet unnötig die serielle Verbindung zwischen Box und Ofen.

Die Schaltfläche **Verbindung testen** sucht die Boxen und zeigt den Zustand jedes Ofens.

## Das Ofen-Gerät

Die Funktionen hängen davon ab, was Ihr Modell kann:

| Funktion                                     | Beschreibung                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| Ein / Aus                                    | Schaltet den Ofen ein oder aus (Thermostatmodus: Aus / Heizen)                   |
| Solltemperatur                               | Gewünschte Temperatur in ganzen Grad, im Bereich des Ofens                       |
| Heizbetrieb                                  | Der Ofen erzeugt Wärme (Zündung oder Verbrennung)                                |
| Raumtemperatur                               | Der Fühler, nach dem der Ofen regelt (das geregelte Wasser bei einem Hydro-Ofen) |
| Abgas-, Wassertemperaturen…                  | Die übrigen vorhandenen Fühler                                                   |
| Status                                       | In Worten: Verbrennung, Eco-Modus, Abkühlung… oder der aktuelle Alarm            |
| Alarm                                        | 1, solange der Ofen im Alarm ist                                                 |
| Leistungsstufe                               | 1 bis 5                                                                          |
| Raumgebläse, linkes / rechtes Gebläse        | Aus, Stufen 1 bis 5, Maximal, Auto, je nach Modell                               |
| Leisemodus                                   | Schaltet alle Gebläse aus (Modelle mit mehreren Gebläsen)                        |
| Wochenprogramm                               | Aktiviert oder deaktiviert das Wochenprogramm des Ofens                          |
| Verbrannte Pellets (kg)                      | Kumulierter Zähler                                                               |
| Pelletfüllstand / Behälter leer              | Je nach Füllstandssensor des Modells                                             |
| Zündungen, Heizstunden, Stunden seit Wartung | Zähler des Ofens, alle 10 Minuten gelesen                                        |

**Wann kann geschaltet werden?** Wie in der Palazzetti-App lehnt der Ofen den Befehl während einer Zündung, einer Abschaltung oder eines Alarms ab. Gladys zeigt dann den Grund an („kann gerade nicht geschaltet werden (Aufheizen)“). Ein Alarm wird am Ofen selbst quittiert.

**Anzeigeverzögerung:** Die Box braucht etwa zehn Sekunden, um einen Befehl widerzuspiegeln; die Integration liest den Ofen 12 Sekunden nach jedem Befehl erneut.

![Ein Sollwert von 21,4 °C wird gerundet und begrenzt, als SET SETP 21 gesendet, die Antwort sofort veröffentlicht und der Ofen 12 s später erneut gelesen; ein Befehl, den der Ofen ablehnen würde, wird nicht gesendet und Gladys zeigt den Grund an](images/commands.svg)

## Szenen: Auslöser

Jeder Auslöser kann auf einen Ofen beschränkt werden (leer lassen für jeden).

![Rund zwanzig Statuscodes in sieben Phasen: aus, Zündung, Heizen, Eco-Bereitschaft, Abschalten, Endreinigung und Alarm, mit den Phasen, in denen Ein/Aus angenommen wird](images/phases.svg)

| Auslöser               | Wann                                                                                                                          | Variablen                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Ofenzustand geändert   | Der Ofen wechselt in einen neuen Zustand: Aus, Zündung, Heizt, Eco-Bereitschaft, Abschaltung, Endreinigung, Alarm (filterbar) | neuer und vorheriger Zustand, detaillierter Status, Temperatur, Soll, Zusammenfassung |
| Alarm                  | Ein Alarm tritt auf, filterbar nach Typ: keine Pellets, Tür offen, Überhitzung, Zug, Rauchrohrreinigung, Fühler…              | Alarmtext, -typ und -code, Zusammenfassung                                            |
| Alarm behoben          | Der Ofen ist nicht mehr im Alarm                                                                                              | behobener Alarm, neuer Zustand, Zusammenfassung                                       |
| Pellets gehen aus      | Der Füllstandssensor meldet einen niedrigen Stand (ausgestattete Modelle)                                                     | Füllstand, Zusammenfassung                                                            |
| Ofen nicht erreichbar  | Die Connection Box hat dreimal hintereinander nicht geantwortet                                                               | Zusammenfassung                                                                       |
| Ofen wieder erreichbar | Sie antwortet wieder                                                                                                          | Zustand, Temperatur, Zusammenfassung                                                  |

Die **Zusammenfassung** ist ein versandfertiger Satz, z. B. „Wohnzimmer meldet einen Alarm: Keine Pellets mehr.“

Beispiele:

- _Alarm „Keine Pellets“ → Nachricht „{{Zusammenfassung}}“ senden._
- _Zustand wechselt zu „Aus“ → Rollläden schließen._

## Szenen: Aktionen

- **Palazzetti: Ofen lesen** — liefert Zustand, Temperatur, Soll, Leistungsstufe, Gebläse, Abgastemperatur, verbrannte Pellets und eine Zusammenfassung für die folgenden Aktionen (Bedingungen, Nachrichten).
- **Palazzetti: Ofen einstellen** — in einer einzigen Aktion: Ein/Aus (oder unverändert), Soll, Leistungsstufe und Gebläse. Leere Felder ändern nichts. Die Einstellungen werden vor der Zündung gesendet, damit der Ofen direkt mit dem richtigen Sollwert startet. Ein abgelehnter Wert (Alarm, vom Modell nicht angebotene Stufe) lässt die Aktion mit dem Grund fehlschlagen.

Die Funktionen des Geräts funktionieren auch in der Standardaktion „Gerät steuern“.

## Dashboard-Widgets

- **Palazzetti-Ofen** — Raumtemperatur und Soll live, Kurve der letzten 24 Stunden, Zustand (Alarm in Rot), Gebläse, Pellets und vier Tasten: Ein-/Ausschalten (Ausschalten mit Bestätigung), −1 °C, +1 °C und Leistung → nächste. Ohne Kurve erhält die Leistungsstufe eine Kachel.
- **Pelletverbrauch** — heute verbrannte Pellets, Durchschnitt pro Tag, Gesamt, Balken der letzten Tage (7 bis 60), 15-kg-Säcke pro Woche, Zündungen, Heizstunden und Stunden seit Wartung. Der Tagesverlauf wird von der Integration aus dem Zähler des Ofens berechnet: Er erscheint nach dem ersten vollständigen Tag.

## Aktionen der Konfigurationsseite

- **Verbindung testen**: sucht die Boxen und liest jeden Ofen.
- **Ofenuhr stellen**: stellt die Uhr des Ofens (für sein Wochenprogramm) auf die Zeit von Gladys — nützlich nach einem Stromausfall oder einer Zeitumstellung.

## Fehlerbehebung

**Kein Ofen gefunden.** Prüfen Sie, ob die Connection Box eingeschaltet und im selben Netzwerk wie Gladys ist, und tragen Sie ihre IP-Adresse in der Konfiguration ein. Testen Sie im Browser: `http://IP_DER_BOX/cgi-bin/sendmsg.lua?cmd=GET+STAT` muss JSON liefern.

**„Der Ofen antwortet der Box nicht“.** Die Connection Box antwortet, erreicht aber den Ofen nicht: Prüfen Sie das Kabel zwischen Box und Ofen und ob der Ofen Strom hat.

**Ein Befehl wird abgelehnt.** Der Ofen nimmt während einer Zündung, einer Abschaltung oder eines Alarms kein Ein/Aus an; die Gebläse nehmen nur die vom Modell angebotenen Stufen an. Die angezeigte Meldung nennt den Grund.

**Temperaturen bleiben leer.** Ein Fühler mit 0 gilt als nicht vorhanden: Manche Modelle haben nicht alle Fühler.

**Der Tagesverbrauch ist leer.** Er füllt sich Tag für Tag; manche Öfen (Platinen anderer Marken) melden ihren Pelletzähler nicht.

Die Protokolle der Integration finden Sie unter **Integrationen → Palazzetti → Protokolle**.
