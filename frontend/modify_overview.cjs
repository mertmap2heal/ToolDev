const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src', 'components', 'requirements');
const editModalPath = path.join(srcDir, 'EditRequirementModal.tsx');
let editContent = fs.readFileSync(editModalPath, 'utf-8');

// The replacement KPP content (copied from CreateRequirementModal.tsx)
const kppContent = `                  {/* KPPs Section (Premium) */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Activity size={16} className="text-blue-500" />
                      Key Performance Parameters (KPP)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 text-left uppercase">
                          Threshold Value
                        </label>
                        <input
                          type="text"
                          value={thresholdValue}
                          onChange={(e) => setThresholdValue(e.target.value)}
                          placeholder="Minimum acceptable"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 text-left uppercase">
                          Objective Value
                        </label>
                        <input
                          type="text"
                          value={objectiveValue}
                          onChange={(e) => setObjectiveValue(e.target.value)}
                          placeholder="Desired target"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-left">
                      Define quantitative performance targets for verification.
                    </p>
                  </div>`;

// Find the precise start and end index instead of regex to be safe
const startStr = '{/* Derived Requirement Flag (DO-178C §6.3.4) */}';
const startIndex = editContent.indexOf(startStr);

if (startIndex > -1) {
    // Find the end </div> of this block
    // We know it ends before "} \n </div> \n )} \n {/* Traceability Tab"
    // So let's just find the next } )} \n </div> \n )}

    // We can find where the next block or active tab ends.
    // The "general" tab ends shortly after this. Let's find "</div> \n             )} \n\n             {/* ════════════"
    const generalEndIndex = editContent.indexOf(')}', startIndex);
    // Actually the block is:
    //                   </div>
    //                 )}
    //               </div>
    //             </div>
    //           )}

    // Look for the end of the derived requirement logic
    const derivationRationaleText = 'value={derivationRationale}';
    const derivationIndex = editContent.indexOf(derivationRationaleText, startIndex);
    if (derivationIndex > -1) {
        let endIndex = editContent.indexOf('</div>', derivationIndex);
        endIndex = editContent.indexOf('</div>', endIndex + 6); // second </div> closes the checkbox block
        if (endIndex > -1) {
            editContent = editContent.slice(0, startIndex) + kppContent + editContent.slice(endIndex + 6);
            fs.writeFileSync(editModalPath, editContent);
            console.log("Successfully replaced internal duplicate Derived Requirement Flag with KPP section.");
            process.exit(0);
        }
    }
}
console.log("Failed to find boundaries.");
