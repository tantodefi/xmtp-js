/**
 * This script helps preload WASM files for better compatibility
 */

// Create a function to preload the WASM bindings
async function preloadWasmBindings() {
  try {
    // Create a relative path to find the wasm files
    const basePath = '/node_modules/@xmtp/wasm-bindings/';
    
    // Try to fetch the directory listing (this may fail in some environments)
    fetch(basePath)
      .then(response => {
        console.log('WASM path is accessible:', response.ok);
      })
      .catch(error => {
        console.warn('WASM path check failed:', error);
      });
    
    // Preload common WASM file names 
    const possibleWasmFiles = [
      'index_bg.wasm',
      'wasm_bindings_bg.wasm',
      'pkg/index_bg.wasm'
    ];
    
    // Try to preload each possible WASM file
    for (const file of possibleWasmFiles) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = `${basePath}${file}`;
      link.as = 'fetch';
      link.type = 'application/wasm';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
      
      console.log(`Preloaded potential WASM file: ${basePath}${file}`);
    }
  } catch (error) {
    console.error('Error in WASM preloader:', error);
  }
}

// Run the preloader
preloadWasmBindings(); 
