import json
from pathlib import Path


class FinancialDocumentParser:
    def __init__(self):
        pass

    def parse(self, file_path: str) -> dict:
        suffix = Path(file_path).suffix.lower()

        if suffix == ".pdf":
            return self._parse_pdf(file_path)
        elif suffix in [".png", ".jpg", ".jpeg"]:
            return self._parse_image(file_path)
        else:
            return {"markdown": "", "raw_text": "Unsupported file type"}

    def _parse_pdf(self, file_path: str) -> dict:
        try:
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            full_text = ""
            for page in reader.pages:
                full_text += page.extract_text() or ""
            return {
                "markdown": full_text,
                "raw_text": full_text
            }
        except Exception as e:
            return {
                "markdown": f"Could not parse PDF: {str(e)}",
                "raw_text": ""
            }

    def _parse_image(self, file_path: str) -> dict:
        try:
            from PIL import Image
            import base64
            with open(file_path, "rb") as f:
                data = base64.b64encode(f.read()).decode("utf-8")
            return {
                "markdown": f"Image file uploaded: {Path(file_path).name}",
                "raw_text": f"Image file: {file_path}"
            }
        except Exception as e:
            return {
                "markdown": f"Could not process image: {str(e)}",
                "raw_text": ""
            }


class FinancialFieldExtractor:
    def __init__(self, llm):
        self.llm = llm

    def extract_fields(self, document_text: str) -> dict:
        prompt = f"""
Extract the following financial fields from this document.
Return ONLY valid JSON with these exact keys:
vendor_name, billing_date, subtotal, tax_amount, total_amount,
line_items (list of objects with description and amount), document_type

Document:
{document_text[:4000]}

JSON:
"""
        response = self.llm.invoke(prompt)
        try:
            text = response.content if hasattr(response, "content") else str(response)
            start = text.find("{")
            end = text.rfind("}") + 1
            return json.loads(text[start:end])
        except Exception:
            return {"error": "Could not extract fields", "raw": text}