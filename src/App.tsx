import React, { useState, useEffect } from 'react';
import { writeTextFile, readTextFile, exists, createDir } from '@tauri-apps/api/fs';
import { resourceDir, join } from '@tauri-apps/api/path';
import { open, save } from '@tauri-apps/api/dialog';
import './styles.css';

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
  // State to track which preset key is pending delete confirmation
  const [keyToDeleteConfirm, setKeyToDeleteConfirm] = useState<string | null>(null);

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
      console.error("파일 존재 여부 확인 오류:", error); // Korean Log
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
        console.log('에디터 설정 로딩 시도:', settingsPath); // Korean Log
        if (await existsFile(settingsPath)) {
          const settingsContent = await readTextFile(settingsPath);
          const parsedSettings: EditorSettings = JSON.parse(settingsContent);
          if (parsedSettings.targetPath) {
            loadedTargetPath = parsedSettings.targetPath;
            setActualClaudeConfigPath(loadedTargetPath);
            console.log('설정에서 타겟 경로 로드:', loadedTargetPath); // Korean Log
          } else {
            console.log('에디터 설정은 찾았지만 저장된 targetPath가 없습니다.'); // Korean Log
          }
        } else {
          console.log('에디터 설정 파일을 찾을 수 없습니다.'); // Korean Log
        }
      } catch (e) {
        console.error('에디터 설정 로드 또는 파싱 실패:', e); // Korean Log
        // Don't set error state here, just proceed without target path
      }

      // 2. Load Presets (from internal app_config.json)
      try {
        const presetsPath = await getPresetFilePath();
        console.log('프리셋 로딩 시도:', presetsPath); // Korean Log
        if (await existsFile(presetsPath)) {
          const presetsContent = await readTextFile(presetsPath);
          const parsedPresets = JSON.parse(presetsContent);
          setConfigStore(parsedPresets);
          console.log('프리셋 로딩 성공.'); // Korean Log
          // Select first preset if none is selected and presets exist
          if (!selectedKey && Object.keys(parsedPresets).length > 0) {
            const firstKey = Object.keys(parsedPresets)[0];
            setSelectedKey(firstKey);
            setJsonValue(JSON.stringify(parsedPresets[firstKey] ?? {}, null, 2));
          }
        } else {
          console.log('프리셋 파일을 찾을 수 없습니다. 비어있는 상태로 시작합니다.'); // Korean Log
          setConfigStore({});
        }
      } catch (e) {
        console.error('프리셋 로딩 오류:', e); // Korean Log
        setError(`프리셋 로딩 실패: ${e instanceof Error ? e.message : String(e)}`); // Korean Error
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
        console.log('프리셋 자동 저장 시도:', configPath); // Korean Log
        if (!(await exists(configDirPath))) {
          await createDir(configDirPath, { recursive: true });
          console.log('리소스 디렉토리 생성:', configDirPath); // Korean Log
        }
        await writeTextFile(configPath, JSON.stringify(configStore, null, 2));
        console.log('프리셋 자동 저장 성공:', configPath); // Korean Log
      } catch (e) {
        console.warn('프리셋 자동 저장 실패:', e); // Korean Log
      }
    };
    // Debounce saving maybe? For now, save directly.
    savePresets();
  }, [configStore, isLoading]);

  // --- Reinstate PRESET management functions ---
  const addNewKey = () => {
    let baseName = "새 프리셋"; // Korean Default Name
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

  // Modified deleteKey: Now just sets the key pending confirmation
  const deleteKey = (keyToConfirm: string) => {
    setKeyToDeleteConfirm(keyToConfirm);
  };

  // New function: Actually perform the deletion
  const confirmDelete = (keyToDelete: string) => {
    // Use functional update for safety
    setConfigStore(currentStore => {
      const { [keyToDelete]: _, ...newStore } = currentStore;
      return newStore;
    });
    // Also reset selection if the deleted item was selected
    if (selectedKey === keyToDelete) {
      setSelectedKey(null);
      setJsonValue('');
    }
    setKeyToDeleteConfirm(null); // Exit confirmation mode
  };

  // New function: Cancel the deletion confirmation
  const cancelDelete = () => {
    setKeyToDeleteConfirm(null); // Exit confirmation mode
  };

  const handleKeySelect = (key: string) => {
    setSelectedKey(key);
    try {
      const currentValue = configStore[key] ?? {};
      setJsonValue(JSON.stringify(currentValue, null, 2));
    } catch (e) {
      console.error('선택된 키 값 문자열 변환 오류:', e); // Korean Log
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
      alert(`프리셋 이름 "${newKey}"이(가) 이미 존재합니다.`); // Korean Alert
      setTempKeyName(''); // Reset temp name
      return;
    }

    // Update the key in configStore
    setConfigStore(currentStore => {
      const { [oldKey]: value, ...rest } = currentStore;
      // Recreate the object preserving order (simple approach)
      const entries = Object.entries(rest);
      const index = Object.keys(currentStore).indexOf(oldKey);
      entries.splice(index, 0, [newKey, value]);
      return Object.fromEntries(entries);
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
      console.log(`프리셋 '${selectedKey}' 메모리에서 업데이트됨.`); // Korean Log
      alert(`프리셋 '${selectedKey}' 변경사항이 메모리에 적용되었습니다.`); // Korean Alert
    } catch (e) {
      console.error('에디터에 잘못된 JSON:', e); // Korean Log
      alert(`잘못된 JSON: ${e instanceof Error ? e.message : String(e)}`); // Korean Alert
    }
  };

  // --- Export/Import PRESET Set functions (similar to previous state) ---
  const exportPresets = async () => {
    try {
      let filePath = await save({
        title: "프리셋 내보내기", // Korean Title
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: 'presets_export.json'
      });
      if (filePath) {
        if (!filePath.toLowerCase().endsWith('.json')) {
          filePath = `${filePath}.json`;
        }
        await writeTextFile(filePath, JSON.stringify(configStore, null, 2));
        alert('프리셋을 성공적으로 내보냈습니다!'); // Korean Alert
      } else {
        console.log('프리셋 내보내기 취소됨.'); // Korean Log
      }
    } catch (err) {
      console.error('프리셋 내보내기 실패:', err); // Korean Log
      setError(`내보내기 실패: ${err instanceof Error ? err.message : String(err)}`); // Korean Error
      alert(`내보내기 실패: ${err instanceof Error ? err.message : String(err)}`); // Korean Alert
    }
  };

  const importPresets = async () => {
    try {
      const selectedPath = await open({
        title: "프리셋 가져오기", // Korean Title
        filters: [{ name: 'JSON', extensions: ['json'] }],
        multiple: false
      });
      if (selectedPath && typeof selectedPath === 'string') {
        const content = await readTextFile(selectedPath);
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
          alert('프리셋을 성공적으로 가져왔습니다! 기존 프리셋을 덮어썼습니다.'); // Korean Alert
        } else {
          throw new Error('가져온 파일에 유효한 프리셋 객체가 없습니다.'); // Korean Error
        }
      } else {
        console.log('프리셋 가져오기 취소됨.'); // Korean Log
      }
    } catch (err) {
      console.error('프리셋 가져오기 실패:', err); // Korean Log
      setError(`가져오기 실패: ${err instanceof Error ? err.message : String(err)}`); // Korean Error
      alert(`가져오기 실패: ${err instanceof Error ? err.message : String(err)}`); // Korean Alert
    }
  };

  // --- Add Preset From JSON File function (restore/add) ---
  const addPresetFromJsonFile = async () => {
    setError(null);
    try {
      const selectedPath = await open({
        title: "파일에서 프리셋 추가", // Korean Title
        filters: [{ name: 'JSON', extensions: ['json'] }],
        multiple: false
      });
      if (selectedPath && typeof selectedPath === 'string') {
        const content = await readTextFile(selectedPath);
        const parsed = JSON.parse(content);
        // Basic validation
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('선택한 파일에 유효한 JSON 객체가 없습니다.'); // Korean Error
        }
        // Generate key from filename (similar to previous logic)
        const pathParts = selectedPath.split(/[\/\\]/); // Handle both / and \\ separators
        const filenameWithExt = pathParts.pop() || '새 프리셋';
        const filename = filenameWithExt.replace(/\.json$/i, '');
        let keyName = filename;
        let counter = 1;
        while (configStore[keyName] !== undefined) {
          keyName = `${filename}_${counter++}`;
        }
        // Add to store
        setConfigStore(prevStore => ({ ...prevStore, [keyName]: parsed }));
        setSelectedKey(keyName); // Select the newly added preset
        setJsonValue(JSON.stringify(parsed, null, 2));
        alert(`프리셋 "${keyName}"을(를) 성공적으로 추가했습니다!`); // Korean Alert
      }
    } catch (err) {
      console.error('파일에서 프리셋 추가 실패:', err); // Korean Log
      setError(`추가 실패: ${err instanceof Error ? err.message : String(err)}`); // Korean Error
      alert(`프리셋 추가 실패: ${err instanceof Error ? err.message : String(err)}`); // Korean Alert
    }
  };


  // --- Select and SET Target Claude Path (Save path to settings file) ---
  const selectAndSetActualClaudePath = async () => {
    setError(null);
    try {
      const selectedPath = await open({
        title: "클로드 Config 파일 선택", // Korean Title
        filters: [{ name: 'JSON', extensions: ['json'] }],
        multiple: false
      });
      if (selectedPath && typeof selectedPath === 'string') {
        console.log('사용자가 타겟 클로드 Config 경로 설정:', selectedPath); // Korean Log
        setActualClaudeConfigPath(selectedPath); // Update state

        // --- Save the selected path to editor_settings.json ---
        try {
          const settingsPath = await getEditorSettingsPath();
          const newSettings: EditorSettings = { targetPath: selectedPath };
          // Ensure resource directory exists
          const resDir = await resourceDir();
          if (!(await exists(resDir))) {
            await createDir(resDir, { recursive: true });
          }
          await writeTextFile(settingsPath, JSON.stringify(newSettings, null, 2));
          console.log('타겟 경로를 에디터 설정 파일에 저장함.'); // Korean Log - Note: This log doesn't contain Config
          alert('클로드 Config 파일 경로가 설정 및 저장되었습니다!'); // Korean Alert
        } catch (saveError) {
          console.error('설정 파일에 타겟 경로 저장 실패:', saveError); // Korean Log
          setError(`타겟 경로 설정 저장 실패: ${saveError instanceof Error ? saveError.message : String(saveError)}`); // Korean Error - Note: This log doesn't contain Config
          // Keep the path in state even if saving fails, but notify user?
          alert(`타겟 경로를 설정했지만, 설정을 저장하는 데 실패했습니다: ${saveError instanceof Error ? saveError.message : String(saveError)}`); // Korean Alert - Note: This log doesn't contain Config
        }
        // ------------------------------------------------------

      } else {
        console.log('타겟 경로 선택 취소됨.'); // Korean Log
      }
    } catch (err) {
      console.error('타겟 파일 선택 오류:', err); // Korean Log - Note: This log doesn't contain Config
      setError(`타겟 파일 선택 오류: ${err instanceof Error ? err.message : String(err)}`); // Korean Error - Note: This log doesn't contain Config
      alert(`타겟 파일 선택 오류: ${err instanceof Error ? err.message : String(err)}`); // Korean Alert - Note: This log doesn't contain Config
    }
  };


  // --- Apply Selected Preset to TARGET Claude config file ---
  const applySelectedPresetToClaude = async () => {
    // --- Check if target path is set ---
    if (!actualClaudeConfigPath) {
      alert('오류: 클로드 Config 파일 경로가 설정되지 않았습니다. 상단의 버튼을 사용하여 설정해주세요.'); // Korean Alert
      setError('타겟 경로가 설정되지 않았습니다.'); // Korean Error - Note: This log doesn't contain Config
      return;
    }
    // ------------------------------------
    if (!selectedKey || configStore[selectedKey] === undefined) {
      alert('적용할 유효한 프리셋을 선택하세요.'); // Korean Alert
      return;
    }

    setIsSavingTarget(true);
    setError(null);
    try {
      const presetContent = configStore[selectedKey];
      // --- Use the state variable for the path ---
      console.log(`프리셋 '${selectedKey}'을(를) 타겟에 적용 시도: ${actualClaudeConfigPath}`); // Korean Log
      await writeTextFile(actualClaudeConfigPath, JSON.stringify(presetContent, null, 2));
      // -------------------------------------------
      console.log('프리셋을 타겟 클로드 Config 파일에 성공적으로 적용함.'); // Korean Log
      alert(`프리셋 '${selectedKey}'을(를) 성공적으로 ${actualClaudeConfigPath}에 적용했습니다.`); // Korean Alert - Note: This log doesn't contain Config
    } catch (err) {
      console.error('프리셋을 타겟 파일에 적용 중 오류:', err); // Korean Log
      setError(`클로드 Config에 프리셋 적용 실패: ${err instanceof Error ? err.message : String(err)}`); // Korean Error
      alert(`프리셋 적용 오류: ${err instanceof Error ? err.message : String(err)}`); // Korean Alert - Note: This log doesn't contain Config
    } finally {
      setIsSavingTarget(false);
    }
  };

  // --- JSX - Reverted to Preset Manager layout ---
  return (
    <div className="container">
      <header>
        {/* Title Changed */}
        <h1>클로드 설정 프리셋 편집기</h1>
        {/* --- Area to display and set target path --- */}
        <div className="target-path-controls">
          <span>클로드 Config 파일:</span> {/* Korean Label */}
          <span className="target-path-display">{actualClaudeConfigPath ? actualClaudeConfigPath : "설정 안됨"}</span> {/* Korean Text */}
          <button onClick={selectAndSetActualClaudePath} disabled={isLoading}>타겟 Config 설정</button> {/* Korean Text */}
        </div>
        {/* ------------------------------------------- */}
        {/* Group the preset action buttons */}
        <div className="preset-actions-group">
          {/* Tooltips added and Button Text Changed */}
          <button onClick={importPresets} disabled={isLoading} title="JSON 파일에서 프리셋 가져오기 (기존 프리셋 대체)">프리셋 가져오기</button> {/* Korean Text */}
          <button onClick={exportPresets} disabled={isLoading} title="현재 모든 프리셋을 JSON 파일로 내보내기">프리셋 내보내기</button> {/* Korean Text */}
        </div>
        {/* ------------------------------ */}
        {isLoading && <div className="loading-indicator">프리셋 로딩 중...</div>} {/* Korean Text */}
        {error && <div className="error-indicator">오류: {error}</div>} {/* Korean Text */}
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
                    {/* Conditional rendering for delete buttons */}  
                    {keyToDeleteConfirm === key ? (  
                      <div className="delete-confirm-buttons">  
                        <button 
                          className="confirm-btn confirm-delete" 
                          onClick={() => confirmDelete(key)} 
                          title="삭제 확인"
                        >
                          삭제
                        </button>  
                        <button 
                          className="confirm-btn confirm-cancel" 
                          onClick={cancelDelete}
                          title="삭제 취소"
                        >
                          취소
                        </button>  
                      </div>  
                    ) : (  
                      <button
                        className="delete-key"
                        onClick={(e) => {
                          // Pass the key to start confirmation mode
                          deleteKey(key);
                        }}
                        title="프리셋 삭제"
                      >
                        ✕
                      </button>
                    )}  
                  </div>
                ))}
              </div>
              {/* Group Add buttons at the bottom */}
              <div className="add-preset-buttons">
                <button className="add-key" onClick={addNewKey}>+ 새 프리셋 추가</button> {/* Text Updated Slightly */}
                {/* Moved "Add Preset from File" button here */}
                <button 
                  className="add-key add-from-file" 
                  onClick={addPresetFromJsonFile} 
                  disabled={isLoading} 
                  title="JSON 파일에서 단일 프리셋을 목록에 추가하기"
                >
                  파일에서 추가
                </button>
              </div>
            </div>

            <div className="json-panel"> {/* Preset editor panel */}
              {selectedKey ? (
                <>
                  <div className="json-header"><h3>{selectedKey}</h3></div>
                  <textarea
                    className="json-editor"
                    value={jsonValue}
                    onChange={handleJsonChange}
                    placeholder={`'${selectedKey}' 프리셋 JSON 편집...`} // Korean Placeholder
                    disabled={isLoading}
                    spellCheck={false}
                  />
                  {/* Group action buttons similar to left panel */}
                  <div className="action-buttons-group">
                    <button
                        className="apply-button"
                        onClick={applyJsonChanges}
                        disabled={isLoading}
                        title="현재 편집 중인 내용을 이 프리셋에 임시 저장합니다 (자동 저장됨)" // Korean Tooltip
                    >
                        ✔ 변경사항 저장 {/* Korean Text */}
                    </button>
                    <button
                        className="apply-to-target-button"
                        onClick={applySelectedPresetToClaude}
                        disabled={isLoading || isSavingTarget || !selectedKey || !actualClaudeConfigPath}
                        title={actualClaudeConfigPath ? `현재 '${selectedKey}' 프리셋의 내용을 ${actualClaudeConfigPath} 파일에 덮어씁니다.` : '먼저 클로드 Config 파일을 지정해야 합니다.'} // Korean Tooltip (Corrected to Config)
                    >
                        {isSavingTarget ? '적용 중...' : '클로드 Config에 적용'} {/* Korean Text */}
                    </button>
                  </div>
                </>
              ) : (
                <div className="no-selection">
                  {Object.keys(configStore).length > 0 ? '보거나 편집할 프리셋을 선택하세요' : '로드된 프리셋이 없습니다. 프리셋을 가져오거나 새로 추가하세요.'} {/* Korean Text */}
                </div>
              )}
            </div>
          </div>
        ) : null /* Show nothing during initial load, handled by header indicator */}
      </main>
      {/* Improved styles remain */}
      <style>{`
        /* Improved UI Styles */
        :root {
          --primary-color: #007bff; /* Blue */
          --secondary-color: #6c757d; /* Gray */
          --success-color: #28a745; /* Green */
          --warning-color: #ffc107; /* Yellow */
          --danger-color: #dc3545; /* Red */
          --light-bg: #f8f9fa;
          --dark-text: #343a40;
          --border-color: #dee2e6;
          --hover-bg: #e9ecef;
          --selected-bg: #cfe2ff;
          --selected-border: #9ec5fe;
          --button-text: #ffffff;
        }

        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
          color: var(--dark-text);
          background-color: #fff; /* Changed body background */
        }

        .container {
          height: 100vh;
          display: flex;
          flex-direction: column;
        }

        header {
          padding: 1rem 1.5rem; /* Increased padding */
          background-color: var(--light-bg);
          border-bottom: 1px solid var(--border-color);
          box-shadow: 0 1px 3px rgba(0,0,0,0.1); /* Subtle shadow */
        }

        header h1 {
          margin: 0 0 1rem 0; /* Increased bottom margin */
          font-size: 1.5rem; /* Slightly larger */
          color: var(--dark-text);
        }

        .target-path-controls {
           margin-bottom: 1rem; /* Increased margin */
           padding: 0.75rem; /* Increased padding */
           background-color: #fff; /* White background */
           border: 1px solid var(--border-color); /* Added border */
           border-radius: 6px; /* Slightly more rounded */
           display: flex;
           align-items: center;
           gap: 0.75rem;
        }
        .target-path-controls > span:first-child { /* Target Claude File: label */
           font-weight: 500;
           color: var(--secondary-color);
           white-space: nowrap; /* Prevent label wrapping */
        }

        .target-path-display {
           font-family: monospace;
           font-size: 0.9em;
           color: var(--dark-text);
           background-color: var(--light-bg); /* Lighter bg */
           padding: 0.4rem 0.6rem; /* Adjusted padding */
           border: 1px solid var(--border-color);
           border-radius: 4px; /* Match button radius */
           flex-grow: 1;
           overflow: hidden;
           text-overflow: ellipsis;
           white-space: nowrap;
        }

        .preset-actions-group {
           display: flex;
           gap: 0.75rem;
           margin-top: 0.75rem; /* Add space above this group */
         }

        .loading-indicator, .error-indicator {
          margin-top: 0.75rem;
          padding: 0.5rem;
          border-radius: 4px;
        }
        .loading-indicator {
          color: var(--secondary-color);
        }
        .error-indicator {
          color: var(--danger-color);
          background-color: #f8d7da;
          border: 1px solid #f5c6cb;
          white-space: pre-wrap; /* Allow error message wrapping */
        }

        main {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        .editor-layout {
          display: flex;
          width: 100%;
          height: 100%;
        }

        .keys-panel {
          width: 280px;
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          background-color: var(--light-bg);
          padding: 1rem;
        }

        .keys-list {
          flex: 1;
          overflow-y: auto;
          padding: 0; /* Explicitly set padding to 0 */
          /* Padding is now on the parent .keys-panel */
          /* Remove padding here if needed, or adjust if specific list padding is desired */
        }

        .key-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.7rem 0.8rem; /* Increased padding */
          margin-bottom: 0.3rem;
          border-radius: 5px; /* Softer corners */
          cursor: pointer;
          border: 1px solid transparent;
          transition: background-color 0.15s ease-in-out, border-color 0.15s ease-in-out; /* Smooth transition */
        }

        .key-item:hover {
          background-color: var(--hover-bg);
          border-color: #ced4da;
        }

        .key-item.selected {
          background-color: var(--selected-bg);
          border-color: var(--selected-border);
          color: #0a3622; /* Darker text for selected */
          font-weight: 500; /* Bold selected */
        }
        .key-item.selected:hover {
           background-color: #b9d5ff; /* Slightly darker blue on hover when selected */
        }


        .key-name {
          flex-grow: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin-right: 0.5rem; /* Space before delete button */
        }

        .key-item input[type="text"] {
          flex-grow: 1;
          border: 1px solid var(--primary-color);
          padding: 0.3rem 0.5rem;
          border-radius: 4px;
          outline: none;
          /* Removed focus shadow for simplicity, border color change is enough */
        }

        .delete-key {
          background: none;
          border: none;
          color: var(--secondary-color);
          cursor: pointer;
          font-size: 1.2em;
          line-height: 1; /* Align better */
          padding: 0 0.3em;
          border-radius: 50%; /* Round button */
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          visibility: hidden; /* Hide by default */
          opacity: 0;
          transition: background-color 0.2s ease, color 0.2s ease, opacity 0.2s ease; /* Add opacity transition back */
        }

        .key-item:hover .delete-key,
        .key-item.selected .delete-key {
          visibility: visible;
          opacity: 0.7; /* Make it slightly transparent */
        }
        .key-item .delete-key:hover {
          background-color: rgba(220, 53, 69, 0.1); /* Lighter danger bg on hover */
          color: var(--danger-color);
          opacity: 1;
        }


        .add-preset-buttons {
          display: flex;
          flex-direction: column; /* Stack buttons vertically */
          gap: 0.5rem; /* Space between buttons */
        }

        .add-key {
          display: block;
          width: 100%; /* Make buttons full width */
          margin: 0; /* Remove individual margins */
          padding: 0.6rem 1.2rem;
          text-align: center;
          background-color: #e9ecef; /* Lighter gray */
          color: var(--dark-text);
          border-color: #ced4da; /* Use specific border color */
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: background-color 0.2s ease;
        }

        .add-key:hover {
          background-color: #dee2e6; /* Darker on hover */
        }

        /* Specific style for Add from file button if needed, e.g., slightly different bg */
        .add-key.add-from-file {
          /* background-color: #dde; /* Example: slightly different background */
          /* You can customize this button further if needed */
        }

        .json-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 1rem; /* Increased padding */
          background-color: #ffffff; /* White background for editor area */
          flex-grow: 1; /* Green button takes 1 part */
        }

        .json-header {
          margin-bottom: 0.75rem; /* Adjusted margin */
          border-bottom: 1px solid var(--border-color); /* Separator line */
          padding-bottom: 0.5rem;
        }

        .json-header h3 {
          margin: 0;
          font-size: 1.2rem; /* Slightly larger */
          color: var(--dark-text);
        }

        .json-editor {
          flex: 1;
          font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
          font-size: 14px;
          line-height: 1.5; /* Better line spacing */
          border: 1px solid var(--border-color);
          border-radius: 6px; /* Match target path display */
          padding: 0.75rem; /* Increased padding */
          resize: none;
          margin-bottom: 1rem; /* Space before buttons */
        }
        .json-editor:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25); /* Focus ring */
        }

        /* General Button Styles */
        button {
          padding: 0.6rem 1.2rem;
          border: 1px solid transparent; /* Add base transparent border for consistent height */
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.90rem; /* Adjusted font size for Korean */
          font-weight: 500;
          transition: background-color 0.2s ease, box-shadow 0.2s ease;
          line-height: 1.4; /* Ensure text vertical align */
          display: inline-flex; /* Align icon and text if needed */
          align-items: center;
          justify-content: center;
          white-space: nowrap; /* Prevent button text wrapping */
          box-sizing: border-box; /* Ensure padding and border are included in height/width */
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        /* Primary Action Button (e.g., Set Target) */
        button.primary,
        .preset-actions-group button, /* Apply primary style to these buttons too */
        .target-path-controls button {
          background-color: var(--primary-color);
          color: var(--button-text);
        }
        button.primary:not(:disabled):hover,
        .preset-actions-group button:not(:disabled):hover,
        .target-path-controls button:not(:disabled):hover {
          background-color: #0056b3; /* Darker blue */
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        /* Success Action Button (Apply Changes) */
        .apply-button {
          background-color: var(--success-color);
          color: var(--button-text);
          border-color: var(--success-color); /* Keep border consistent */
          margin: 0; /* Explicitly remove any default/inherited margin */
        }
        .apply-button:not(:disabled):hover {
          background-color: #1e7e34; /* Darker green */
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        /* Warning Action Button (Apply to Claude) */
        .apply-to-target-button {
             background-color: #ff9800; /* Orange */
             color: var(--button-text);
             border-color: #ff9800; /* Keep border consistent */
        }
        .apply-to-target-button:not(:disabled):hover {
           background-color: #e68a00; /* Darker orange */
           box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .apply-to-target-button:disabled {
             background-color: #ffcc80; /* Lighter orange when disabled */
             opacity: 0.7; /* Make slightly more opaque than default disabled */
         }

        .no-selection {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center; /* Center text */
          height: 100%;
          color: var(--secondary-color);
          font-style: italic;
          background-color: #fff;
          border-radius: 6px;
          padding: 1rem; /* Add padding */
        }

        .action-buttons-group {
          padding: 0.5rem; /* Match left panel */
          display: flex;
          flex-direction: row;
          justify-content: center;
          /* flex-direction: column; is the default */
          gap: 0.5rem; /* Re-add gap for horizontal spacing */
          border-top: 1px solid var(--border-color); /* Match left panel */
        }

        /* 새로운 삭제 확인 버튼 그룹 */
        .delete-confirm-buttons {
          display: flex;
          gap: 0.3rem; /* 버튼 사이 간격 */
        }

        /* 개별 확인/취소 버튼 */
        .confirm-btn {
          padding: 0.2rem 0.5rem; /* 작은 크기로 조정 */
          font-size: 0.8rem; /* 작은 폰트 */
          border-radius: 3px;
          border: 1px solid;
          cursor: pointer;
          transition: background-color 0.2s ease, color 0.2s ease;
        }

        .confirm-btn.confirm-delete {
          background-color: var(--danger-color);
          border-color: var(--danger-color);
          color: white;
        }
         .confirm-btn.confirm-delete:hover {
           background-color: #a02633; /* Darker red */
         }

        .confirm-btn.confirm-cancel {
           background-color: var(--secondary-color);
           border-color: var(--secondary-color);
           color: white;
        }
        .confirm-btn.confirm-cancel:hover {
           background-color: #545b62; /* Darker gray */
        }
      `}</style>
    </div>
  );
}

export default App;