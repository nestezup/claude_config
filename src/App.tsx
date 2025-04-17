import React, { useState } from 'react';
import { open, save } from '@tauri-apps/api/dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/api/fs';

// Define interfaces for our data structure
interface ConfigValue {
  [key: string]: any;
}

interface ConfigStore {
  [key: string]: ConfigValue;
}

function App() {
  // State for the application
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [configStore, setConfigStore] = useState<ConfigStore>({
    // Sample data
    "obsidian": {
      "mcp": {
        "inputs": [],
        "servers": {}
      }
    },
    "notion": {
      "settings": {
        "theme": "dark",
        "fontSize": 14
      }
    }
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [jsonValue, setJsonValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Function to select config file using Tauri dialog API
  const selectConfigFile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Open file dialog
      const filePath = await open({
        filters: [{
          name: 'JSON Config',
          extensions: ['json']
        }]
      });
      
      // Handle result
      if (filePath === null) {
        // User cancelled the dialog
        setIsLoading(false);
        return;
      }
      
      // Set selected file path
      if (Array.isArray(filePath)) {
        setSelectedFile(filePath[0]);
        
        // Read file content
        const content = await readTextFile(filePath[0]);
        try {
          const parsed = JSON.parse(content);
          setConfigStore(parsed);
        } catch (e) {
          setError(`Failed to parse JSON: ${e}`);
        }
      } else {
        setSelectedFile(filePath);
        
        // Read file content
        const content = await readTextFile(filePath);
        try {
          const parsed = JSON.parse(content);
          setConfigStore(parsed);
        } catch (e) {
          setError(`Failed to parse JSON: ${e}`);
        }
      }
      
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      setError(`Failed to select file: ${err}`);
      console.error('Error selecting file:', err);
    }
  };

  // Add a new key to the configuration
  const addNewKey = () => {
    const newKey = prompt('Enter a name for the new configuration:');
    if (newKey && newKey.trim() !== '') {
      // 이미 존재하는 키인지 확인
      if (configStore[newKey]) {
        alert(`Configuration key "${newKey}" already exists.`);
        return;
      }
      
      const newConfig = {
        ...configStore,
        [newKey]: {}
      };
      
      setConfigStore(newConfig);
      setSelectedKey(newKey);
      setJsonValue('{}');
    }
  };

  // Delete a key from the configuration
  const deleteKey = (key: string) => {
    if (confirm(`Are you sure you want to delete the "${key}" configuration?`)) {
      const newConfigStore = { ...configStore };
      delete newConfigStore[key];
      
      setConfigStore(newConfigStore);
      
      // 현재 선택된 키가 삭제된 경우 선택 해제
      if (selectedKey === key) {
        setSelectedKey(null);
        setJsonValue('');
      }
    }
  };

  // Handle selecting a key
  const handleKeySelect = (key: string) => {
    setSelectedKey(key);
    try {
      setJsonValue(JSON.stringify(configStore[key], null, 2));
    } catch (e) {
      setJsonValue('{}');
    }
  };

  // Handle JSON text changes
  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonValue(e.target.value);
    
    try {
      const parsed = JSON.parse(e.target.value);
      if (selectedKey) {
        // Update in memory
        setConfigStore({
          ...configStore,
          [selectedKey]: parsed
        });
      }
    } catch (e) {
      // Invalid JSON, don't update
    }
  };

  // Apply configuration to file
  const applyConfig = async () => {
    if (!selectedFile) {
      alert('Please select a config file first');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Write to file
      await writeTextFile(selectedFile, JSON.stringify(configStore, null, 2));
      
      alert('Configuration applied successfully!');
      setIsLoading(false);
    } catch (err) {
      setError(`Failed to save file: ${err}`);
      setIsLoading(false);
    }
  };

  // Export configuration set
  const exportConfig = async () => {
    try {
      // 저장 대화상자 열기
      let filePath = await save({
        filters: [{
          name: 'JSON Config',
          extensions: ['json']
        }],
        defaultPath: 'claude_config_export.json'
      });
      
      if (filePath) {
        // 확장자가 없으면 .json 추가
        if (!filePath.toLowerCase().endsWith('.json')) {
          filePath = `${filePath}.json`;
        }
        
        await writeTextFile(filePath, JSON.stringify(configStore, null, 2));
        alert('Configuration set exported successfully!');
      }
    } catch (err) {
      setError(`Failed to export configuration: ${err}`);
    }
  };

  // Import configuration set
  const importConfig = async () => {
    try {
      const filePath = await open({
        filters: [{
          name: 'JSON Config',
          extensions: ['json']
        }],
        multiple: false
      });
      
      if (filePath) {
        const content = await readTextFile(filePath as string);
        try {
          const parsed = JSON.parse(content);
          setConfigStore(parsed);
          
          // UI 업데이트
          if (Object.keys(parsed).length > 0) {
            // 첫 번째 키 선택
            const firstKey = Object.keys(parsed)[0];
            setSelectedKey(firstKey);
            setJsonValue(JSON.stringify(parsed[firstKey], null, 2));
          } else {
            setSelectedKey(null);
            setJsonValue('');
          }
          
          alert('Configuration set imported successfully!');
        } catch (e) {
          setError(`Failed to parse JSON: ${e}`);
        }
      }
    } catch (err) {
      setError(`Failed to import configuration: ${err}`);
    }
  };

  // Add a new JSON configuration file
  const addJsonConfig = async () => {
    try {
      // 파일 선택 대화상자 열기
      const filePath = await open({
        filters: [{
          name: 'JSON Config',
          extensions: ['json']
        }],
        multiple: false
      });
      
      if (filePath) {
        const content = await readTextFile(filePath as string);
        try {
          // JSON 파싱
          const parsed = JSON.parse(content);
          
          // 파일 이름에서 확장자 제거하여 키 이름으로 사용
          let fileName = '';
          if (typeof filePath === 'string') {
            const pathParts = filePath.split(/[/\\]/);
            const lastPart = pathParts[pathParts.length - 1];
            fileName = lastPart.replace(/\.json$/, '');
          } else {
            // 기본 이름
            fileName = `config_${Object.keys(configStore).length + 1}`;
          }
          
          // 이미 같은 이름의 키가 있는지 확인
          let keyName = fileName;
          let counter = 1;
          while (configStore[keyName]) {
            keyName = `${fileName}_${counter}`;
            counter++;
          }
          
          // 설정 스토어에 추가
          const newConfigStore = {
            ...configStore,
            [keyName]: parsed
          };
          
          setConfigStore(newConfigStore);
          setSelectedKey(keyName);
          setJsonValue(JSON.stringify(parsed, null, 2));
          
          alert(`Added new configuration "${keyName}"`);
        } catch (e) {
          setError(`Failed to parse JSON: ${e}`);
        }
      }
    } catch (err) {
      setError(`Failed to add JSON configuration: ${err}`);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>Claude Config Editor</h1>
        <div className="file-controls">
          <button onClick={selectConfigFile} disabled={isLoading}>
            {selectedFile ? 'Change config file' : 'Select config file'}
          </button>
          {selectedFile && <span className="file-path">{selectedFile}</span>}
          {isLoading && <span className="loading">Loading...</span>}
          {error && <span className="error">{error}</span>}
        </div>
        <div className="set-controls">
          <button onClick={exportConfig}>Export Config Set</button>
          <button onClick={importConfig}>Import Config Set</button>
          <button onClick={addJsonConfig}>Add JSON File</button>
        </div>
      </header>

      <main>
        {selectedFile && (
          <div className="editor-layout">
            <div className="keys-panel">
              <div className="keys-list">
                {Object.keys(configStore).map(key => (
                  <div 
                    key={key}
                    className={`key-item ${selectedKey === key ? 'selected' : ''}`}
                  >
                    <span 
                      className="key-name"
                      onClick={() => handleKeySelect(key)}
                    >
                      {key}
                    </span>
                    <button 
                      className="delete-key"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteKey(key);
                      }}
                      title="Delete this configuration"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button className="add-key" onClick={addNewKey}>+ Add</button>
            </div>
            
            <div className="json-panel">
              {selectedKey ? (
                <>
                  <div className="json-header">
                    <h3>{selectedKey}</h3>
                  </div>
                  <textarea 
                    className="json-editor"
                    value={jsonValue}
                    onChange={handleJsonChange}
                    spellCheck={false}
                  />
                  <button 
                    className="apply-button"
                    onClick={applyConfig}
                    disabled={!selectedFile || isLoading}
                  >
                    ✔ Apply to Config File
                  </button>
                </>
              ) : (
                <div className="no-selection">
                  Select a configuration key or add a new one
                </div>
              )}
            </div>
          </div>
        )}
        
        {!selectedFile && (
          <div className="welcome">
            <p>Welcome to Claude Config Editor</p>
            <p>Start by selecting a Claude configuration file</p>
            <button onClick={selectConfigFile}>
              Select config file
            </button>
          </div>
        )}
      </main>

      <style>{`
        .container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        }
        
        header {
          padding: 1rem;
          background-color: #f5f5f5;
          border-bottom: 1px solid #ddd;
        }
        
        h1 {
          margin: 0 0 1rem 0;
          font-size: 1.5rem;
        }
        
        .file-controls {
          display: flex;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        
        .file-path {
          margin-left: 0.5rem;
          font-size: 0.9rem;
          color: #666;
        }
        
        .loading {
          margin-left: 0.5rem;
          font-size: 0.9rem;
          color: #666;
        }
        
        .error {
          margin-left: 0.5rem;
          font-size: 0.9rem;
          color: #d32f2f;
        }
        
        .set-controls {
          display: flex;
          gap: 0.5rem;
        }
        
        button {
          padding: 0.5rem 1rem;
          background-color: #2196f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
        }
        
        button:hover {
          background-color: #1976d2;
        }
        
        button:disabled {
          background-color: #bbdefb;
          cursor: not-allowed;
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
          width: 250px;
          border-right: 1px solid #ddd;
          display: flex;
          flex-direction: column;
        }
        
        .keys-list {
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem;
        }
        
        .key-item {
          padding: 0.5rem;
          margin-bottom: 0.25rem;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: #e8f4fc;
        }
        
        .key-item:hover {
          background-color: #d0e8f7;
        }
        
        .key-item.selected {
          background-color: #bbdefb;
        }
        
        .key-name {
          flex: 1;
        }
        
        .delete-key {
          background: none;
          color: #d32f2f;
          border: none;
          padding: 0.25rem;
          font-size: 0.8rem;
          cursor: pointer;
          display: none;
        }
        
        .key-item:hover .delete-key {
          display: block;
        }
        
        .add-key {
          margin: 0.5rem;
          width: calc(100% - 1rem);
          text-align: center;
          background-color: #f5f5f5;
          color: #333;
          border: 1px solid #ddd;
          padding: 0.7rem;
        }
        
        .add-key:hover {
          background-color: #e0e0e0;
        }
        
        .json-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 0.5rem;
        }
        
        .json-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        
        .json-header h3 {
          margin: 0;
          font-size: 1.1rem;
          color: #333;
        }
        
        .json-editor {
          flex: 1;
          font-family: 'Courier New', Courier, monospace;
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          resize: none;
          font-size: 0.9rem;
        }
        
        .apply-button {
          margin-top: 0.5rem;
          background-color: #4caf50;
        }
        
        .apply-button:hover {
          background-color: #388e3c;
        }
        
        .no-selection {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #666;
        }
        
        .welcome {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
        }
        
        .welcome p {
          margin-bottom: 1rem;
          color: #666;
        }
      `}</style>
    </div>
  );
}

export default App;