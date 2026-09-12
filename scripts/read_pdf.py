import fitz
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

doc = fitz.open('compatible-lists.pdf')
print(f"Total pages in compatible-lists.pdf: {len(doc)}")

full_text = ""
for page_num in range(len(doc)):
    page = doc[page_num]
    full_text += f"\n--- PAGE {page_num + 1} ---\n" + page.get_text()

print(f"Total characters extracted: {len(full_text)}")
print("Sample text (first 1000 chars):")
print(full_text[:1000])

# Search for any occurrences of "BOX" or numbers in the PDF text
box_matches = re.findall(r'BOX\s*\d+', full_text, re.IGNORECASE)
print(f"\nTotal 'BOX N' occurrences in PDF: {len(box_matches)}")
print("Unique BOX numbers found in PDF:", sorted(list(set(m.upper() for m in box_matches))))
