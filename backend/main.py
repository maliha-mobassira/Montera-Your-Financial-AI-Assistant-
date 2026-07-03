# filename: backend/main.py
import os
import shutil
import uuid
import sqlite3
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import Optional, List, Any

from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load env from PROJECT ROOT: ../.env (relative to backend/main.py)
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

# ---- existing AI imports (kept) ----
from extraction.document_parser import FinancialDocumentParser, FinancialFieldExtractor
from core.vision_chain import analyze_document_image, build_vision_llm
from core.rag_pipeline import run_rag_pipeline
from retrieval.vector_store import ingest_document, seed_billing_policies

app = FastAPI(title="Montera - Finance AI Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# Helpers
# =========================
def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"



def make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"

def iso_day(d: date) -> str:
    return d.isoformat()

def first_day_of_month(d: date) -> date:
    return d.replace(day=1)

def month_key(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"

def require_env(name: str) -> str:
    v = os.getenv(name)
    if not v or not v.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                f"{name} is missing. Create a .env file in the PROJECT ROOT "
                f"(finance-ai-assistant-main/finance-ai-assistant-main/.env) and set {name}=YOUR_KEY"
            ),
        )
    return v.strip()

def normalize_upload_to_supported_image(file_path: Path) -> Path:
    """
    Fix for WEBP uploads:
    - Many tools export screenshots as .webp
    - Some parsers/OCR pipelines don't support webp
    This converts WEBP -> PNG (requires Pillow).
    """
    suffix = file_path.suffix.lower()
    if suffix != ".webp":
        return file_path

    try:
        from PIL import Image  # type: ignore
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="WEBP uploads require Pillow. Install: pip install pillow OR upload PNG/JPG/PDF.",
        )

    try:
        img = Image.open(file_path).convert("RGB")
        new_path = file_path.with_suffix(".png")
        img.save(new_path, "PNG")
        return new_path
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to convert WEBP to PNG: {e}")

# =========================
# AI Document Analyzer
# =========================
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./data/uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

parser = FinancialDocumentParser()

