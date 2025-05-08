/**
 * This script helps preload WASM files for better compatibility
 * Enhanced version with error handling and fallback mechanisms
 */

// Global flag to track WASM loading status
window.wasmLoadingStatus = {
  attempted: false,
  successful: false,
  error: null
};

// Create a function to preload the WASM bindings
async function preloadWasmBindings() {
  try {
    window.wasmLoadingStatus.attempted = true;
    
    // Create a relative path to find the wasm files
    const basePath = '/node_modules/@xmtp/wasm-bindings/';
    
    // Try to fetch the directory listing (this may fail in some environments)
    try {
      const response = await fetch(basePath);
      console.log('WASM path is accessible:', response.ok);
      
      if (!response.ok) {
        throw new Error(`WASM path not accessible: ${response.status}`);
      }
    } catch (pathError) {
      console.warn('WASM path check failed:', pathError);
      // Continue anyway - the preloads might still work
    }
    
    // Preload common WASM file names 
    const possibleWasmFiles = [
      'index_bg.wasm',
      'wasm_bindings_bg.wasm',
      'pkg/index_bg.wasm'
    ];
    
    // Track successful preloads
    let successfulPreloads = 0;
    
    // Try to preload each possible WASM file
    for (const file of possibleWasmFiles) {
      try {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = `${basePath}${file}`;
        link.as = 'fetch';
        link.type = 'application/wasm';
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
        
        // Also try to fetch the file directly to ensure it's accessible
        fetch(`${basePath}${file}`)
          .then(response => {
            if (response.ok) {
              console.log(`Successfully verified WASM file: ${basePath}${file}`);
              successfulPreloads++;
              
              if (successfulPreloads > 0) {
                window.wasmLoadingStatus.successful = true;
              }
            } else {
              console.warn(`WASM file not accessible: ${basePath}${file}`);
            }
          })
          .catch(fetchError => {
            console.warn(`Error fetching WASM file ${file}:`, fetchError);
          });
        
        console.log(`Preloaded potential WASM file: ${basePath}${file}`);
      } catch (fileError) {
        console.warn(`Error preloading WASM file ${file}:`, fileError);
      }
    }
    
    // Set up a global error handler for worker errors
    const originalOnError = window.onerror;
    window.onerror = function(message, source, lineno, colno, error) {
      if (source && source.includes('ClientWorkerClass')) {
        console.error('XMTP Worker error detected:', { message, source });
        window.wasmLoadingStatus.error = { message, source };
      }
      // Call the original handler if it exists
      if (originalOnError) {
        return originalOnError(message, source, lineno, colno, error);
      }
      return false;
    };
    
  } catch (error) {
    console.error('Error in WASM preloader:', error);
    window.wasmLoadingStatus.error = error;
  }
}

// Run the preloader
preloadWasmBindings(); 
