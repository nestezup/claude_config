import React, { useState, useEffect, useCallback } from 'react';
import { writeTextFile, readTextFile, exists, createDir } from '@tauri-apps/api/fs';
import { resourceDir, join } from '@tauri-apps/api/path';
import { open, message, save } from '@tauri-apps/api/dialog';
import './styles.css';

// --- Target Claude config file path (Hardcoded for now) ---
const TARGET_CLAUDE_CONFIG_PATH = "/Users/python/Library/Application Support/claude/claude_desktop_config.json";
// ---------------------------------------------------------

// --- Editor Settings Logic ---
interface EditorSettings {
  targetPath: string | null;
}
const EDITOR_SETTINGS_FILENAME = 'editor_settings.json';
// ---------------------------

// Bring back interfaces for preset structure
interface ConfigValue {
  [key: string]: any;
}
interface ConfigStore {
  [key: string]: ConfigValue;
}

function App() {
  // Reinstate preset-related state
  const [configStore, setConfigStore] = useState<ConfigStore>({}); // Holds the presets
  const [selectedKey, setSelectedKey] = useState<string | null>(null); // Selected preset key
  const [jsonValue, setJsonValue] = useState<string>(''); // Editor content for selected preset
  const [editingKey, setEditingKey] = useState<string | null>(null); // For renaming keys
  const [tempKeyName, setTempKeyName] = useState<string>(''); // Temp storage for renaming
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSavingTarget, setIsSavingTarget] = useState<boolean>(false); // Saving state for target file

  // --- NEW State for the actual target Claude config file path ---
  const [actualClaudeConfigPath, setActualClaudeConfigPath] = useState<string | null>(null);
  // -------------------------------------------------------------

  // --- Utility: Get editor settings file path ---
  const getEditorSettingsPath = async (): Promise<string> => {
    const resDir = await resourceDir();
    return await join(resDir, EDITOR_SETTINGS_FILENAME);
  };
  // -----------------------------------------------

  // --- Keep file existence check utility ---
  async function existsFile(path: string): Promise<boolean> {
    try {
      return await exists(path);
    } catch (error) {
      console.error("Error checking file existence:", error);
      return false;
    }
  }

  // --- Reinstate initial PRESET loading from internal app_config.json ---
  const getPresetFilePath = async (): Promise<string> => {
    const resDir = await resourceDir();
    return await join(resDir, 'app_config.json'); // Presets stored here
  };

  // --- Initial Loading: Load Presets AND Editor Settings ---
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      setError(null);
      let loadedTargetPath: string | null = null;

      // 1. Load Editor Settings (to get target path)
      try {
        const settingsPath = await getEditorSettingsPath();
        console.log('Attempting to load editor settings from:', settingsPath);
        if (await existsFile(settingsPath)) {
          const settingsContent = await readTextFile(settingsPath);
          const parsedSettings: EditorSettings = JSON.parse(settingsContent);
          if (parsedSettings.targetPath) {
            loadedTargetPath = parsedSettings.targetPath;
            setActualClaudeConfigPath(loadedTargetPath);
            console.log('Loaded target path from settings:', loadedTargetPath);
          } else {
            console.log('Editor settings found, but no targetPath saved.');
          }
        } else {
          console.log('Editor settings file not found.');
        }
      } catch (e) {
        console.error('Failed to load or parse editor settings:', e);
        // Don't set error state here, just proceed without target path
      }

      // 2. Load Presets (from internal app_config.json)
      try {
        const presetsPath = await getPresetFilePath();
        console.log('Attempting to load presets from:', presetsPath);
        if (await existsFile(presetsPath)) {
          const presetsContent = await readTextFile(presetsPath);
          const parsedPresets = JSON.parse(presetsContent);
          setConfigStore(parsedPresets);
          console.log('Presets loaded successfully.');
          // Select first preset if none is selected and presets exist
          if (!selectedKey && Object.keys(parsedPresets).length > 0) {
            const firstKey = Object.keys(parsedPresets)[0];
            setSelectedKey(firstKey);
            setJsonValue(JSON.stringify(parsedPresets[firstKey] ?? {}, null, 2));
          }
        } else {
          console.log('Preset file not found. Starting empty.');
          setConfigStore({});
        }
      } catch (e) {
        console.error('ERROR loading presets:', e);
        setError(`Failed to load presets: ${e instanceof Error ? e.message : e}`);
        setConfigStore({}); // Reset presets on error
      }

      setIsLoading(false);
    };
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // --- Reinstate auto-saving of PRESETS to internal app_config.json ---
  // (User might want to remove this later if presets shouldn't auto-save)
  useEffect(() => {
    if (isLoading || Object.keys(configStore).length === 0) return; // Don't save during load or if empty

    const savePresets = async () => {
      try {
        const configPath = await getPresetFilePath();
        const configDirPath = await resourceDir();
        console.log('Attempting to auto-save presets to:', configPath);
        if (!(await exists(configDirPath))) {
          await createDir(configDirPath, { recursive: true });
          console.log('Resource directory created:', configDirPath);
        }
        await writeTextFile(configPath, JSON.stringify(configStore, null, 2));
        console.log('Presets auto-saved successfully:', configPath);
      } catch (e) {
        console.warn('Presets auto-save failed:', e);
      }
    };
    // Debounce saving maybe? For now, save directly.
    savePresets();
  }, [configStore, isLoading]);

  // --- Reinstate PRESET management functions ---
  const addNewKey = () => {
    let baseName = "NewPreset";
    let newKey = baseName;
    let counter = 1;
    while (configStore[newKey] !== undefined) {
      newKey = `${baseName}_${counter++}`;
    }
    const newPresetValue = {}; // Start with empty object
    const updatedStore = { ...configStore, [newKey]: newPresetValue };
    setConfigStore(updatedStore);
    setSelectedKey(newKey);
    setJsonValue(JSON.stringify(newPresetValue, null, 2));
    setEditingKey(newKey); // Immediately edit name
  };

  const deleteKey = (keyToDelete: string) => {
    if (confirm(`Are you sure you want to delete the preset "${keyToDelete}"?`)) {
      // Use functional update for safety
      setConfigStore(currentStore => {
        const { [keyToDelete]: _, ...newStore } = currentStore;
        return newStore;
      });
      if (selectedKey === keyToDelete) {
        setSelectedKey(null);
        setJsonValue('');
      }
    }
  };

  const handleKeySelect = (key: string) => {
    setSelectedKey(key);
    try {
      const currentValue = configStore[key] ?? {};
      setJsonValue(JSON.stringify(currentValue, null, 2));
    } catch (e) {
      console.error('Error stringifying selected key value:', e);
      setJsonValue('{}'); // Fallback
    }
    setEditingKey(null);
  };

  const handleKeyDoubleClick = (key: string) => {
    setTempKeyName(key); // Store original name for editing
    setEditingKey(key);
  };

  const handleKeyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempKeyName(e.target.value);
  };

  const handleKeyNameBlur = (oldKey: string) => {
    const newKey = tempKeyName.trim();
    setEditingKey(null);

    if (!newKey || newKey === oldKey) {
      setTempKeyName(''); // Reset temp name
      return; // No change or empty name
    }

    if (configStore[newKey] !== undefined) {
      alert(`Preset key "${newKey}" already exists.`);
      setTempKeyName(''); // Reset temp name
      return;
    }

    // Update the key in configStore
    setConfigStore(currentStore => {
      const { [oldKey]: value, ...rest } = currentStore;
      return { ...rest, [newKey]: value };
    });

    // If the selected key was the one renamed, update selectedKey
    if (selectedKey === oldKey) {
      setSelectedKey(newKey);
    }
    setTempKeyName(''); // Reset temp name
  };

  // --- JSON editor change handler ---
  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonValue(e.target.value);
    // Changes are applied to memory via 'Apply Changes' button
  };

  // --- Apply editor changes to the selected PRESET in memory ---
  const applyJsonChanges = () => {
    if (!selectedKey) return;
    try {
      const parsed = JSON.parse(jsonValue);
      setConfigStore(prevStore => ({
        ...prevStore,
        [selectedKey]: parsed
      }));
      console.log(`Preset '${selectedKey}' updated in memory.`);
      alert(`Changes applied to preset '${selectedKey}' in memory.`);
    } catch (e) {
      console.error('Invalid JSON in editor:', e);
      alert(`Invalid JSON: ${e instanceof Error ? e.message : e}`);
    }
  };

  // --- Export/Import PRESET Set functions (similar to previous state) ---
  const exportPresets = async () => {
    try {
      let filePath = await save({
        title: "Export Presets As",
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: 'presets_export.json'
      });
      if (filePath) {
        if (!filePath.toLowerCase().endsWith('.json')) {
          filePath = `${filePath}.json`;
        }
        await writeTextFile(filePath, JSON.stringify(configStore, null, 2));
        alert('Presets exported successfully!');
      } else {
        console.log('Preset export cancelled.');
      }
    } catch (err) {
      console.error('Failed to export presets:', err);
      setError(`Export failed: ${err instanceof Error ? err.message : err}`);
    }
  };

  const importPresets = async () => {
    try {
      const selected = await open({
        title: "Import Presets From File",
        filters: [{ name: 'JSON', extensions: ['json'] }],
        multiple: false
      });
      if (selected && typeof selected === 'string') {
        const content = await readTextFile(selected);
        const parsed = JSON.parse(content);
        // Basic validation: check if it's an object
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          setConfigStore(parsed); // Overwrite existing presets
          // Reset selection
          setSelectedKey(null);
          setJsonValue('');
          // Select first key if available
          if (Object.keys(parsed).length > 0) {
             const firstKey = Object.keys(parsed)[0];
             setSelectedKey(firstKey);
             setJsonValue(JSON.stringify(parsed[firstKey] ?? {}, null, 2));
          }
          alert('Presets imported successfully! Existing presets were overwritten.');
        } else {
          throw new Error('Imported file does not contain a valid preset object.');
        }
      } else {
        console.log('Preset import cancelled.');
      }
    } catch (err) {
      console.error('Failed to import presets:', err);
      setError(`Import failed: ${err instanceof Error ? err.message : err}`);
      alert(`Import failed: ${err instanceof Error ? err.message : err}`);
    }
  };

  // --- Add Preset From JSON File function (restore/add) ---
  const addPresetFromJsonFile = async () => {
    setError(null);
    try {
      const selected = await open({
        title: "Add Preset From JSON File",
        filters: [{ name: 'JSON', extensions: ['json'] }],
        multiple: false
      });
      if (selected && typeof selected === 'string') {
        const content = await readTextFile(selected);
        const parsed = JSON.parse(content);
        // Basic validation
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('Selected file does not contain a valid JSON object.');
        }
        // Generate key from filename (similar to previous logic)
        const pathParts = selected.split(/[\/]/);
        const filename = pathParts.pop()?.replace(/\.json$/i, '') || 'newPreset';
        let keyName = filename;
        let counter = 1;
        while (configStore[keyName] !== undefined) {
          keyName = `${filename}_${counter++}`;
        }
        // Add to store
        setConfigStore(prevStore => ({ ...prevStore, [keyName]: parsed }));
        setSelectedKey(keyName); // Select the newly added preset
        setJsonValue(JSON.stringify(parsed, null, 2));
        alert(`Preset "${keyName}" added successfully!`);
      }
    } catch (err) {
      console.error('Failed to add preset from file:', err);
      setError(`Add failed: ${err instanceof Error ? err.message : err}`);
      alert(`Failed to add preset: ${err instanceof Error ? err.message : err}`);
    }
  };

  // --- Select and SET Target Claude Path (Save path to settings file) ---
  const selectAndSetActualClaudePath = async () => {
    setError(null);
    try {
      const selected = await open({
        title: "Select Target Claude Desktop Configuration File",
        filters: [{ name: 'JSON', extensions: ['json'] }],
        multiple: false
      });
      if (selected && typeof selected === 'string') {
        console.log('User set target Claude config path:', selected);
        setActualClaudeConfigPath(selected); // Update state

        // --- Save the selected path to editor_settings.json ---
        try {
          const settingsPath = await getEditorSettingsPath();
          const newSettings: EditorSettings = { targetPath: selected };
          // Ensure resource directory exists
          const resDir = await resourceDir();
          if (!(await exists(resDir))) {
            await createDir(resDir, { recursive: true });
          }
          await writeTextFile(settingsPath, JSON.stringify(newSettings, null, 2));
          console.log('Target path saved to editor settings file.');
          alert('Target Claude config file path set and saved!');
        } catch (saveError) {
          console.error('Failed to save target path to settings file:', saveError);
          setError(`Failed to save target path setting: ${saveError instanceof Error ? saveError.message : saveError}`);
          // Keep the path in state even if saving fails, but notify user?
        }
        // ------------------------------------------------------

      } else {
        console.log('Target path selection cancelled.');
      }
    } catch (err) {
      console.error('Error selecting target file:', err);
      setError(`Error selecting target file: ${err instanceof Error ? err.message : err}`);
    }
  };

  // --- Apply Selected Preset to TARGET Claude config file ---
  const applySelectedPresetToClaude = async () => {
    // --- Check if target path is set ---
    if (!actualClaudeConfigPath) {
      alert('Error: Target Claude config file path is not set. Please set it using the button in the header.');
      setError('Target path not set.');
      return;
    }
    // ------------------------------------
    if (!selectedKey || configStore[selectedKey] === undefined) {
      alert('Please select a valid preset to apply.');
      return;
    }

    setIsSavingTarget(true);
    setError(null);
    try {
      const presetContent = configStore[selectedKey];
      // --- Use the state variable for the path ---
      console.log(`Attempting to apply preset '${selectedKey}' to target: ${actualClaudeConfigPath}`);
      await writeTextFile(actualClaudeConfigPath, JSON.stringify(presetContent, null, 2));
      // -------------------------------------------
      console.log('Successfully applied preset to target Claude config file.');
      alert(`Preset '${selectedKey}' successfully applied to: ${actualClaudeConfigPath}`);
    } catch (err) {
      console.error('ERROR applying preset to target file:', err);
      setError(`Failed to apply preset to Claude config: ${err instanceof Error ? err.message : err}`);
      alert(`Error applying preset: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsSavingTarget(false);
    }
  };

  // --- JSX - Reverted to Preset Manager layout ---
  return (
    <div className="container">
      <header>
        <h1>Claude Config Preset Editor</h1> {/* Title reverted */}
        {/* --- Area to display and set target path --- */}
        <div className="target-path-controls">
          <span>Target Claude File: </span>
          <span className="target-path-display">{actualClaudeConfigPath ? actualClaudeConfigPath : "Not Set"}</span>
          <button onClick={selectAndSetActualClaudePath} disabled={isLoading}>Set Target File</button>
        </div>
        {/* ------------------------------------------- */}
        <div className="set-controls"> {/* Grouped preset management buttons */}
          <button onClick={importPresets} disabled={isLoading}>Import Presets</button>
          <button onClick={exportPresets} disabled={isLoading}>Export Presets</button>
          <button onClick={addPresetFromJsonFile} disabled={isLoading}>Add Preset from File</button>
        </div>
        {isLoading && <div className="loading-indicator">Loading Presets...</div>}
        {error && <div className="error-indicator">Error: {error}</div>}
      </header>

      <main>
        {!isLoading ? (
          <div className="editor-layout"> {/* Keep two-panel layout */}
            <div className="keys-panel"> {/* Preset list panel */}
              <div className="keys-list">
                {Object.keys(configStore).map(key => (
                  <div
                    key={key}
                    className={`key-item ${selectedKey === key ? 'selected' : ''}`}
                    onClick={() => handleKeySelect(key)}
                  >
                    {editingKey === key ? (
                      <input
                        type="text"
                        value={tempKeyName}
                        onChange={handleKeyNameChange}
                        onBlur={() => handleKeyNameBlur(key)}
                        onKeyDown={e => { if (e.key === 'Enter') handleKeyNameBlur(key); }}
                        onClick={e => e.stopPropagation()} // Prevent item selection when clicking input
                        autoFocus
                      />
                    ) : (
                      <span
                        className="key-name"
                        onDoubleClick={() => handleKeyDoubleClick(key)}
                      >
                        {key}
                      </span>
                    )}
                    <button
                      className="delete-key"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent item selection
                        deleteKey(key);
                      }}
                      title="Delete preset"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button className="add-key" onClick={addNewKey}>+ Add Preset</button>
            </div>

            <div className="json-panel"> {/* Preset editor panel */}
              {selectedKey ? (
                <>
                  <div className="json-header"><h3>{selectedKey}</h3></div>
                  <textarea
                    className="json-editor"
                    value={jsonValue}
                    onChange={handleJsonChange}
                    placeholder={`Edit JSON for preset '${selectedKey}'...`}
                    disabled={isLoading}
                    spellCheck={false}
                  />
                  <button
                    className="apply-button"
                    onClick={applyJsonChanges}
                    disabled={isLoading}
                    title="Apply changes to this preset in memory (will auto-save)"
                  >
                    ✔ Apply Changes to Preset
                  </button>
                  {/* --- NEW Apply to Claude Button --- */}
                  <button
                    className="apply-to-target-button"
                    onClick={applySelectedPresetToClaude}
                    disabled={isLoading || isSavingTarget || !selectedKey || !actualClaudeConfigPath}
                    title={actualClaudeConfigPath ? `Apply the content of '${selectedKey}' preset to ${actualClaudeConfigPath}` : 'Set target Claude config file first'}
                    style={{ backgroundColor: '#ff9800', marginTop: '0.5rem' }}
                  >
                    {isSavingTarget ? 'Applying...' : 'Apply Preset to Claude Config'}
                  </button>
                  {/* ------------------------------- */}
                </>
              ) : (
                <div className="no-selection">
                  {Object.keys(configStore).length > 0 ? 'Select a preset to view/edit' : 'No presets loaded. Import or add a new preset.'}
                </div>
              )}
            </div>
          </div>
        ) : null /* Show nothing during initial load, handled by header indicator */}
      </main>
      {/* Revert styles slightly or use existing ones */} 
      <style>{`
        /* Basic styles - adjust as needed */
        .container { height: 100vh; display: flex; flex-direction: column; font-family: sans-serif; }
        header { padding: 1rem; background-color: #f0f0f0; border-bottom: 1px solid #ccc; }
        header h1 { margin: 0 0 0.5rem 0; }
        .set-controls { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
        .loading-indicator, .error-indicator { margin-top: 0.5rem; font-style: italic; }
        .error-indicator { color: red; }
        main { flex: 1; display: flex; overflow: hidden; }
        .editor-layout { display: flex; width: 100%; height: 100%; }
        .keys-panel { width: 250px; border-right: 1px solid #ccc; display: flex; flex-direction: column; background-color: #f9f9f9; }
        .keys-list { flex: 1; overflow-y: auto; padding: 0.5rem; }
        .key-item { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.5rem; margin-bottom: 0.25rem; border-radius: 3px; cursor: pointer; border: 1px solid transparent; }
        .key-item:hover { background-color: #eef; }
        .key-item.selected { background-color: #dde; border-color: #aac; }
        .key-name { flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .key-item input[type="text"] { flex-grow: 1; border: 1px solid #99f; padding: 0.2rem; }
        .delete-key { background: none; border: none; color: #f66; cursor: pointer; font-size: 1.1em; padding: 0 0.3em; visibility: hidden; }
        .key-item:hover .delete-key, .key-item.selected .delete-key { visibility: visible; }
        .delete-key:hover { color: #f00; }
        .add-key { display: block; width: calc(100% - 1rem); margin: 0.5rem; padding: 0.7rem; text-align: center; background-color: #e0e0e0; border: 1px solid #ccc; border-radius: 3px; cursor: pointer; }
        .add-key:hover { background-color: #d5d5d5; }
        .json-panel { flex: 1; display: flex; flex-direction: column; padding: 0.5rem; }
        .json-header { margin-bottom: 0.5rem; }
        .json-header h3 { margin: 0; }
        .json-editor { flex: 1; font-family: monospace; font-size: 14px; border: 1px solid #ccc; padding: 0.5rem; resize: none; }
        .apply-button { margin-top: 0.5rem; background-color: #4CAF50; padding: 0.6rem 1.2rem; align-self: flex-end; }
        .apply-button:hover { background-color: #388e3c; }
        .no-selection { display: flex; align-items: center; justify-content: center; height: 100%; color: #666; }
        button { padding: 0.5rem 1rem; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem; }
        button:disabled { background-color: #bbdefb; cursor: not-allowed; }
        .target-path-controls {
           margin-bottom: 0.75rem; 
           padding: 0.5rem; 
           background-color: #eee;
           border-radius: 4px; 
           display: flex; 
           align-items: center; 
           gap: 0.75rem;
        }
        .target-path-display {
           font-family: monospace; 
           font-size: 0.9em; 
           color: #333; 
           background-color: #fff; 
           padding: 0.2rem 0.5rem; 
           border: 1px solid #ccc;
           border-radius: 3px;
           flex-grow: 1; /* Take available space */
           overflow: hidden;
           text-overflow: ellipsis;
           white-space: nowrap;
        }
        .apply-to-target-button {
             /* Add specific styles or inherit from button */
             padding: 0.6rem 1.2rem;
             color: white;
             border: none;
             border-radius: 4px;
             cursor: pointer;
             font-size: 0.9rem; 
             align-self: flex-end; /* Align with Apply Changes */
        }
        .apply-to-target-button:disabled { background-color: #ffcc80; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

export default App;