# =========================
# Personal Finance DB (SQLite)
# =========================
DATA_DIR = Path(os.getenv("DATA_DIR", "./data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = Path(os.getenv("DB_PATH", str(DATA_DIR / "montera.db")))

DEFAULT_USER_ID = os.getenv("DEFAULT_USER_ID", "local")
DEFAULT_CURRENCY = os.getenv("DEFAULT_CURRENCY", "BDT")

DEFAULT_CATEGORIES = [
    ("Food", "🍔"),
    ("Transport", "🚕"),
    ("Shopping", "🛒"),
    ("Rent", "🏠"),
    ("Utilities", "💡"),
    ("Education", "🎓"),
    ("Entertainment", "🎬"),
    ("Healthcare", "🏥"),
    ("Salary", "💼"),
    ("Investments", "📈"),
    ("Netflix", "🎞️"),
    ("Amazon", "📦"),
    ("YouTube", "▶️"),
    ("Spotify", "🎵"),
]

def db_connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db() -> None:
    conn = db_connect()
    try:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          icon TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        """)

        conn.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('income','expense')),
          amount REAL NOT NULL,
          currency TEXT NOT NULL,
          category_id TEXT,
          payment_method TEXT NOT NULL,
          description TEXT,
          occurred_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(category_id) REFERENCES categories(id)
        );
        """)

        conn.execute("""
        CREATE TABLE IF NOT EXISTS budgets (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          month TEXT NOT NULL,               -- YYYY-MM
          category_id TEXT NOT NULL,
          currency TEXT NOT NULL,
          monthly_limit REAL NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(user_id, month, category_id),
          FOREIGN KEY(category_id) REFERENCES categories(id)
        );
        """)

        conn.execute("""
        CREATE TABLE IF NOT EXISTS savings_goals (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          currency TEXT NOT NULL,
          target_amount REAL NOT NULL,
          saved_amount REAL NOT NULL,
          deadline TEXT,                     -- YYYY-MM-DD (optional)
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        """)

        conn.execute("CREATE INDEX IF NOT EXISTS idx_tx_occurred_at ON transactions(occurred_at);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_cat_user ON categories(user_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_budget_month ON budgets(month);")

        conn.commit()
    finally:
        conn.close()

def seed_default_categories(user_id: str = DEFAULT_USER_ID) -> None:
    conn = db_connect()
    try:
        count = conn.execute(
            "SELECT COUNT(*) AS c FROM categories WHERE user_id = ?",
            (user_id,)
        ).fetchone()["c"]
        if count and count > 0:
            return

        created = now_iso()
        for name, icon in DEFAULT_CATEGORIES:
            cid = make_id("cat")
            conn.execute(
                """
                INSERT INTO categories (id, user_id, name, icon, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (cid, user_id, name, icon, created, created),
            )
        conn.commit()
    finally:
        conn.close()

# =========================
# Pydantic Models
# =========================
class CategoryCreate(BaseModel):
    user_id: str = Field(default=DEFAULT_USER_ID)
    name: str
    icon: Optional[str] = None

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None

class TransactionCreate(BaseModel):
    user_id: str = Field(default=DEFAULT_USER_ID)
    type: str = Field(..., description="income or expense")
    amount: float = Field(..., gt=0)
    currency: str = Field(default=DEFAULT_CURRENCY)
    category_id: Optional[str] = None
    payment_method: str
    description: Optional[str] = None
    occurred_at: str = Field(..., description="ISO datetime e.g. 2026-06-19T08:30:00Z")

class TransactionUpdate(BaseModel):
    type: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    category_id: Optional[str] = None
    payment_method: Optional[str] = None
    description: Optional[str] = None
    occurred_at: Optional[str] = None

class BudgetUpsert(BaseModel):
    user_id: str = Field(default=DEFAULT_USER_ID)
    month: str = Field(..., description="YYYY-MM")
    category_id: str
    currency: str = Field(default=DEFAULT_CURRENCY)
    monthly_limit: float = Field(..., gt=0)

class SavingsGoalCreate(BaseModel):
    user_id: str = Field(default=DEFAULT_USER_ID)
    title: str
    currency: str = Field(default=DEFAULT_CURRENCY)
    target_amount: float = Field(..., gt=0)
    saved_amount: float = Field(default=0, ge=0)
    deadline: Optional[str] = Field(default=None, description="YYYY-MM-DD optional")

class SavingsGoalUpdate(BaseModel):
    title: Optional[str] = None
    currency: Optional[str] = None
    target_amount: Optional[float] = None
    saved_amount: Optional[float] = None
    deadline: Optional[str] = None

# =========================
# Startup
# =========================
@app.on_event("startup")
async def startup():
    init_db()
    seed_default_categories()
    seed_billing_policies()

    groq_loaded = bool(os.getenv("GROQ_API_KEY"))
    print(f"Montera API started successfully. GROQ_API_KEY={'SET' if groq_loaded else 'MISSING'}")

# =========================
# Basic endpoints
# =========================
@app.get("/")
def root():
    return {"message": "Montera API is running. See /docs", "health": "/health"}

@app.get("/health")
def health():
    return {"status": "ok"}

# =========================
# Categories
# =========================
@app.get("/categories")
def list_categories(user_id: str = DEFAULT_USER_ID):
    conn = db_connect()
    try:
        rows = conn.execute(
            "SELECT * FROM categories WHERE user_id = ? ORDER BY name ASC",
            (user_id,)
        ).fetchall()
        return {"items": [dict(r) for r in rows], "count": len(rows)}
    finally:
        conn.close()

@app.post("/categories")
def create_category(payload: CategoryCreate):
    cid = make_id("cat")
    ts = now_iso()

    conn = db_connect()
    try:
        conn.execute(
            """
            INSERT INTO categories (id, user_id, name, icon, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (cid, payload.user_id, payload.name.strip(), payload.icon, ts, ts),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM categories WHERE id = ?", (cid,)).fetchone()
        return dict(row)
    finally:
        conn.close()

@app.put("/categories/{category_id}")
def update_category(category_id: str, payload: CategoryUpdate):
    ts = now_iso()
    conn = db_connect()
    try:
        row = conn.execute("SELECT * FROM categories WHERE id = ?", (category_id,)).fetchone()
        if not row:
            return JSONResponse({"error": "category not found"}, status_code=404)

        current = dict(row)
        name = payload.name.strip() if payload.name is not None else current["name"]
        icon = payload.icon if payload.icon is not None else current["icon"]

        conn.execute(
            "UPDATE categories SET name = ?, icon = ?, updated_at = ? WHERE id = ?",
            (name, icon, ts, category_id),
        )
        conn.commit()
        out = conn.execute("SELECT * FROM categories WHERE id = ?", (category_id,)).fetchone()
        return dict(out)
    finally:
        conn.close()

@app.delete("/categories/{category_id}")
def delete_category(category_id: str):
    conn = db_connect()
    try:
        row = conn.execute("SELECT id FROM categories WHERE id = ?", (category_id,)).fetchone()
        if not row:
            return JSONResponse({"error": "category not found"}, status_code=404)

        conn.execute("UPDATE transactions SET category_id = NULL WHERE category_id = ?", (category_id,))
        conn.execute("DELETE FROM categories WHERE id = ?", (category_id,))
        conn.commit()
        return {"status": "deleted", "id": category_id}
    finally:
        conn.close()

# =========================
# Transactions
# =========================
@app.post("/transactions")
def create_transaction(payload: TransactionCreate):
    if payload.type not in ("income", "expense"):
        return JSONResponse({"error": "type must be 'income' or 'expense'"}, status_code=400)

    tid = make_id("tx")
    ts = now_iso()

    conn = db_connect()
    try:
        conn.execute(
            """
            INSERT INTO transactions
              (id, user_id, type, amount, currency, category_id, payment_method, description, occurred_at, created_at, updated_at)
            VALUES
              (?,  ?,      ?,    ?,      ?,        ?,          ?,             ?,           ?,          ?,          ?)
            """,
            (
                tid,
                payload.user_id,
                payload.type,
                float(payload.amount),
                payload.currency.strip().upper(),
                payload.category_id,
                payload.payment_method.strip(),
                payload.description.strip() if payload.description else None,
                payload.occurred_at.strip(),
                ts,
                ts,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM transactions WHERE id = ?", (tid,)).fetchone()
        return dict(row)
    finally:
        conn.close()

@app.get("/transactions")
def list_transactions(
    user_id: str = DEFAULT_USER_ID,
    frm: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    to: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    tx_type: Optional[str] = Query(default=None, description="income|expense"),
    category_id: Optional[str] = None,
    payment_method: Optional[str] = None,
    q: Optional[str] = Query(default=None, description="search in description"),
    sort: str = Query(default="date_desc", description="date_desc|date_asc|amount_desc|amount_asc"),
    limit: int = 200,
    offset: int = 0,
):
    limit = max(1, min(int(limit), 1000))
    offset = max(0, int(offset))

    where = ["user_id = ?"]
    params: List[Any] = [user_id]

    if frm:
        where.append("substr(occurred_at, 1, 10) >= ?")
        params.append(frm)
    if to:
        where.append("substr(occurred_at, 1, 10) <= ?")
        params.append(to)
    if tx_type:
        if tx_type not in ("income", "expense"):
            return JSONResponse({"error": "tx_type must be income|expense"}, status_code=400)
        where.append("type = ?")
        params.append(tx_type)
    if category_id:
        where.append("category_id = ?")
        params.append(category_id)
    if payment_method:
        where.append("LOWER(payment_method) = LOWER(?)")
        params.append(payment_method)
    if q:
        where.append("LOWER(COALESCE(description,'')) LIKE ?")
        params.append(f"%{q.lower()}%")

    order_by = "occurred_at DESC"
    if sort == "date_asc":
        order_by = "occurred_at ASC"
    elif sort == "amount_desc":
        order_by = "amount DESC"
    elif sort == "amount_asc":
        order_by = "amount ASC"

    where_sql = " AND ".join(where)
    sql = f"""
      SELECT * FROM transactions
      WHERE {where_sql}
      ORDER BY {order_by}
      LIMIT ? OFFSET ?
    """
    params.extend([limit, offset])

    conn = db_connect()
    try:
        rows = conn.execute(sql, params).fetchall()
        items = [dict(r) for r in rows]
        return {"items": items, "count": len(items), "limit": limit, "offset": offset}
    finally:
        conn.close()

@app.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: str):
    conn = db_connect()
    try:
        row = conn.execute("SELECT id FROM transactions WHERE id = ?", (transaction_id,)).fetchone()
        if not row:
            return JSONResponse({"error": "transaction not found"}, status_code=404)
        conn.execute("DELETE FROM transactions WHERE id = ?", (transaction_id,))
        conn.commit()
        return {"status": "deleted", "id": transaction_id}
    finally:
        conn.close()

# =========================
# Personal overview
# =========================
@app.get("/personal/overview")
def personal_overview(
    user_id: str = DEFAULT_USER_ID,
    frm: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    to: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    currency: str = DEFAULT_CURRENCY,
):
    today = datetime.utcnow().date()
    if frm is None:
        frm = iso_day(first_day_of_month(today))
    if to is None:
        to = iso_day(today)

    conn = db_connect()
    try:
        totals = conn.execute(
            """
            SELECT
              SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS income,
              SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense
            FROM transactions
            WHERE user_id = ?
              AND currency = ?
              AND substr(occurred_at, 1, 10) BETWEEN ? AND ?
            """,
            (user_id, currency.upper(), frm, to),
        ).fetchone()

        total_income = float(totals["income"] or 0.0)
        total_expense = float(totals["expense"] or 0.0)
        savings = total_income - total_expense
        balance = savings

        trend_rows = conn.execute(
            """
            SELECT
              substr(occurred_at, 1, 10) AS day,
              SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS income,
              SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense
            FROM transactions
            WHERE user_id = ?
              AND currency = ?
              AND substr(occurred_at, 1, 10) BETWEEN ? AND ?
            GROUP BY day
            ORDER BY day ASC
            """,
            (user_id, currency.upper(), frm, to),
        ).fetchall()
        trend = [{"day": r["day"], "income": float(r["income"] or 0), "expense": float(r["expense"] or 0)} for r in trend_rows]

        cat_rows = conn.execute(
            """
            SELECT
              COALESCE(c.name, 'Uncategorized') AS category,
              COALESCE(c.icon, '') AS icon,
              SUM(t.amount) AS total
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            WHERE t.user_id = ?
              AND t.currency = ?
              AND t.type = 'expense'
              AND substr(t.occurred_at, 1, 10) BETWEEN ? AND ?
            GROUP BY category, icon
            ORDER BY total DESC
            LIMIT 8
            """,
            (user_id, currency.upper(), frm, to),
        ).fetchall()
        top_categories = [{"category": r["category"], "icon": r["icon"], "total": float(r["total"] or 0)} for r in cat_rows]

        return {
            "range": {"from": frm, "to": to},
            "currency": currency.upper(),
            "total_income": total_income,
            "total_expenses": total_expense,
            "savings": savings,
            "balance": balance,
            "trend": trend,
            "top_categories": top_categories,
        }
    finally:
        conn.close()

# =========================
# Budgets
# =========================
@app.put("/budgets")
def upsert_budget(payload: BudgetUpsert):
    bid = make_id("bud")
    ts = now_iso()

    conn = db_connect()
    try:
        existing = conn.execute(
            "SELECT * FROM budgets WHERE user_id = ? AND month = ? AND category_id = ?",
            (payload.user_id, payload.month, payload.category_id),
        ).fetchone()

        if existing:
            conn.execute(
                """
                UPDATE budgets
                SET currency = ?, monthly_limit = ?, updated_at = ?
                WHERE user_id = ? AND month = ? AND category_id = ?
                """,
                (payload.currency.upper(), float(payload.monthly_limit), ts, payload.user_id, payload.month, payload.category_id),
            )
        else:
            conn.execute(
                """
                INSERT INTO budgets (id, user_id, month, category_id, currency, monthly_limit, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (bid, payload.user_id, payload.month, payload.category_id, payload.currency.upper(), float(payload.monthly_limit), ts, ts),
            )

        conn.commit()

        row = conn.execute(
            "SELECT * FROM budgets WHERE user_id = ? AND month = ? AND category_id = ?",
            (payload.user_id, payload.month, payload.category_id),
        ).fetchone()
        return dict(row)
    finally:
        conn.close()

@app.get("/budgets")
def list_budgets(
    user_id: str = DEFAULT_USER_ID,
    month: Optional[str] = Query(default=None, description="YYYY-MM (default current month)"),
    currency: str = DEFAULT_CURRENCY
):
    if month is None:
        month = month_key(datetime.utcnow().date())

    y, m = month.split("-")
    start = date(int(y), int(m), 1)
    if int(m) == 12:
        end = date(int(y) + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(int(y), int(m) + 1, 1) - timedelta(days=1)

    frm = iso_day(start)
    to = iso_day(end)

    conn = db_connect()
    try:
        budgets = conn.execute(
            """
            SELECT b.*, COALESCE(c.name,'Uncategorized') AS category_name, COALESCE(c.icon,'') AS icon
            FROM budgets b
            LEFT JOIN categories c ON c.id = b.category_id
            WHERE b.user_id = ? AND b.month = ? AND b.currency = ?
            ORDER BY category_name ASC
            """,
            (user_id, month, currency.upper()),
        ).fetchall()

        spent_rows = conn.execute(
            """
            SELECT category_id, SUM(amount) AS spent
            FROM transactions
            WHERE user_id = ?
              AND currency = ?
              AND type = 'expense'
              AND substr(occurred_at, 1, 10) BETWEEN ? AND ?
            GROUP BY category_id
            """,
            (user_id, currency.upper(), frm, to),
        ).fetchall()
        spent_map = {r["category_id"]: float(r["spent"] or 0) for r in spent_rows}

        items = []
        for b in budgets:
            limit_amt = float(b["monthly_limit"])
            spent_amt = float(spent_map.get(b["category_id"], 0.0))
            remaining = limit_amt - spent_amt
            items.append({
                **dict(b),
                "category_name": b["category_name"],
                "icon": b["icon"],
                "spent": spent_amt,
                "remaining": remaining
            })

        return {"month": month, "currency": currency.upper(), "items": items, "count": len(items)}
    finally:
        conn.close()

# =========================
# Goals
# =========================
@app.post("/goals")
def create_goal(payload: SavingsGoalCreate):
    gid = make_id("goal")
    ts = now_iso()
    conn = db_connect()
    try:
        conn.execute(
            """
            INSERT INTO savings_goals (id, user_id, title, currency, target_amount, saved_amount, deadline, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                gid,
                payload.user_id,
                payload.title.strip(),
                payload.currency.upper(),
                float(payload.target_amount),
                float(payload.saved_amount),
                payload.deadline,
                ts,
                ts,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM savings_goals WHERE id = ?", (gid,)).fetchone()
        return dict(row)
    finally:
        conn.close()

@app.get("/goals")
def list_goals(user_id: str = DEFAULT_USER_ID, currency: str = DEFAULT_CURRENCY):
    conn = db_connect()
    try:
        rows = conn.execute(
            "SELECT * FROM savings_goals WHERE user_id = ? AND currency = ? ORDER BY created_at DESC",
            (user_id, currency.upper()),
        ).fetchall()
        return {"items": [dict(r) for r in rows], "count": len(rows)}
    finally:
        conn.close()

@app.delete("/goals/{goal_id}")
def delete_goal(goal_id: str):
    conn = db_connect()
    try:
        row = conn.execute("SELECT id FROM savings_goals WHERE id = ?", (goal_id,)).fetchone()
        if not row:
            return JSONResponse({"error": "goal not found"}, status_code=404)
        conn.execute("DELETE FROM savings_goals WHERE id = ?", (goal_id,))
        conn.commit()
        return {"status": "deleted", "id": goal_id}
    finally:
        conn.close()

# =========================
# AI analyze endpoint (improved for images / WEBP)
# =========================
@app.post("/analyze")
async def analyze_document(
    file: UploadFile = File(...),
    question: str = Form(...),
    user_id: str = Form("local")
):
    require_env("GROQ_API_KEY")

    file_path = UPLOAD_DIR / file.filename
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Convert WEBP -> PNG if needed
    file_path = normalize_upload_to_supported_image(file_path)

    try:
        # Parse (best effort). Some parsers may fail for some image types.
        parsed = {"markdown": "", "raw_text": ""}
        try:
            parsed = parser.parse(str(file_path))
        except Exception:
            # keep parsed empty; we will fall back to vision_analysis text
            parsed = {"markdown": "", "raw_text": ""}

        # Vision analysis (works for images/scans)
        vision_analysis = analyze_document_image(str(file_path), question)

        # Choose best text for field extraction
        text_for_extraction = (parsed.get("markdown") or "").strip()
        if not text_for_extraction:
            text_for_extraction = (parsed.get("raw_text") or "").strip()
        if not text_for_extraction:
            # fallback: at least give extractor something meaningful for images
            text_for_extraction = str(vision_analysis)

        llm = build_vision_llm()
        field_extractor = FinancialFieldExtractor(llm)
        fields = field_extractor.extract_fields(text_for_extraction)

        # Only ingest if we have real text (avoid ingesting error strings)
        raw_text = (parsed.get("raw_text") or "").strip()
        if raw_text and "Unsupported file type" not in raw_text:
            ingest_document(raw_text, {
                "filename": file.filename,
                "vendor": fields.get("vendor_name", "unknown"),
                "type": fields.get("document_type", "unknown")
            }, user_id=user_id)

        result = run_rag_pipeline(
            user_question=question,
            document_analysis=vision_analysis,
            extracted_fields=fields,
            user_id=user_id
        )

        return JSONResponse({
            "answer": result["answer"],
            "extracted_fields": fields,
            "vision_analysis": vision_analysis,
            "context_used": result["context_used"],
            "document_markdown": text_for_extraction[:2000],
            "filename": file.filename,
            "content_type": file.content_type
        })

    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)