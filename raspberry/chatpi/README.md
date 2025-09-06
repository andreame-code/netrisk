# ChatPi

ChatPi è un semplice assistente vocale. Questo modulo supporta una modalità di
simulazione pensata per GitHub Codespaces.

## Setup

```bash
cd raspberry/chatpi
./scripts/install.sh
```

## Esecuzione in simulazione

```bash
HEADLESS=1 SIMULATION=keyboard ./scripts/run.sh
```

Lo stato dell'interfaccia viene stampato in console e le risposte sono simulate
se manca la chiave `OPENAI_API_KEY`.

Per eseguire un autotest non interattivo:

```bash
./scripts/selftest.sh
```

I file in `systemd/` sono solo segnaposto per futuri sviluppi.
