const fs = require('fs')
const path = 'd:/ToolDevelopment/frontend/src/components/requirements/ExportBuilder.tsx'
let content = fs.readFileSync(path, 'utf8')

// ====== PATCH 1: Replace handleExport function ======
const oldHandleExport = `  // Handle export
  const handleExport = async () => {
    const selectedCols = columns.filter((c) => c.selected)
    setInlineError(null)
    if (selectedCols.length === 0) {
      setInlineError('Please select at least one column to export.')
      return
    }
    if (!canExport) {
      if (enableScopeSelection && scopeType === 'custom') {
        setInlineError('Select at least one component or function for the custom scope (or switch to "All requirements").')
      } else {
        setInlineError('No requirements match the current scope/filters.')
      }
      return
    }

    setIsExporting(true)
    try {
      switch (selectedFormat) {
        case 'csv':
          exportCsv()
          break
        case 'excel':
          exportExcel()
          break
        case 'pdf':
          await exportPdf()
          break
        case 'word':
          await exportWord()
          break
        case 'reqif':
          await exportReqIF()
          break
      }
      onClose()
    } catch (error) {
      console.error('Export error:', error)
      setInlineError(error instanceof Error ? error.message : 'Failed to export. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }`

const newHandleExport = `  // Handle export with large-dataset job tracking and progress overlay
  const handleExport = async () => {
    const selectedCols = columns.filter((c) => c.selected)
    setInlineError(null)
    if (selectedCols.length === 0) {
      setInlineError('Please select at least one column to export.')
      return
    }
    if (!canExport) {
      if (enableScopeSelection && scopeType === 'custom') {
        setInlineError('Select at least one component or function for the custom scope (or switch to "All requirements").')
      } else {
        setInlineError('No requirements match the current scope/filters.')
      }
      return
    }

    const isLarge = exportRequirements.length >= LARGE_EXPORT_THRESHOLD
    exportAbortRef.current = false
    setIsExporting(true)
    setExportProgress(5)
    setExportProgressLabel(isLarge ? \`Preparing \${exportRequirements.length} requirements\u2026\` : 'Generating\u2026')

    let jobId = null
    if (isLarge && projectId) {
      try {
        const jobRes = await exportJobService.create(projectId, {
          format: selectedFormat,
          totalCount: exportRequirements.length,
          label: \`\${effectiveScopeLabel ?? 'All reqs'} \u2013 \${selectedFormat.toUpperCase()}\`,
        })
        if (jobRes.success && jobRes.data) {
          jobId = jobRes.data.id
          exportJobService.update(projectId, jobId, { status: 'running', progress: 10 }).catch(() => {})
        }
      } catch { /* non-critical */ }
    }

    try {
      setExportProgress(20)
      switch (selectedFormat) {
        case 'csv':
          setExportProgressLabel('Building CSV\u2026')
          exportCsv()
          break
        case 'excel':
          setExportProgressLabel('Building spreadsheet\u2026')
          exportExcel()
          break
        case 'pdf':
          setExportProgressLabel('Rendering PDF\u2026')
          setExportProgress(30)
          await exportPdf()
          break
        case 'word':
          setExportProgressLabel('Building Word document\u2026')
          setExportProgress(30)
          await exportWord()
          break
        case 'reqif':
          setExportProgressLabel('Generating ReqIF\u2026')
          await exportReqIF()
          break
      }

      setExportProgress(100)
      setExportProgressLabel('Export complete!')

      if (jobId && projectId) {
        exportJobService.update(projectId, jobId, { status: 'done', progress: 100, doneCount: exportRequirements.length }).catch(() => {})
      }

      await new Promise((r) => setTimeout(r, isLarge ? 900 : 0))
      onClose()
    } catch (error) {
      console.error('Export error:', error)
      setInlineError(error instanceof Error ? error.message : 'Failed to export. Please try again.')
      if (jobId && projectId) {
        exportJobService.update(projectId, jobId, { status: 'failed', error: error instanceof Error ? error.message : 'Export failed' }).catch(() => {})
      }
    } finally {
      setIsExporting(false)
      setExportProgress(0)
      setExportProgressLabel('')
    }
  }`

