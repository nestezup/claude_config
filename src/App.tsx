import React, { useState } from 'react';
import { open } from '@tauri-apps/api/dialog';
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
      const newConfig = {
        ...configStore,
        [newKey]: {}
      };
      
      setConfigStore(newConfig);
      setSelectedKey(newKey);
      setJsonValue('{}');
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
      const savePath = await open({
        filters: [{
          name: 'JSON Config',
          extensions: ['json']
        }],
        directory: false,
        multiple: false,
        defaultPath: 'claude_config_export.json'
      });
      
      if (savePath) {
        await writeTextFile(savePath as string, JSON.stringify(configStore, null, 2));
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
          alert('Configuration set imported successfully!');
        } catch (e) {
          setError(`Failed to parse JSON: ${e}`);
        }
      }
    } catch (err) {
      setError(`Failed to import configuration: ${err}`);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>Claude Config Editor</h1>
        <div className="file-controls">
          <button onClick={selectConfigFile} disabled={isLoading}>
            📁 {selectedFile ? 'Change config file' : 'Select config file'}
          </button>
          {selectedFile && <span className="file-path">{selectedFile}</span>}
          {isLoading && <span className="loading">Loading...</span>}
          {error && <span className="error">{error}</span>}
        </div>
        <div className="set-controls">
          <button onClick={exportConfig}>📤 Export Config Set</button>
          <button onClick={importConfig}>📥 Import Config Set</button>
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
                    onClick={() => handleKeySelect(key)}
                  >
                    {key}
                  </div>
                ))}
              </div>
              <button className="add-key" onClick={addNewKey}>+ Add</button>
            </div>
            
            <div className="json-panel">
              {selectedKey ? (
                <>
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
              📁 Select config file
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;