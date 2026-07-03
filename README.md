# 💼 Montera – AI Financial Auditor + Personal Tracker

Montera is a full-stack financial platform designed to bridge unstructured documents—like receipts, invoices, and bank statements—into structured, IRS-compliant accounting ledgers. 

It features a dual-persona design: a **Business / AI Auditing Workspace** for freelancers and bookkeepers, and a **Personal Tracker** for individual household budget management.

<p align="center">
  <img src="file:///C:/Users/mdj52/.gemini/antigravity-ide/brain/55265836-c3eb-4a72-828e-e9736f12ecdb/montera_logo_1783077890484.png" width="300" alt="Montera World Class Logo" />
</p>

---

## 📽️ Video Demonstrations
*   📺 **[Watch the Business AI Auditing Demo (Drive Link)]**
*   📺 **[Watch the Personal Finance Tracker Demo (Drive Link)]**

---

## 🚀 How the System Works (Under the Hood)

Below is the request lifecycle flowchart showing how an uploaded invoice translates into a cash-flow projection in real time:

<p align="center">
  <img src="file:///C:/Users/mdj52/.gemini/antigravity-ide/brain/55265836-c3eb-4a72-828e-e9736f12ecdb/montera_architecture_flow_1783080137368.png" width="650" alt="Montera Request Lifecycle Flowchart" />
</p>

1.  **Ingest & Detect:** You upload a file (PDF or image). The system automatically routes digital PDFs to `pypdf` or triggers **Llama 3.2 Vision OCR** on Groq for scanned photos.
2.  **AI Audit:** The extracted text is run through a **Llama 3.3 70B** parser. The AI extracts metadata (Vendor, Date, Amount) and highlights one-time pricing anomalies.
3.  **Secure Partitioning:** Both the relational SQLite database and the TF-IDF vector database isolate your records using a composite partition key: `user_id = "${email}:${workspace}"`.
4.  **Instant Charts:** Saving the transaction triggers a re-fetch, drawing animated Cash Flow trend lines on the dashboard.

---

## 👥 How to Use Montera (Step-by-Step User Guide)

### 🏢 1. The Business Workspace (For Freelancers & Analysts)

#### Step A: Portal Sign-In & Workspace Isolation
1.  Navigate to `http://localhost:3000`. You will be greeted by the **SaaS Demo Login Portal**.
2.  Enter any valid email address (e.g. `yourname@company.com`) and password (minimum 4 characters).
3.  Choose a workspace name (e.g. `acme_ventures`) and select the **Business Persona**.
4.  Click **Access Workspace**. Your workspace database is now isolated; logging in with a different email will start completely empty (Expenses: BDT 0.00).

#### Step B: Ingestion & Smart IRS Tax Allocation
1.  Click **Upload** in the sidebar. 
2.  Drag and drop an invoice or receipt (e.g., Google Cloud bill, Uber receipt) into the dotted neon scan box.
3.  Click **Process & Audit**. The system runs OCR and returns a structured markdown analysis table.
4.  Verify the extracted fields below the answer window:
    *   **Vendor Name, Total Amount, and Billing Date** are pre-populated but fully editable.
    *   The **IRS Schedule C tax dropdown** automatically pre-selects correct tax categories (e.g., *Office/Software* for cloud services, *Utilities* for server hosting).
5.  Click **Save as Transaction** to write the record to your SQLite ledger database.

#### Step C: Redesigned 2026 Dashboard
1.  Click **Dashboard** in the sidebar.
2.  Observe the premium glassmorphic KPI cards with outer shadow glows.
3.  Click **Enable Demo Sandbox Data** to instantly draw Recharts lines and Cash Flow bar graphs.
4.  Scroll to the **Quick Ledger Entry** form to manually log transactions in two clicks.

---

### 💳 2. The Personal Workspace (For Personal Tracking)

#### Step A: Setup Categories
1.  Navigate to **Categories** in the sidebar.
2.  Add items with custom emojis (e.g. 🍲 `Groceries & Dining`, 📱 `Mobile & Internet`, 🏠 `Rent & Housing`, 📚 `Education & Books`).

#### Step B: Log Expenses & Income
1.  Navigate to the **Transactions** view.
2.  Add logs (e.g. BDT 35,000.00 Freelance Income, BDT 1,200.00 Internet Expense, BDT 12,000.00 Rent Expense).
3.  View the list of transactions in your history ledger at the bottom.

#### Step C: Allocate Budgets & Goals
1.  Go to the **Budgets** view and set monthly allowances for the active month (e.g. BDT 2,000.00 for Mobile & Internet). The dashboard will display a percentage warning bar showing budget consumption.
2.  Go to the **Goals** view and set a savings target (e.g. `New Laptop for Coding`, Target: `120000`, Already Saved: `25000`). It will automatically calculate your progress percentage (20.8%).

---

## 🔒 Multi-Tenant Data Security
*   **Isolated Database RAG:** Document vector chunks in `documents.json` are tagged with your `user_id`. When User A runs an AI chat, they can only search files belonging to their active login email.
*   **Isolated Transactions:** Ledger data is queried using `user_id = "${email}:${workspace}"` filters, preventing cross-user workspace leakage.

---

## 🛠️ Technology Stack
*   **Frontend SPA:** React 18, TypeScript, Vite, Recharts, Lucide-React, custom dark-mode CSS.
*   **Backend Routing:** FastAPI, Uvicorn, LangChain, Groq API (Llama 3.2/3.3 models).
*   **Database Layers:** SQLite (`montera.db`) & local TF-IDF vector database (`documents.json`).
*   **Infrastructure:** Docker & Docker Compose.

---

## 💻 Terminal Commands

### Option A — Run via Docker (Recommended)
1.  Add your Groq API key to a `.env` file at the root:
    ```env
    GROQ_API_KEY=gsk_your_actual_key_here
    ```
2.  Start the containers:
    ```bash
    docker compose up --build
    ```
3.  Access the web client at `http://localhost:3000`.

### Option B — Run Locally
*   **Backend Server Setup:**
    ```bash
    cd backend
    pip install -r requirements.txt
    python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
    ```
*   **Frontend Client Setup:**
    ```bash
    cd frontend
    npm install
    npm start
    ```