if (content.includes(oldHandleExport)) {
  content = content.replace(oldHandleExport, newHandleExport)
  console.log('PATCH 1 applied: handleExport updated')
} else {
  console.log('PATCH 1 FAILED: could not find handleExport')
  // Try normalizing - find the section and replace lines 1407-1450
  const lines = content.split('\n')
  const startIdx = lines.findIndex(l => l.trim() === '// Handle export')
  if (startIdx !== -1) {
    console.log('Found via line search at:', startIdx)
    // Find end of function
    let depth = 0
    let endIdx = startIdx
    for (let i = startIdx; i < lines.length; i++) {
      const l = lines[i]
      for (const ch of l) {
        if (ch === '{') depth++
        if (ch === '}') depth--
      }
      if (depth === 0 && i > startIdx + 2) {
        endIdx = i
        break
      }
    }
    console.log('Start:', startIdx, 'End:', endIdx)
    const removed = lines.splice(startIdx, endIdx - startIdx + 1, ...newHandleExport.split('\n'))
    content = lines.join('\n')
    console.log('PATCH 1 applied via line replacement')
  }
}

// ====== PATCH 2: Add progress overlay just before the footer </div> at end of return ======
// We'll add it inside the modal dialog just before the Footer div
const oldFooter = `        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">`

const newFooter = `        {/* Export progress overlay for large exports */}
        {isExporting && exportProgress > 0 && (
          <div className="absolute inset-0 bg-white/90 dark:bg-gray-800/90 flex flex-col items-center justify-center z-10 rounded-lg gap-4">
            <Loader2 size={32} className="text-blue-500 animate-spin" />
            <div className="w-64 space-y-2 text-center">
              <p className="text-sm font-medium text-gray-800 dark:text-white">{exportProgressLabel}</p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: \`\${exportProgress}%\` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{exportProgress}% complete</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">`

if (content.includes(oldFooter)) {
  content = content.replace(oldFooter, newFooter)
  console.log('PATCH 2 applied: progress overlay added')
} else {
  console.log('PATCH 2 FAILED: could not find Footer comment')
}

// ====== PATCH 3: Make modal container relative so overlay works ======
const oldModalDiv = `      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col"`
const newModalDiv = `      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col relative"`

if (content.includes(oldModalDiv)) {
  content = content.replace(oldModalDiv, newModalDiv)
  console.log('PATCH 3 applied: modal is relative')
} else {
  console.log('PATCH 3 FAILED: could not find modal div')
}

// ====== PATCH 4: Enhance review step - pagination + summary + validation warnings ======
const oldReviewStep = `          {currentStep === 'review' && (
            <>
          {/* Step 3: Review & export */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Summary</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
              <li>Format: {selectedFormat.toUpperCase()}</li>
              <li>Scope: {effectiveScopeLabel ?? 'All requirements'}</li>
              <li>Columns: {selectedCount} selected</li>
              <li>Parameter display: {parameterExportMode === 'name' ? 'Names' : 'Resolved values'}</li>
              <li>Glossary: {includeGlossary ? 'Yes' : 'No'}, Abbreviations: {includeAbbreviations ? 'Yes' : 'No'}</li>
            </ul>
            {selectedFormat === 'pdf' && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Long text is truncated in PDF export.</p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview</h3>
            {selectedFormat === 'reqif' ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">ReqIF export will include all requirements in scope. No row preview.</p>
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700">
                      {columns.filter((c) => c.selected).map((c) => (
                        <th key={c.key} className="px-2 py-1.5 text-left font-medium text-gray-900 dark:text-white">{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {effectiveRequirements.slice(0, 10).map((req) => (
                      <tr key={req.id} className="border-t border-gray-200 dark:border-gray-700">
                        {columns.filter((c) => c.selected).map((col) => {
                          let val = col.key === 'requirementId' ? (req.requirementId || req.id.slice(0, 8)) : (req[col.key as keyof Requirement] ?? '')
                          if (typeof val === 'string' && (col.key === 'description' || col.key === 'acceptanceCriteria')) val = stripHtml(val)
                          if (typeof val === 'string' && val.length > 80) val = val.slice(0, 80) + '\u2026'
                          return <td key={col.key} className="px-2 py-1.5 text-gray-700 dark:text-gray-300 max-w-[200px] truncate" title={String(val)}>{String(val)}</td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
            </>
          )}`

