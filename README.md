# AI Backoffice Agent Demo (Tickets • CRM • Quotes)

Demo front-end (no backend) che simula un agente di backoffice:
**observe → decide → propose actions → log/audit**, con guardrail (policy).
Nessuna integrazione esterna: tutto gira in locale nel browser.

## Features
- Import CSV (ticket, clienti, prodotti, opportunità)
- Triage ticket: categoria + priorità + azione proposta
- Matching cliente (CRM) e suggerimento next-step
- Bozza preventivo (quote draft) da prodotti + sconti demo
- Guardrail:
  - blocco azioni esterne (email/whatsapp) in demo
  - approvazione umana richiesta per priorità P0
  - mascheramento PII nel report (tel/email)
- Export report JSON (audit-friendly)

## Quick start
1. Scarica/Clona la repo
2. Apri `index.html` con un browser moderno (oppure avvia un server locale)

### Server locale (opzionale)
- Python:
  - `python3 -m http.server 8000`
  - Apri `http://localhost:8000`

## CSV Demo inclusi
- `demo_tickets.csv`
- `demo_customers.csv`
- `demo_products.csv`
- `demo_deals.csv`

## Nota
Questa demo NON invia email/messaggi e NON esegue azioni reali.
Le “azioni” sono proposte e registrate nel log (audit).

## License
MIT
