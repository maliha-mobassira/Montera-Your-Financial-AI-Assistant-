import base64
from pathlib import Path
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage


def build_vision_llm():
    return ChatGroq(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        temperature=0.1,
        max_tokens=2048
    )


def build_text_llm():
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0.1,
        max_tokens=2048
    )


def encode_image(image_path: str) -> str:
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def extract_pdf_text(file_path: str) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text.strip()
    except Exception as e:
        return f"Could not extract PDF text: {str(e)}"


def analyze_document_image(image_path: str, user_question: str) -> str:
    suffix = Path(image_path).suffix.lower()

    # PDF — always use text extraction, never send as image
    if suffix == ".pdf":
        llm = build_text_llm()
        pdf_text = extract_pdf_text(image_path)

        if not pdf_text:
            return "Could not extract text from this PDF."

        prompt = f"""You are a financial document analyst.

Here is the full text extracted from the PDF document:

{pdf_text[:4000]}

User question: {user_question}

Please analyze this financial document carefully and answer the question.
List all charges, vendors, amounts and dates you can find.
Explain the specific charge the user is asking about."""

        response = llm.invoke(prompt)
        return response.content

    # Image files — use vision model
    elif suffix in [".png", ".jpg", ".jpeg", ".webp"]:
        llm = build_vision_llm()
        image_data = encode_image(image_path)

        if suffix == ".png":
            media_type = "image/png"
        elif suffix in [".jpg", ".jpeg"]:
            media_type = "image/jpeg"
        else:
            media_type = "image/webp"

        message = HumanMessage(content=[
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{media_type};base64,{image_data}"
                }
            },
            {
                "type": "text",
                "text": f"""You are a financial document analyst.

User question: {user_question}

Please analyze this document and:
1. Identify the document type
2. List all charges with vendor names and amounts
3. Identify the specific charge the user is asking about
4. Note dates, tax, subtotal and total amount

Be precise with all amounts and vendor names."""
            }
        ])

        response = llm.invoke([message])
        return response.content

    # Unsupported file type
    else:
        return f"Unsupported file type: {suffix}. Please upload a PDF, JPG or PNG."