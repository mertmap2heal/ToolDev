# Code Debug

_Started 2026-05-09 18:09 UTC_

---

## User

what happened here fix it

## Assistant

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: done]_

Fixed — the filter pills were getting squeezed by the flex layout in the subbar, causing their inner text to wrap vertically. Added `flex-shrink: 0` and `white-space: nowrap` to `.filter-pill` so they hold their natural width.

## User

Save as standalone HTML: parameters-page-v2.standalone-src.html

## Assistant

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: super_inline_html]_

_[tool: show_html]_

_[tool: present_fs_item_for_download]_

Bundled into a single self-contained file — ready to download above.

