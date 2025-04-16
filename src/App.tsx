import React, { useState } from 'react';

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

  // Mock function to simulate file selection
  const selectConfigFile = () => {
    setSelectedFile('/path/to/claude_desktop_config.json');
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
  const applyConfig = () => {
    if (!selectedFile) {
      alert('Please select a config file first');
      return;
    }
    
    alert('Configuration applied successfully! (Demo Only)');
  };

  // Export configuration set
  const exportConfig = () => {
    alert('Configuration set exported successfully! (Demo Only)');
  };

  // Import configuration set
  const importConfig = () => {
    alert('Configuration set imported successfully! (Demo Only)');
  };

  return (
    <div className="container">
      <header>
        <h1>Claude Config Editor</h1>
        <div className="file-controls">
          <button onClick={selectConfigFile}>
            📁 {selectedFile ? 'Change config file' : 'Select config file'}
          </button>
          {selectedFile && <span className="file-path">{selectedFile}</span>}
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
                    disabled={!selectedFile}
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