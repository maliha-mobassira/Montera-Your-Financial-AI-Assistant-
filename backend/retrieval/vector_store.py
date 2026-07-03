import os
import json
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from langchain_text_splitters import RecursiveCharacterTextSplitter

STORE_DIR = Path(os.getenv("CHROMA_PERSIST_DIR", "./data/vector_store"))
STORE_DIR.mkdir(parents=True, exist_ok=True)
STORE_FILE = STORE_DIR / "documents.json"

_vectorizer = None
_doc_vectors = None
_documents = []


def _load_documents():
    if STORE_FILE.exists():
        with open(STORE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def _save_documents(docs):
    with open(STORE_FILE, "w", encoding="utf-8") as f:
        json.dump(docs, f)


def ingest_document(text: str, metadata: dict, user_id: str = None):
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = splitter.split_text(text)
    if not chunks:
        return 0

    docs = _load_documents()
    for chunk in chunks:
        docs.append({"text": chunk, "metadata": metadata, "user_id": user_id})
    _save_documents(docs)
    return len(chunks)


def retrieve_context(query: str, k: int = 4, user_id: str = None) -> list:
    docs = _load_documents()
    if not docs:
        return []

    # Filter by user_id: permit global seeded docs (user_id is None) or matching user_id
    filtered_docs = [
        d for d in docs
        if d.get("user_id") is None or d.get("user_id") == user_id
    ]
    if not filtered_docs:
        return []

    texts = [d["text"] for d in filtered_docs]
    all_texts = texts + [query]

    vectorizer = TfidfVectorizer(stop_words="english")
    try:
        tfidf_matrix = vectorizer.fit_transform(all_texts)
    except ValueError:
        return texts[:k]

    query_vector = tfidf_matrix[-1]
    doc_vectors = tfidf_matrix[:-1]

    similarities = cosine_similarity(query_vector, doc_vectors).flatten()
    top_indices = similarities.argsort()[::-1][:k]

    return [texts[i] for i in top_indices]


def seed_billing_policies():
    existing = _load_documents()
    if existing:
        print("Billing policies already seeded, skipping.")
        return

    policies = [
        {
            "text": "AWS charges for EC2 instances are billed hourly. Data transfer out costs $0.09 per GB. S3 storage costs $0.023 per GB per month.",
            "metadata": {"source": "aws_billing_policy", "type": "policy"}
        },
        {
            "text": "Stripe payment processing fees are 2.9% plus 30 cents per successful card charge. International cards add 1.5%. Monthly invoices are generated on the 1st of each month.",
            "metadata": {"source": "stripe_billing_policy", "type": "policy"}
        },
        {
            "text": "SaaS subscription renewals auto-renew 30 days before expiration. Annual plans are billed in full at renewal date. Cancellations must be submitted 7 days before renewal.",
            "metadata": {"source": "saas_billing_policy", "type": "policy"}
        },
        {
            "text": "Adobe Creative Cloud subscription costs $54.99 per month or $599.88 per year. Billed on the same date each month. Auto-renews unless cancelled.",
            "metadata": {"source": "adobe_billing_policy", "type": "policy"}
        },
        {
            "text": "Google Cloud Platform charges are billed monthly. Compute Engine VMs are charged per second with a 1 minute minimum. Sustained use discounts apply automatically.",
            "metadata": {"source": "gcp_billing_policy", "type": "policy"}
        }
    ]

    for item in policies:
        ingest_document(item["text"], item["metadata"])

    print(f"Seeded {len(policies)} billing policy documents into vector store.")