const newReviewStep = `          {currentStep === 'review' && (
            <>
          {/* Step 3: Review & export */}

          {/* Summary banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Requirements', value: exportRequirements.length },
              { label: 'Format', value: selectedFormat.toUpperCase() },
              { label: 'Columns', value: selectedCount },
              { label: 'Scope', value: effectiveScopeLabel ?? 'All' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={String(value)}>{String(value)}</p>
              </div>
            ))}
          </div>

          {/* Breakdown by status */}
          {exportRequirements.length > 0 && (() => {
            const statusMap: Record<string, number> = {}
            const priorityMap: Record<string, number> = {}
            exportRequirements.forEach(r => {
              const s = r.status || 'unknown'; statusMap[s] = (statusMap[s] || 0) + 1
              const p = String(r.priority || 'unknown').toLowerCase(); priorityMap[p] = (priorityMap[p] || 0) + 1
            })
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">By Status</p>
                  <div className="space-y-1">
                    {Object.entries(statusMap).sort((a,b) => b[1]-a[1]).slice(0,5).map(([s, n]) => (
                      <div key={s} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 dark:text-gray-300 capitalize">{s}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">By Priority</p>
                  <div className="space-y-1">
                    {['critical','high','medium','low'].filter(p => priorityMap[p]).map(p => (
                      <div key={p} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 dark:text-gray-300 capitalize">{p}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{priorityMap[p]}</span>
                      </div>
                    ))}
                    {Object.entries(priorityMap).filter(([p]) => !['critical','high','medium','low'].includes(p)).map(([p,n]) => (
                      <div key={p} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 dark:text-gray-300 capitalize">{p}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Validation warnings */}
          {(() => {
            const warnings: string[] = []
            const noTitle = exportRequirements.filter(r => !r.title?.trim()).length
            const noDesc = exportRequirements.filter(r => !r.description?.trim() || r.description.replace(/<[^>]*>/g,'').trim() === '').length
            const noOwner = exportRequirements.filter(r => !r.owner?.trim()).length
            const noStatus = exportRequirements.filter(r => !r.status?.trim()).length
            if (noTitle > 0) warnings.push(\`\${noTitle} requirement(s) have no title\`)
            if (noDesc > 0) warnings.push(\`\${noDesc} requirement(s) have no description\`)
            if (noOwner > 0) warnings.push(\`\${noOwner} requirement(s) have no owner assigned\`)
            if (noStatus > 0) warnings.push(\`\${noStatus} requirement(s) have no status set\`)
            if (exportRequirements.length >= LARGE_EXPORT_THRESHOLD) warnings.push(\`Large export (\${exportRequirements.length} reqs) – may take a few seconds\`)
            if (warnings.length === 0) return null
            return (
              <div className="border border-amber-200 dark:border-amber-700 rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Validation warnings</span>
                </div>
                <ul className="space-y-1">
                  {warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-700 dark:text-amber-300">\u2022 {w}</li>
                  ))}
                </ul>
              </div>
            )
          })()}

          {/* Paginated preview table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Preview
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 font-normal">
                  (rows {reviewPage * REVIEW_PAGE_SIZE + 1}–{Math.min((reviewPage + 1) * REVIEW_PAGE_SIZE, exportRequirements.length)} of {exportRequirements.length})
                </span>
              </h3>
              {exportRequirements.length > REVIEW_PAGE_SIZE && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setReviewPage(p => Math.max(0, p - 1))}
                    disabled={reviewPage === 0}
                    className="p-1 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-16 text-center">
                    {reviewPage + 1} / {Math.ceil(exportRequirements.length / REVIEW_PAGE_SIZE)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReviewPage(p => Math.min(Math.ceil(exportRequirements.length / REVIEW_PAGE_SIZE) - 1, p + 1))}
                    disabled={reviewPage >= Math.ceil(exportRequirements.length / REVIEW_PAGE_SIZE) - 1}
                    className="p-1 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
            {selectedFormat === 'reqif' ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">ReqIF export will include all requirements in scope. No row preview.</p>
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700">
                      {columns.filter((c) => c.selected).map((c) => (
                        <th key={c.key} className="px-2 py-1.5 text-left font-medium text-gray-900 dark:text-white whitespace-nowrap">{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {exportRequirements.slice(reviewPage * REVIEW_PAGE_SIZE, (reviewPage + 1) * REVIEW_PAGE_SIZE).map((req) => (
                      <tr key={req.id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        {columns.filter((c) => c.selected).map((col) => {
                          let val = col.key === 'requirementId' ? (req.requirementId || req.id.slice(0, 8)) : (req[col.key as keyof Requirement] ?? '')
                          if (typeof val === 'string' && (col.key === 'description' || col.key === 'acceptanceCriteria')) val = stripHtml(val)
                          if (typeof val === 'string' && val.length > 100) val = val.slice(0, 100) + '\u2026'
                          return <td key={col.key} className="px-2 py-1.5 text-gray-700 dark:text-gray-300 max-w-[200px] truncate" title={String(val)}>{String(val)}</td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
            </>
          )}`

