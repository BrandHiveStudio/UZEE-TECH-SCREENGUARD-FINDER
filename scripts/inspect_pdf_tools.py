import sys
sys.stdout.reconfigure(encoding='utf-8')

for pkg in ['fitz', 'pdfplumber', 'PyPDF2', 'pypdf', 'pdfminer']:
    try:
        __import__(pkg)
        print(f"OK: {pkg} is installed")
    except ImportError:
        print(f"NO: {pkg} is NOT installed")
