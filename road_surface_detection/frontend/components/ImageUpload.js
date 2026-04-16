import React, { useState, useRef } from 'react';
import { Upload, X, ImageIcon, Camera } from 'lucide-react';

const ImageUpload = ({ onPredict }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [isHovering, setIsHovering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  const processFiles = (files) => {
    const validFiles = Array.from(files).filter(file => 
      ['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)
    );
    
    if (validFiles.length !== files.length) {
      alert('Some files were ignored. Only JPG and PNG are supported.');
    }
    
    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      
      const newUrls = validFiles.map(file => URL.createObjectURL(file));
      setPreviewUrls(prev => [...prev, ...newUrls]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsHovering(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsHovering(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsHovering(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    setPreviewUrls([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) return;
    
    setIsLoading(true);
    try {
      await onPredict(selectedFiles);
    } catch (error) {
      console.error("Prediction failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-panel p-6 animate-fade-in w-full h-full flex flex-col">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Upload size={20} className="text-blue-400" />
        Upload Image
      </h2>
      
      {!previewUrls.length ? (
        <div 
          className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
            ${isHovering ? 'border-blue-400 bg-blue-500/10' : 'border-slate-600 hover:border-slate-500 bg-slate-800/50'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mb-4 text-blue-400">
            <ImageIcon size={32} />
          </div>
          <h3 className="text-lg font-medium mb-1">Drag & drop images</h3>
          <p className="text-slate-400 text-sm mb-6">Supports single or batch selection (JPG, PNG)</p>
          
          <button className="btn-primary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
            Select Files
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col h-full">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-slate-300">{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected</span>
            <button 
              onClick={handleClearAll}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
            >
              <X size={12} /> Clear All
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto mb-4 custom-scrollbar pr-2 min-h-[200px]">
            <div className="grid grid-cols-2 gap-3">
              {previewUrls.map((url, index) => (
                <div key={index} className="relative rounded-lg overflow-hidden bg-black/40 border border-slate-700 aspect-square group">
                  <img 
                    src={url} 
                    alt={`Preview ${index}`} 
                    className="w-full h-full object-cover"
                  />
                  <button 
                    onClick={() => handleRemoveFile(index)}
                    className="absolute top-1 right-1 bg-slate-900/80 hover:bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all backdrop-blur-md"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center border-2 border-dashed border-slate-600 hover:border-slate-500 bg-slate-800/20 rounded-lg aspect-square cursor-pointer transition-colors"
              >
                <Upload size={24} className="text-slate-400 mb-2" />
                <span className="text-xs text-slate-400 font-medium">Add More</span>
              </div>
            </div>
          </div>
          
          <button 
            className="btn-primary w-full py-3 text-lg" 
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Analyzing {selectedFiles.length} Image{selectedFiles.length > 1 ? 's' : ''}...
              </>
            ) : (
              `Process ${selectedFiles.length} Image${selectedFiles.length > 1 ? 's' : ''}`
            )}
          </button>
        </div>
      )}
      
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/jpeg, image/png, image/jpg" 
        multiple
        className="hidden" 
      />
    </div>
  );
};

export default ImageUpload;