if (content.includes(oldReviewStep)) {
  content = content.replace(oldReviewStep, newReviewStep)
  console.log('PATCH 4 applied: review step enhanced')
} else {
  console.log('PATCH 4 FAILED: could not find review step')
  const idx = content.indexOf("currentStep === 'review'")
  if (idx > -1) console.log('Found currentStep===review at', idx)
}

// ====== PATCH 5: Add JSON import/export + visibility + Scheduled exports to template section ======
// Add export JSON button and import button to manage templates section
const oldManageClose = `              <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => setIsManageTemplatesOpen(false)} className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">Done</button>
              </div>`

const newManageClose = `              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <label className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer flex items-center gap-1.5">
                    <Upload size={14} />
                    Import JSON
                    <input
                      ref={templateJsonInputRef}
                      type="file"
                      accept=".json"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file || !projectId) return
                        const reader = new FileReader()
                        reader.onload = (ev) => {
                          try {
                            const parsed = JSON.parse(ev.target?.result as string)
                            const name = (parsed.name || file.name.replace('.json','')).slice(0, 80)
                            const fmt = parsed.format || 'pdf'
                            const payload = parsed.payload ?? parsed
                            requirementExportTemplateService.create(projectId, { name, format: fmt, payload }).then(res => {
                              if (res.success && res.data) {
                                const ui = toUiTemplate(res.data)
                                setTemplates(prev => [ui, ...prev])
                                setInlineError(null)
                              } else {
                                setInlineError(res.error || 'Import failed.')
                              }
                            })
                          } catch { setInlineError('Invalid JSON file.') }
                        }
                        reader.readAsText(file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
                <button type="button" onClick={() => setIsManageTemplatesOpen(false)} className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">Done</button>
              </div>`

if (content.includes(oldManageClose)) {
  content = content.replace(oldManageClose, newManageClose)
  console.log('PATCH 5 applied: JSON import added to manage templates')
} else {
  console.log('PATCH 5 FAILED: could not find manage close button')
}

