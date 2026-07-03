# 💼 Montera – AI Financial Auditor + Personal Tracker

A high-fidelity SaaS bookkeeping and AI financial auditing platform. Montera converts unstructured statements, receipts, and scans into an IRS-compliant structured ledger.

<p align="center">
  <img src="./montera_logo.png" width="320" alt="Montera Logo" />
</p>

---

## 📽️ Demo Videos
*   📺 **[Business AI Auditing Workspace Video Link]**
*   📺 **[Personal Finance Tracker Video Link]**

---

## 🎯 Target Audience
*   **Freelancers:** Separate personal/business transactions and auto-map tax write-offs.
*   **Business Owners:** Monitor gross margins, monthly cash outflow, and projected runway.
*   **Analysts & Bookkeepers:** Process dense invoices, trace audit paths, and detect anomalies.

---

## ✨ Core Workspaces

### 1. 🧾 AI Auditing Workspace (Business Mode)
*   **Smart Ingestion:** Automatically reads digital PDFs natively or runs **Llama 3.2 Vision OCR** on photos and scans.
*   **RAG Pricing Auditor:** Matches invoices against billing contracts to automatically flag setup-fee anomalies and discrepancies.
*   **Schedule C Auto-Classifier:** Pre-selects IRS tax categories based on vendor names (e.g. *Office/Software* for cloud servers).
*   **2026 Cash Dashboard:** Translucent glassmorphic KPI cards showing inflows, outflows, and quarterly trend forecasts.
*   **Quick-Add Ledger:** Record manual transactions directly into the ledger in two clicks.

### 2. 💳 Personal Tracker (Individual Mode)
*   **Monthly Budgets:** Establish category-specific limits (e.g., Mobile & Internet) and track spending.
*   **Savings Goals:** Track long-term targets (e.g., buying a laptop) showing progress percentages and deadlines.
*   **Visual Reports:** Multi-colored donut charts showing spending distributions.

---

## 🔒 Multi-Tenant Data Isolation
*   **Composite Keys:** All user data is isolated using a combined partition key: `user_id = "${email}:${workspace}"`.
*   **Clean Slate Guarantee:** Logging in with a different email to the same workspace starts with a completely fresh database (**Expenses: BDT 0.00**, clean charts), preventing cross-user data leakage.

---

## 🛠️ Technology Stack
*   **Frontend:** React 18, TypeScript, Vite, Recharts, Lucide-React, custom dark-mode CSS.
*   **Backend:** FastAPI, Uvicorn, LangChain, Groq SDK.
*   **Database:** SQLite (`montera.db`) & local TF-IDF vector database (`documents.json`).
*   **Orchestration:** Docker & Docker Compose.

---

## 🚀 Getting Started

1.  **Add API Key:** Create a `.env` file at the project root:
    ```env
    GROQ_API_KEY=gsk_your_actual_key_here
    ```
2.  **Start App:** Run the Docker build:
    ```bash
    docker compose up --build
    ```
3.  **Access:** Open your browser to `http://localhost:3000`.

---

> [!WARNING]
> ### 🎨 Copying Branding Assets for GitHub
> Before pushing to GitHub, run these commands in your **PowerShell** terminal to copy the logo image into the repository folder so the header display loads correctly:
> ```powershell
> Copy-Item "C:\Users\mdj52\.gemini\antigravity-ide\brain\55265836-c3eb-4a72-828e-e9736f12ecdb\montera_logo_1783077890484.png" "montera_logo.png"
> ```
