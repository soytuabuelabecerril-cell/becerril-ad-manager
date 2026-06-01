import os

base_dir = r"C:\Users\Shadow\.gemini\antigravity\scratch\becerril-ad-manager\src\components"

# --- Patch MagazineGrid.jsx ---
mg_file = os.path.join(base_dir, "MagazineGrid.jsx")
with open(mg_file, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '<span className="text-sm opacity-70 z-10 mix-blend-multiply pointer-events-none">Pg.</span>',
    '<span className="text-sm opacity-70 z-10 mix-blend-multiply pointer-events-none">{t(\'pg\')}</span>'
)
content = content.replace("cName = 'Unknown';", "cName = t('unknown');")
content = content.replace("cName = 'Reserved';", "cName = t('status_reserved');")

with open(mg_file, 'w', encoding='utf-8') as f:
    f.write(content)

# --- Patch PagesOverview.jsx ---
po_file = os.path.join(base_dir, "PagesOverview.jsx")
with open(po_file, 'r', encoding='utf-8') as f:
    content = f.read()

if "useLanguage" not in content:
    content = content.replace(
        "import { getFullPages } from '../utils/fallbackData';",
        "import { getFullPages } from '../utils/fallbackData';\nimport { useLanguage } from '../context/LanguageContext';"
    )
    content = content.replace(
        "const PagesOverview = () => {",
        "const PagesOverview = () => {\n  const { t } = useLanguage();"
    )

content = content.replace("Loading overviews...", "{t('po_loading')}")
content = content.replace(">Total Pages<", ">{t('po_total')}<")
content = content.replace(">Available<", ">{t('po_available_count')}<")
content = content.replace(">Reserved<", ">{t('po_reserved_count')}<")
content = content.replace("Available Pages\n", "{t('po_available_pages')}\n")
content = content.replace("Reserved Pages\n", "{t('po_reserved_pages')}\n")
content = content.replace(">Pg {page.page_number}<", ">{t('pg')} {page.page_number}<")
content = content.replace("Complete Page Directory\n", "{t('po_complete_directory')}\n")
content = content.replace("'No assignment'", "t('po_no_assignment')")
content = content.replace("{isOccupied(page) ? 'Reserved' : 'Available'}", "{isOccupied(page) ? t('po_reserved') : t('po_available')}")

with open(po_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched MagazineGrid and PagesOverview")