// Add JSON Export button to each template in the manage list
const oldDuplicateBtn = `                          <button
                            type="button"
                            onClick={() => {
                              const copyName = (\`Copy of \${t.name}\`).slice(0, 80)`

const newDuplicateBtn = `                          <button
                            type="button"
                            onClick={() => {
                              const jsonPayload = { name: t.name, format: t.format, payload: { columns: t.columns, sortBy: (t as any).sortBy, sortOrder: (t as any).sortOrder, scopeType: t.scopeType, selectedComponentIds: (t as any).selectedComponentIds ?? [], selectedFunctionIds: (t as any).selectedFunctionIds ?? [], exportSearch: (t as any).exportSearch ?? '', filters: (t as any).filters, includeHeader: t.includeHeader, parameterExportMode: t.parameterExportMode, includeGlossary: t.includeGlossary, includeAbbreviations: t.includeAbbreviations, glossaryShowDefinitions: t.glossaryShowDefinitions, glossarySortAlphabetically: t.glossarySortAlphabetically, sections: t.sections, documentStyle: t.documentStyle } }
                              const blob = new Blob([JSON.stringify(jsonPayload, null, 2)], { type: 'application/json' })
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a'); a.href = url; a.download = \`\${t.name.replace(/[^a-zA-Z0-9_-]/g,'_')}_export_template.json\`; a.click(); URL.revokeObjectURL(url)
                            }}
                            className="px-2 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            Export JSON
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const copyName = (\`Copy of \${t.name}\`).slice(0, 80)`

if (content.includes(oldDuplicateBtn)) {
  content = content.replace(oldDuplicateBtn, newDuplicateBtn)
  console.log('PATCH 6 applied: Export JSON button added per template')
} else {
  console.log('PATCH 6 FAILED: could not find duplicate button')
}

// ====== PATCH 7: Add visibility selector to Save template form ======
const oldSaveTemplateForm = `          {isSaveTemplateOpen && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Template name</label>
              <input
                type="text"
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                placeholder="e.g. Customer report"
                maxLength={80}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => { setIsSaveTemplateOpen(false); setSaveTemplateName('') }} className="px-3 py-2 text-sm border rounded-lg">Cancel</button>
                <button type="button" onClick={handleSaveTemplate} disabled={!saveTemplateName.trim()} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">Save</button>
              </div>
            </div>
          )}`

const newSaveTemplateForm = `          {isSaveTemplateOpen && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Template name</label>
              <input
                type="text"
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                placeholder="e.g. Customer report"
                maxLength={80}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Visibility</label>
                <div className="flex items-center gap-2">
                  {([['private', 'Private', Lock], ['project', 'This project', Building2], ['org', 'Organization', Globe]] as const).map(([val, label, Icon]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSaveTemplateVisibility(val)}
                      className={\`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors \${saveTemplateVisibility === val ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}\`}
                    >
                      <Icon size={12} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setIsSaveTemplateOpen(false); setSaveTemplateName('') }} className="px-3 py-2 text-sm border rounded-lg">Cancel</button>
                <button type="button" onClick={handleSaveTemplate} disabled={!saveTemplateName.trim()} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">Save</button>
              </div>
            </div>
          )}`

if (content.includes(oldSaveTemplateForm)) {
  content = content.replace(oldSaveTemplateForm, newSaveTemplateForm)
  console.log('PATCH 7 applied: visibility selector added to save form')
} else {
  console.log('PATCH 7 FAILED: could not find save template form')
}

// ====== PATCH 8: Add Scheduled Exports section after template list ======
const oldTemplateFooter = `            </div>
          )}
            </>
          )}

          {currentStep === 'scope' && (`

