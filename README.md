# AI Backoffice Agent Demo  
**Tickets • CRM • Preventivi • Audit**

## Descrizione
`ai-backoffice-agent-demo` è una **demo applicativa indipendente** che mostra come un
**agente di backoffice basato su AI** possa supportare attività operative reali
(ticketing, CRM, preventivi), **senza eseguire azioni automatiche sul mondo esterno**.

L’applicazione gira **interamente in locale nel browser**, senza backend e senza
dipendenze esterne.

---

## Cosa sono gli *AI Agent* (in breve)
Un **AI Agent** non è una “persona digitale” né un sistema autonomo nel senso umano.

In termini tecnici, un agente AI è:
- un **processo software**
- che osserva uno stato (input)
- applica regole e modelli di ragionamento
- **propone decisioni o azioni**
- registra ciò che fa (audit)

Uno schema tipico è:

```
observe → decide → propose → guardrail → audit
```

Il punto chiave è che **l’agente non deve eseguire automaticamente le azioni critiche**:
la separazione tra *proposta* ed *esecuzione* è ciò che rende il sistema sicuro e governabile.

---

## Cosa fa questa demo
Questa demo mostra un agente che può:

- analizzare ticket multi‑canale (email, chat, CRM)
- correlare i ticket con dati CRM
- classificare e assegnare priorità (P0 / P1 / P2)
- proporre azioni operative (mai eseguite)
- generare **bozze di preventivo**
- produrre **log e audit verificabili**

👉 Tutte le azioni sono **simulate**.  
👉 Nessuna email, messaggio o modifica reale viene eseguita.

---

## Cosa NON è
- ❌ non è un assistente autonomo in produzione  
- ❌ non sostituisce persone  
- ❌ non prende decisioni irreversibili  
- ❌ non accede a sistemi esterni  

È una **demo tecnica e concettuale** per capire **come funzionano davvero gli agenti AI**.

---

## Contesto e riferimenti
Questo progetto è **concettualmente ispirato** al dibattito recente sui
**framework di agenti AI** (talvolta citati nei media con nomi come *OpenClaw*).

👉 **Questo repository NON utilizza codice, librerie o componenti di tali framework.**  
👉 Il riferimento è **puramente concettuale ed educativo**.

Per chi vuole approfondire il tema degli agenti AI come framework software:
- OpenClaw (repository pubblico):  
  https://github.com/openclaw/openclaw

*(Il link è fornito come riferimento informativo, non come dipendenza tecnica.)*

---

## Dataset demo inclusi
- `demo_tickets.csv` – richieste multi‑canale  
- `demo_customers.csv` – clienti CRM  
- `demo_products.csv` – prodotti e prezzi  
- `demo_deals.csv` – opportunità commerciali  

I dati sono **fittizi** e usati solo a scopo dimostrativo.

---

## Guardrail implementati
- blocco azioni esterne (default ON)
- approvazione umana obbligatoria per ticket critici (P0)
- mascheramento dati sensibili (PII)
- separazione netta tra **proposta** ed **esecuzione**

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
- rendere **concreti** concetti spesso raccontati in modo astratto
- distinguere **possibilità reali** da hype mediatico
- mostrare che il rischio non è l’AI, ma **l’automazione senza controllo**

Il vero valore di un agente AI non è fare tutto da solo,  
ma **sapere quando fermarsi**.

---

## Licenza
MIT

> *Un buon agente non è quello che fa di più,  
> ma quello che rende visibili le decisioni.*
