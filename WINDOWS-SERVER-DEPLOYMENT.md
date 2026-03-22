# Foodbook - Windows Server Deployment mit Bun, PM2 und IIS

Diese Anleitung beschreibt das Production-Deployment der Foodbook-Anwendung auf einem Windows Server mit:
- **Bun** als Runtime
- **PM2** als Process Manager
- **IIS** als Reverse Proxy

## Inhaltsverzeichnis

1. [Voraussetzungen](#voraussetzungen)
2. [Installation der Komponenten](#installation-der-komponenten)
3. [Anwendung einrichten](#anwendung-einrichten)
4. [PM2 konfigurieren](#pm2-konfigurieren)
5. [IIS als Reverse Proxy einrichten](#iis-als-reverse-proxy-einrichten)
6. [HTTPS konfigurieren](#https-konfigurieren)
7. [Wartung und Updates](#wartung-und-updates)
8. [Troubleshooting](#troubleshooting)

---

## Voraussetzungen

- Windows Server 2016 oder neuer
- Administrator-Rechte
- Internetverbindung für Downloads

---

## Installation der Komponenten

### 1. Node.js installieren

PM2 benötigt Node.js:

1. Download: https://nodejs.org/ (LTS Version, z.B. 20.x)
2. Installer ausführen mit Standardeinstellungen
3. Überprüfen:
   ```powershell
   node --version
   npm --version
   ```

### 2. Bun installieren

```powershell
# PowerShell als Administrator
powershell -c "irm bun.sh/install.ps1|iex"
```

Nach der Installation PowerShell neu starten und überprüfen:
```powershell
bun --version
```

**Alternative Installation** (falls obiger Befehl nicht funktioniert):
```powershell
npm install -g bun
```

### 3. PM2 installieren

```powershell
npm install -g pm2
npm install -g pm2-windows-startup
```

PM2 als Windows-Dienst einrichten:
```powershell
pm2-startup install
```

### 4. Git installieren (optional)

Download: https://git-scm.com/download/win

Für Updates via Git-Pull empfohlen.

### 5. IIS installieren

```powershell
# PowerShell als Administrator
Install-WindowsFeature -name Web-Server -IncludeManagementTools
```

Oder über Server Manager:
- Rollen und Features hinzufügen
- Web Server (IIS) auswählen
- Installation durchführen

### 6. IIS-Module installieren

**Application Request Routing (ARR):**
- Download: https://www.iis.net/downloads/microsoft/application-request-routing
- Installer ausführen

**URL Rewrite Module:**
- Download: https://www.iis.net/downloads/microsoft/url-rewrite
- Installer ausführen

---

## Anwendung einrichten

### 1. Repository klonen

```powershell
# Ins gewünschte Verzeichnis wechseln
cd C:\inetpub\wwwroot

# Repository klonen
git clone https://github.com/Mattes1000/foodbook.git
cd foodbook
```

### 2. Frontend bauen

```powershell
cd client
npm install
npm run build
cd ..
```

Das Frontend wird nach `client/dist` gebaut.

### 3. Backend Dependencies installieren

```powershell
cd server
bun install
cd ..
```

### 4. Datenbank initialisieren

```powershell
cd server
bun run seed
cd ..
```

Dies erstellt die SQLite-Datenbank mit Testdaten.

### 5. Test-Start

```powershell
cd server
bun run start
```

Öffne im Browser: `http://localhost:3001`

Wenn alles funktioniert, mit `Ctrl+C` beenden.

---

## PM2 konfigurieren

### 1. PM2 Ecosystem-Datei erstellen

Erstelle `C:\inetpub\wwwroot\foodbook\ecosystem.config.cjs`:

```javascript
module.exports = {
  apps: [{
    name: 'foodbook',
    cwd: 'C:\\inetpub\\wwwroot\\foodbook\\server',
    script: 'bun',
    args: 'run start',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: '3001'
    },
    error_file: 'C:\\inetpub\\wwwroot\\foodbook\\logs\\err.log',
    out_file: 'C:\\inetpub\\wwwroot\\foodbook\\logs\\out.log',
    log_file: 'C:\\inetpub\\wwwroot\\foodbook\\logs\\combined.log',
    time: true
  }]
};
```

### 2. Log-Verzeichnis erstellen

```powershell
New-Item -ItemType Directory -Path "C:\inetpub\wwwroot\foodbook\logs" -Force
```

### 3. Anwendung mit PM2 starten

```powershell
cd C:\inetpub\wwwroot\foodbook
pm2 start ecosystem.config.cjs
```

### 4. PM2 Status überprüfen

```powershell
pm2 status
pm2 logs foodbook
```

### 5. PM2 Autostart aktivieren

```powershell
pm2 save
pm2 startup
```

Dies stellt sicher, dass die Anwendung nach einem Server-Neustart automatisch startet.

### 6. PM2 als Windows-Dienst

```powershell
pm2-startup install
```

Überprüfen im Windows Dienste-Manager (`services.msc`):
- Dienst: "PM2"
- Starttyp: Automatisch

---

## IIS als Reverse Proxy einrichten

### 1. ARR Proxy aktivieren

1. **IIS Manager öffnen**
2. **Server-Ebene** auswählen (nicht Website)
3. **Application Request Routing Cache** öffnen
4. Rechts: **Server Proxy Settings**
5. **Enable proxy** aktivieren
6. **Apply** klicken

### 2. Neue Website erstellen

1. Im IIS Manager: **Sites** → Rechtsklick → **Add Website**
2. Konfiguration:
   - **Site name:** Foodbook
   - **Physical path:** `C:\inetpub\wwwroot\foodbook\client\dist`
   - **Binding:**
     - Type: http
     - Port: 80
     - Host name: `foodbook.example.com` (oder leer lassen für alle)

### 3. URL Rewrite Regel erstellen

1. Website **Foodbook** auswählen
2. **URL Rewrite** öffnen
3. Rechts: **Add Rule(s)** → **Reverse Proxy**
4. Wenn gefragt: **Enable proxy** → OK
5. Konfiguration:
   - **Inbound Rules:** `localhost:3001`
   - **Enable SSL Offloading:** Nein (vorerst)
   - **OK** klicken

### 4. Manuelle Konfiguration (Alternative)

Falls die automatische Regel nicht funktioniert, erstelle `C:\inetpub\wwwroot\foodbook\client\dist\web.config`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <!-- API Requests → Backend -->
        <rule name="API Proxy" stopProcessing="true">
          <match url="^api/(.*)" />
          <action type="Rewrite" url="http://localhost:3001/api/{R:1}" />
        </rule>
        
        <!-- Static Files → Try file first -->
        <rule name="Static Files" stopProcessing="true">
          <match url="^(.*)$" />
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" />
          </conditions>
          <action type="None" />
        </rule>
        
        <!-- SPA Fallback → index.html -->
        <rule name="SPA Fallback">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
    
    <staticContent>
      <mimeMap fileExtension=".json" mimeType="application/json" />
      <mimeMap fileExtension=".woff" mimeType="font/woff" />
      <mimeMap fileExtension=".woff2" mimeType="font/woff2" />
    </staticContent>
  </system.webServer>
</configuration>
```

### 5. Website testen

1. **Website starten** im IIS Manager
2. Browser öffnen: `http://localhost` oder `http://foodbook.example.com`
3. Testen:
   - Frontend lädt
   - Login funktioniert
   - API-Anfragen funktionieren

---

## HTTPS konfigurieren

### 1. SSL-Zertifikat erhalten

**Option A: Let´s Encrypt (kostenlos)**
- Tool: win-acme (https://www.win-acme.com/)
- Automatische Erneuerung

**Option B: Kommerzielles Zertifikat**
- Von Zertifizierungsstelle kaufen
- In IIS importieren

**Option C: Self-Signed (nur für Tests)**
```powershell
New-SelfSignedCertificate -DnsName "foodbook.example.com" -CertStoreLocation "cert:\LocalMachine\My"
```

### 2. HTTPS Binding hinzufügen

1. Im IIS Manager: Website **Foodbook** → **Bindings**
2. **Add** klicken:
   - Type: https
   - Port: 443
   - SSL certificate: Zertifikat auswählen
3. **OK** klicken

### 3. HTTP zu HTTPS umleiten

Füge in `web.config` hinzu (vor `</rules>`):

```xml
<rule name="HTTP to HTTPS redirect" stopProcessing="true">
  <match url="(.*)" />
  <conditions>
    <add input="{HTTPS}" pattern="off" ignoreCase="true" />
  </conditions>
  <action type="Redirect" url="https://{HTTP_HOST}/{R:1}" redirectType="Permanent" />
</rule>
```

---

## Wartung und Updates

### Updates einspielen

```powershell
# 1. Ins Projektverzeichnis
cd C:\inetpub\wwwroot\foodbook

# 2. Neueste Version holen
git pull

# 3. Frontend neu bauen
cd client
npm install
npm run build
cd ..

# 4. Backend Dependencies aktualisieren
cd server
bun install
cd ..

# 5. PM2 neu starten
pm2 restart foodbook
```

### Datenbank-Backup

```powershell
# Manuelles Backup
$date = Get-Date -Format "yyyy-MM-dd_HHmmss"
Copy-Item "C:\inetpub\wwwroot\foodbook\server\foodbook.db" "C:\Backups\foodbook-$date.db"
```

**Automatisches Backup** (Task Scheduler):
1. Task Scheduler öffnen
2. Neue Aufgabe erstellen:
   - Trigger: Täglich um 2:00 Uhr
   - Aktion: PowerShell-Skript mit obigem Befehl

### Logs überwachen

```powershell
# PM2 Logs
pm2 logs foodbook

# PM2 Logs anzeigen (letzte 100 Zeilen)
pm2 logs foodbook --lines 100

# Log-Dateien direkt
Get-Content C:\inetpub\wwwroot\foodbook\logs\combined.log -Tail 50 -Wait
```

### PM2 Befehle

```powershell
# Status anzeigen
pm2 status

# Anwendung neu starten
pm2 restart foodbook

# Anwendung stoppen
pm2 stop foodbook

# Anwendung starten
pm2 start foodbook

# Logs löschen
pm2 flush

# Monitoring
pm2 monit
```

---

## Troubleshooting

### Problem: Website zeigt 502 Bad Gateway

**Ursache:** Backend läuft nicht

**Lösung:**
```powershell
pm2 status
pm2 restart foodbook
pm2 logs foodbook
```

### Problem: API-Anfragen schlagen fehl (404)

**Ursache:** URL Rewrite Regel falsch

**Lösung:**
1. `web.config` überprüfen
2. URL Rewrite Module installiert?
3. ARR Proxy aktiviert?

### Problem: Statische Dateien werden nicht geladen

**Ursache:** Frontend nicht gebaut oder falscher Pfad

**Lösung:**
```powershell
cd C:\inetpub\wwwroot\foodbook\client
npm run build
# Überprüfe: dist\index.html existiert?
```

### Problem: PM2 startet nach Neustart nicht

**Ursache:** PM2 Startup nicht konfiguriert

**Lösung:**
```powershell
pm2 save
pm2 startup
pm2-startup install
```

### Problem: Datenbank-Fehler

**Ursache:** Berechtigungen fehlen

**Lösung:**
```powershell
# IIS Application Pool Identität Schreibrechte geben
icacls "C:\inetpub\wwwroot\foodbook\server" /grant "IIS AppPool\Foodbook:(OI)(CI)F" /T
```

### Problem: Port 3001 bereits belegt

**Ursache:** Anderer Prozess nutzt Port

**Lösung:**
```powershell
# Port ändern in ecosystem.config.cjs
# env.PORT auf anderen Wert setzen (z.B. 3002)
# Auch in web.config anpassen!
```

### Logs überprüfen

**PM2 Logs:**
```powershell
pm2 logs foodbook --lines 200
```

**IIS Logs:**
```
C:\inetpub\logs\LogFiles\W3SVC1\
```

**Windows Event Viewer:**
- Windows Logs → Application
- Nach Fehlern von "PM2" oder "IIS" suchen

---

## Firewall-Konfiguration

### Ports freigeben

```powershell
# HTTP (Port 80)
New-NetFirewallRule -DisplayName "Foodbook HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow

# HTTPS (Port 443)
New-NetFirewallRule -DisplayName "Foodbook HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
```

**Hinweis:** Port 3001 muss NICHT nach außen freigegeben werden, da IIS als Reverse Proxy fungiert.

---

## Performance-Optimierung

### IIS Compression aktivieren

1. IIS Manager → Server-Ebene
2. **Compression** öffnen
3. Aktivieren:
   - Enable dynamic content compression
   - Enable static content compression

### PM2 Cluster Mode (optional)

Für mehrere CPU-Kerne in `ecosystem.config.cjs`:

```txt
instances: 'max',  
exec_mode: 'cluster'
```

**Hinweis:** Bun unterstützt Cluster Mode möglicherweise nicht vollständig.

---

## Zusammenfassung

**Architektur:**
```
Internet
   ↓
IIS (Port 80/443) - Reverse Proxy
   ↓
PM2 → Bun (Port 3001) - Backend + Frontend
   ↓
SQLite Datenbank
```

**Vorteile dieser Lösung:**
- ✅ Bun für maximale Performance
- ✅ PM2 für automatischen Neustart und Monitoring
- ✅ IIS für professionelles Hosting mit HTTPS
- ✅ Einfache Updates via Git
- ✅ Windows-native Lösung

**Wichtige Dateien:**
- `C:\inetpub\wwwroot\foodbook\ecosystem.config.cjs` - PM2 Konfiguration
- `C:\inetpub\wwwroot\foodbook\client\dist\web.config` - IIS Konfiguration
- `C:\inetpub\wwwroot\foodbook\server\foodbook.db` - Datenbank

---

## Support-Checkliste

Bei Problemen durchgehen:

- [ ] Bun installiert? `bun --version`
- [ ] PM2 läuft? `pm2 status`
- [ ] Backend erreichbar? `http://localhost:3001/api/health`
- [ ] IIS läuft? Website gestartet?
- [ ] URL Rewrite installiert?
- [ ] ARR Proxy aktiviert?
- [ ] Firewall-Regeln gesetzt?
- [ ] Logs überprüft? `pm2 logs foodbook`

---

**Erstellt für:** Foodbook v1.0  
**Getestet auf:** Windows Server 2019/2022  
**Letzte Aktualisierung:** März 2026