const newTemplateFooter = `            </div>

            {/* Scheduled Exports (API hooks) */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setIsScheduledExportsOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/60 text-sm hover:bg-gray-100 dark:hover:bg-gray-700/50"
              >
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-gray-500 dark:text-gray-400" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">Scheduled Exports</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">(hooks — {scheduledExports.length})</span>
                </div>
                {isScheduledExportsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {isScheduledExportsOpen && (
                <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Configure scheduled export triggers. Scheduling engine is a future feature; these entries act as configuration hooks.</p>
                  {scheduledExports.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic">No scheduled exports yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {scheduledExports.map(se => (
                        <li key={se.id} className="flex items-center justify-between gap-3 p-2 rounded-lg border border-gray-200 dark:border-gray-600">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{se.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{se.format.toUpperCase()}{se.scheduleExpr ? \` · \${se.scheduleExpr}\` : ''}</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={se.enabled}
                              onChange={(e) => {
                                const on = e.target.checked
                                scheduledExportService.update(projectId!, se.id, { enabled: on }).then(res => {
                                  if (res.success && res.data) setScheduledExports(prev => prev.map(x => x.id === se.id ? res.data! : x))
                                })
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              if (!window.confirm(\`Delete scheduled export "\${se.name}"?\`)) return
                              scheduledExportService.remove(projectId!, se.id).then(() => setScheduledExports(prev => prev.filter(x => x.id !== se.id)))
                            }}
                            className="text-xs text-red-500 hover:text-red-700 px-1"
                          >
                            \u00d7
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {isAddingSchedule ? (
                    <div className="space-y-2 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                      <input
                        type="text"
                        value={newScheduleName}
                        onChange={e => setNewScheduleName(e.target.value)}
                        placeholder="Schedule name"
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      />
                      <input
                        type="text"
                        value={newScheduleExpr}
                        onChange={e => setNewScheduleExpr(e.target.value)}
                        placeholder="Cron expression (e.g. 0 9 * * 1)"
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setIsAddingSchedule(false); setNewScheduleName(''); setNewScheduleExpr('') }} className="px-3 py-1.5 text-xs border rounded-lg">Cancel</button>
                        <button
                          type="button"
                          disabled={!newScheduleName.trim()}
                          onClick={() => {
                            scheduledExportService.create(projectId!, { name: newScheduleName, scheduleExpr: newScheduleExpr || undefined, format: selectedFormat, templateId: selectedTemplateId ?? undefined }).then(res => {
                              if (res.success && res.data) { setScheduledExports(prev => [res.data!, ...prev]); setIsAddingSchedule(false); setNewScheduleName(''); setNewScheduleExpr('') }
                              else setInlineError(res.error || 'Could not create schedule.')
                            })
                          }}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg disabled:opacity-50"
                        >
                          Create
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setIsAddingSchedule(true)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
                      + Add schedule
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
          )}
            </>
          )}

          {currentStep === 'scope' && (`

if (content.includes(oldTemplateFooter)) {
  content = content.replace(oldTemplateFooter, newTemplateFooter)
  console.log('PATCH 8 applied: Scheduled exports section added')
} else {
  console.log('PATCH 8 FAILED: could not find template footer')
  // Debug
  const idx = content.indexOf("currentStep === 'scope'")
  if (idx > -1) {
    const before = content.slice(Math.max(0,idx-200), idx)
    console.log('Before scope step:', JSON.stringify(before.slice(-100)))
  }
}

// ====== PATCH 9: Add Corporate DOCX template section to format step (Word only) ======
// Find the location just before the template section ends (after "Format" buttons section)
// We'll add it in the format step after the main format buttons, when word is selected

const oldWordFormatNote = `          {selectedFormat === 'pdf' && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Long text is truncated in PDF export.</p>
            )}`

// This is in review step already replaced. Let's find another anchor.
// Let's add Corporate DOCX and Excel mapping sections in the format step
// after the format button grid and before the templates section

const oldFormatButtons = `          </div>
          </div>
          {projectId && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Templates</h3>`

