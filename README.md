# AI Backoffice Agent Demo  
**Tickets • CRM • Preventivi • Audit**

## Descrizione
`ai-backoffice-agent-demo` è una **demo applicativa indipendente** che mostra come un
**agente di backoffice** possa:

- analizzare ticket multi-canale  
- correlare dati CRM  
- classificare e prioritizzare richieste  
- proporre azioni operative  
- generare bozze di preventivo  
- produrre **log e audit verificabili**

👉 Tutto avviene **senza eseguire azioni reali** (email, messaggi, modifiche esterne).

Il progetto gira **interamente in locale nel browser**, senza backend e senza dipendenze esterne.

---

## Cosa NON è
- ❌ non è un assistente autonomo in produzione  
- ❌ non invia email o messaggi reali  
- ❌ non accede a sistemi esterni  
- ❌ non sostituisce persone  

È una **demo tecnica** per comprendere **processi e rischi** dei sistemi agentici.

---

## Concetto chiave
L’agente segue una pipeline esplicita:

```
observe → decide → propose → guardrail → audit
```

- **observe**: legge input strutturati (CSV demo)  
- **decide**: classifica e assegna priorità  
- **propose**: suggerisce azioni (mai eseguite)  
- **guardrail**: applica policy (approvazione umana, blocchi)  
- **audit**: registra tutto in modo tracciabile  

---

## Contesto
Questo progetto è **concettualmente ispirato** al dibattito sui framework di
**agenti AI autonomi** (talvolta indicati con nomi come *OpenClaw* nei media).

👉 **Non utilizza codice, librerie o componenti di tali framework**.  
👉 Ogni riferimento è **solo esplicativo**, per contestualizzare il problema.

Lo scopo è **mostrare in modo concreto**:
- cosa è tecnicamente possibile oggi  
- dove nascono i rischi reali  
- perché i guardrail sono più importanti del modello AI  

---

## Dataset demo inclusi
- `demo_tickets.csv` – richieste multi-canale  
- `demo_customers.csv` – clienti CRM  
- `demo_products.csv` – prodotti e prezzi  
- `demo_deals.csv` – opportunità commerciali  

I dati sono **fittizi** e usati solo a scopo dimostrativo.

---

## Guardrail implementati
- blocco azioni esterne (default ON)  
- approvazione umana obbligatoria per priorità P0  
- mascheramento dati sensibili (PII)  
- separazione chiara tra *proposta* ed *esecuzione*  

---

## Avvio rapido
1. Clona o scarica la repository  
2. Apri `index.html` in un browser moderno  

*(opzionale: avvia un server locale)*

```bash
python3 -m http.server 8000
```

3. Apri `http://localhost:8000`  
4. Carica i CSV demo o usa **Carica dataset demo**  
5. Premi **Esegui agente**

---

## Perché esiste questo progetto
Questo repository serve a:
- **capire**, non a spaventare  
- **testare concetti**, non sostituire persone  
- **rendere visibile il rischio**, non nasconderlo  

Il vero rischio degli agenti AI **non è l’intelligenza**,  
ma **l’automazione non governata delle azioni**.

---

## Licenza
MIT

> *Un buon agente non è quello che fa di più,  
> ma quello che sa quando fermarsi.*
