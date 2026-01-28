import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { generateJiraEpic } from '../../services/api';
import './JiraEpicPage.css';

const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1 GB in bytes

function JiraEpicPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [error, setError] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef(null);

  /**
   * Securely validate that the file contains only text content
   * This function reads the file content and checks for:
   * 1. Valid UTF-8 text encoding
   * 2. No executable signatures or binary content
   * 3. Reasonable text patterns
   */
  const validateTextFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target.result;
          
          // Check 1: Verify it's valid UTF-8 text by checking for null bytes
          // Binary files often contain null bytes, text files don't
          if (content.includes('\0')) {
            reject(new Error('File contains binary data. Only text files are allowed.'));
            return;
          }

          // Check 2: Look for common executable file signatures (magic numbers)
          const executableSignatures = [
            'MZ',           // Windows PE executable
            '\x7FELF',      // Linux ELF executable
            '#!',           // Shell script (we'll allow this as it's text-based)
            'PK',           // ZIP files (JAR, etc.)
            '\xCA\xFE\xBA\xBE', // Java class file
            '\x89PNG',      // PNG image
            'GIF89',        // GIF image
            '\xFF\xD8\xFF', // JPEG image
            '%PDF',         // PDF file
          ];

          // Check if content starts with any executable signature (except shebang which is text)
          for (const sig of executableSignatures) {
            if (sig !== '#!' && content.startsWith(sig)) {
              reject(new Error('File appears to be a binary/executable format. Only plain text files are allowed.'));
              return;
            }
          }

          // Check 3: Verify the content is mostly printable ASCII/UTF-8 characters
          // Count non-printable characters (excluding common whitespace)
          let nonPrintableCount = 0;
          const sampleSize = Math.min(10000, content.length); // Check first 10KB for performance
          
          for (let i = 0; i < sampleSize; i++) {
            const charCode = content.charCodeAt(i);
            // Allow: printable ASCII (32-126), tab (9), newline (10), carriage return (13)
            // and extended UTF-8 characters (>127)
            if ((charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13) && charCode < 127) {
              nonPrintableCount++;
            }
          }

          // If more than 5% of characters are non-printable, likely binary
          if (nonPrintableCount > sampleSize * 0.05) {
            reject(new Error('File contains too many non-printable characters. Please use a plain text file.'));
            return;
          }

          // Check 4: File is valid text
          resolve(content);
        } catch (err) {
          reject(new Error('Failed to validate file content. Please ensure it is a valid text file.'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file. Please try again.'));
      };

      // Read as text with UTF-8 encoding
      reader.readAsText(file, 'UTF-8');
    });
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    
    if (!file) {
      return;
    }

    // Reset previous state
    setError(null);
    setSelectedFile(null);
    setFileContent('');

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File size exceeds maximum allowed size of 1 GB. Selected file is ${(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB.`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Validate file is not empty
    if (file.size === 0) {
      setError('File is empty. Please select a file with content.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    try {
      setIsValidating(true);
      
      // Securely validate file content
      const content = await validateTextFile(file);
      
      // File is valid
      setSelectedFile(file);
      setFileContent(content);
      setError(null);
    } catch (err) {
      setError(err.message);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleGenerate = async () => {
    if (!fileContent) {
      setError('Please select a valid text file first.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Call backend API to generate JIRA Epic
      const response = await generateJiraEpic(fileContent);
      
      // Set the generated epic content
      setGeneratedContent(response.epic);
    } catch (err) {
      // Handle different error types
      const errorMessage = err.message || 'Failed to generate JIRA Epic';
      
      if (errorMessage.includes('503') || errorMessage.includes('unavailable')) {
        setError('LLM service is not available. Please ensure Ollama is running and try again.');
      } else if (errorMessage.includes('400')) {
        setError('Invalid requirements. Please check your file content and try again.');
      } else {
        setError(`Failed to generate JIRA Epic: ${errorMessage}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Simple markdown renderer for basic formatting
  const renderMarkdown = (text) => {
    if (!text) return '';
    
    // Basic markdown rendering
    let html = text
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      // Inline code
      .replace(/`(.+?)`/g, '<code>$1</code>')
      // Horizontal rule
      .replace(/^---$/gim, '<hr />')
      // Line breaks
      .replace(/\n/g, '<br />');
    
    return html;
  };

  return (
    <main className="main-content">
      <section className="jira-epic-section">
        <div className="section-header">
          <h2>Epic Creation</h2>
          <Link to="/" className="back-link">Back to Home</Link>
        </div>

        <div className="jira-epic-container">
          {/* File Input Section */}
          <div className="jira-epic-input-section">
            <div className="file-input-wrapper">
              <label htmlFor="file-input" className="file-input-label">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                  <polyline points="13 2 13 9 20 9"/>
                </svg>
                <span className="file-input-text">
                  {isValidating ? 'Validating file...' : (selectedFile ? selectedFile.name : 'Choose text file (up to 1 GB)')}
                </span>
                {selectedFile && (
                  <span className="file-size-badge">{formatFileSize(selectedFile.size)}</span>
                )}
              </label>
              <input
                ref={fileInputRef}
                id="file-input"
                type="file"
                accept=".txt,.md,.text"
                onChange={handleFileSelect}
                disabled={isValidating || isGenerating}
                className="file-input-hidden"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={!selectedFile || isValidating || isGenerating}
              className="generate-btn"
              type="button"
            >
              {isGenerating ? (
                <>
                  <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" opacity="0.25"/>
                    <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6"/>
                    <polyline points="8 6 2 12 8 18"/>
                  </svg>
                  Generate Jira Epic
                </>
              )}
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="error-message" role="alert">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* File Info Display */}
          {selectedFile && !error && (
            <div className="file-info">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
              <span>File loaded successfully. Ready to generate JIRA Epic.</span>
            </div>
          )}

          {/* Output Section */}
          <div className="jira-epic-output-section">
            <div className="output-header">
              <h3>Generated JIRA Epic</h3>
              {generatedContent && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedContent);
                  }}
                  className="copy-btn"
                  type="button"
                  title="Copy to clipboard"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy
                </button>
              )}
            </div>
            <div 
              className="markdown-output"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(generatedContent) }}
            />
            {!generatedContent && (
              <div className="output-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <line x1="10" y1="9" x2="8" y2="9"/>
                </svg>
                <p>Generated content will appear here</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default JiraEpicPage;