const newFormatButtons = `          </div>
          </div>

          {/* Corporate Word template upload (only for Word format) */}
          {selectedFormat === 'word' && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Corporate Word Templates</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Upload branded .docx files with {'{placeholder}'} tags.</p>
                </div>
                <label className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer flex items-center gap-1.5 shrink-0">
                  <Upload size={12} />
                  Upload .docx
                  <input
                    ref={docxFileInputRef}
                    type="file"
                    accept=".docx"
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file || !projectId) return
                      setIsUploadingDocx(true)
                      setDocxUploadError(null)
                      try {
                        const base64 = await new Promise<string>((resolve, reject) => {
                          const reader = new FileReader()
                          reader.onload = (ev) => resolve((ev.target?.result as string).split(',')[1] || '')
                          reader.onerror = reject
                          reader.readAsDataURL(file)
                        })
                        const res = await corporateDocxTemplateService.create(projectId, {
                          name: file.name.replace(/\\.docx$/i, '').slice(0, 80),
                          fileBase64: base64,
                        })
                        if (res.success && res.data) {
                          setCorporateDocxTemplates(prev => [res.data!, ...prev])
                          setSelectedCorporateDocxId(res.data!.id)
                        } else {
                          setDocxUploadError(res.error || 'Upload failed.')
                        }
                      } catch (err) {
                        setDocxUploadError('Failed to read file.')
                      } finally {
                        setIsUploadingDocx(false)
                        e.target.value = ''
                      }
                    }}
                  />
                </label>
              </div>
              <div className="p-3 space-y-2">
                {docxUploadError && <p className="text-xs text-red-500">{docxUploadError}</p>}
                {isUploadingDocx && <p className="text-xs text-blue-500 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Uploading…</p>}
                {corporateDocxTemplates.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">No corporate templates yet. Upload a branded .docx file above.</p>
                ) : (
                  <ul className="space-y-1">
                    {corporateDocxTemplates.map(t => (
                      <li key={t.id} className="flex items-center justify-between gap-3 p-2 rounded-lg border border-gray-200 dark:border-gray-600">
                        <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                          <input
                            type="radio"
                            name="corporateDocxTemplate"
                            checked={selectedCorporateDocxId === t.id}
                            onChange={() => setSelectedCorporateDocxId(t.id)}
                            className="w-3.5 h-3.5 text-blue-600 border-gray-300"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{t.name}</p>
                            {t.placeholders && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Placeholders: {t.placeholders}</p>
                            )}
                          </div>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm(\`Remove template "\${t.name}"?\`)) return
                            corporateDocxTemplateService.remove(projectId!, t.id).then(() => {
                              setCorporateDocxTemplates(prev => prev.filter(x => x.id !== t.id))
                              if (selectedCorporateDocxId === t.id) setSelectedCorporateDocxId(null)
                            })
                          }}
                          className="text-xs text-red-500 hover:text-red-700 shrink-0 px-1"
                        >
                          \u00d7
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {selectedCorporateDocxId && (
                  <button type="button" onClick={() => setSelectedCorporateDocxId(null)} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                    Clear selection (use standard export)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Excel column mapping (only for Excel format) */}
          {selectedFormat === 'excel' && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Excel Column Mappings</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Map system fields to named columns or ranges in a corporate spreadsheet.</p>
                </div>
                <button type="button" onClick={() => setIsMappingEditorOpen(v => !v)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">
                  {isMappingEditorOpen ? 'Close editor' : '+ New mapping'}
                </button>
              </div>
              <div className="p-3 space-y-2">
                {isMappingEditorOpen && (
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 space-y-2 bg-gray-50 dark:bg-gray-800/50">
                    <input
                      type="text"
                      value={newMappingName}
                      onChange={e => setNewMappingName(e.target.value)}
                      placeholder="Mapping name"
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    />
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Field mappings</p>
                      {draftMappingRows.map((row, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <select
                            value={row.systemField}
                            onChange={e => { const updated = [...draftMappingRows]; updated[i] = { ...updated[i], systemField: e.target.value }; setDraftMappingRows(updated) }}
                            className="flex-1 px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                          >
                            <option value="">— field —</option>
                            {columns.map(c => <option key={c.key} value={String(c.key)}>{c.label}</option>)}
                          </select>
                          <span className="text-xs text-gray-400">\u2192</span>
                          <input
                            type="text"
                            value={row.excelColumn}
                            onChange={e => { const updated = [...draftMappingRows]; updated[i] = { ...updated[i], excelColumn: e.target.value }; setDraftMappingRows(updated) }}
                            placeholder="Column / range"
                            className="flex-1 px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                          />
                          <button type="button" onClick={() => setDraftMappingRows(prev => prev.filter((_,j)=>j!==i))} className="text-red-400 hover:text-red-600 text-xs px-1">\u00d7</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setDraftMappingRows(prev => [...prev, { systemField: '', excelColumn: '' }])} className="text-xs text-blue-600 hover:text-blue-700">+ Add row</button>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setIsMappingEditorOpen(false); setNewMappingName(''); setDraftMappingRows([]) }} className="px-3 py-1.5 text-xs border rounded-lg">Cancel</button>
                      <button
                        type="button"
                        disabled={!newMappingName.trim() || draftMappingRows.length === 0}
                        onClick={() => {
                          excelColumnMappingService.create(projectId!, { name: newMappingName, mappings: draftMappingRows.filter(r => r.systemField && r.excelColumn) }).then(res => {
                            if (res.success && res.data) { setExcelColumnMappings(prev => [res.data!, ...prev]); setSelectedMappingId(res.data!.id); setIsMappingEditorOpen(false); setNewMappingName(''); setDraftMappingRows([]) }
                            else setInlineError(res.error || 'Could not save mapping.')
                          })
                        }}
                        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg disabled:opacity-50"
                      >
                        Save mapping
                      </button>
                    </div>
                  </div>
                )}
                {excelColumnMappings.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">No mappings yet. Standard column export will be used.</p>
                ) : (
                  <ul className="space-y-1">
                    {excelColumnMappings.map(m => (
                      <li key={m.id} className="flex items-center justify-between gap-3 p-2 rounded-lg border border-gray-200 dark:border-gray-600">
                        <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                          <input
                            type="radio"
                            name="excelMapping"
                            checked={selectedMappingId === m.id}
                            onChange={() => setSelectedMappingId(m.id)}
                            className="w-3.5 h-3.5 text-blue-600 border-gray-300"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{m.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{m.mappings.length} field(s) mapped</p>
                          </div>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm(\`Delete mapping "\${m.name}"?\`)) return
                            excelColumnMappingService.remove(projectId!, m.id).then(() => {
                              setExcelColumnMappings(prev => prev.filter(x => x.id !== m.id))
                              if (selectedMappingId === m.id) setSelectedMappingId(null)
                            })
                          }}
                          className="text-xs text-red-500 hover:text-red-700 px-1 shrink-0"
                        >
                          \u00d7
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {selectedMappingId && (
                  <button type="button" onClick={() => setSelectedMappingId(null)} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                    Clear selection (use default columns)
                  </button>
                )}
              </div>
            </div>
          )}

          {projectId && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Templates</h3>`

if (content.includes(oldFormatButtons)) {
  content = content.replace(oldFormatButtons, newFormatButtons)
  console.log('PATCH 9 applied: Corporate DOCX and Excel mapping sections added')
} else {
  console.log('PATCH 9 FAILED: could not find format buttons anchor')
  const idx = content.indexOf("Save and reuse export")
  if (idx > -1) console.log('Found "Save and reuse export" at', idx)
  const idx2 = content.indexOf('<h3 className="text-sm font-semibold text-gray-900')
  if (idx2 > -1) console.log('Found Templates h3 at', idx2, JSON.stringify(content.slice(idx2-100, idx2+50)))
}

fs.writeFileSync(path, content, 'utf8')
console.log('File written successfully')
