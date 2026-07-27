from pathlib import Path
import json
from concurrent.futures import ProcessPoolExecutor
from pypdf import PdfReader

ROOT = Path(r"C:\Users\Samsung\Downloads\tender_ai")
SUBMISSIONS = ROOT / "tmp" / "submissions"
OUT = ROOT / "tmp" / "extracted_text"
OUT.mkdir(parents=True, exist_ok=True)

buyer_pdfs = [
    Path(r"C:\Users\Samsung\Downloads\Vertical Autoclave-10.pdf"),
    Path(r"C:\Users\Samsung\Downloads\Portable X - Ray Machine.pdf"),
    Path(r"C:\Users\Samsung\Downloads\Table Top Autoclave-68.pdf"),
    Path(r"C:\Users\Samsung\Downloads\Foldable Wheelchair (Adult)-30.pdf"),
]
pdfs = buyer_pdfs + list(SUBMISSIONS.rglob("*.pdf"))

def extract_one(item):
    index, pdf_string = item
    pdf = Path(pdf_string)
    try:
        reader = PdfReader(str(pdf))
        page_texts = []
        for page_no, page in enumerate(reader.pages, 1):
            try:
                page_texts.append(f"\n--- PAGE {page_no} ---\n{page.extract_text() or ''}")
            except Exception as exc:
                page_texts.append(f"\n--- PAGE {page_no} ERROR: {exc} ---\n")
        text = "".join(page_texts)
        relative = (
            f"BUYER/{pdf.name}"
            if pdf in buyer_pdfs
            else str(pdf.relative_to(SUBMISSIONS)).replace("\\", "/")
        )
        text_path = OUT / f"{index:04d}.txt"
        text_path.write_text(text, encoding="utf-8", errors="replace")
        return {
            "source": str(pdf),
            "relative": relative,
            "pages": len(reader.pages),
            "text_chars": len(text),
            "text_file": str(text_path),
            "error": "",
        }
    except Exception as exc:
        return {
            "source": str(pdf),
            "relative": str(pdf),
            "pages": 0,
            "text_chars": 0,
            "text_file": "",
            "error": repr(exc),
        }

if __name__ == "__main__":
    with ProcessPoolExecutor(max_workers=8) as executor:
        records = list(executor.map(
            extract_one,
            [(i, str(pdf)) for i, pdf in enumerate(pdfs, 1)],
            chunksize=2,
        ))

    (OUT / "index.json").write_text(json.dumps(records, indent=2), encoding="utf-8")
    print(json.dumps({
        "pdf_count": len(records),
        "with_text": sum(r["text_chars"] > 100 for r in records),
        "low_or_no_text": sum(r["text_chars"] <= 100 for r in records),
        "errors": sum(bool(r["error"]) for r in records),
    }, indent=2))
