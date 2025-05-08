import React, { useEffect, useState } from 'react';
import { Box, Text, Loader, Center, Button, Group } from '@mantine/core';

interface WasmHandlerProps {
  children: React.ReactNode;
}

/**
 * WasmHandler component that ensures WebAssembly is properly initialized
 * before rendering the application.
 */
const WasmHandler: React.FC<WasmHandlerProps> = ({ children }) => {
  const [wasmStatus, setWasmStatus] = useState<'loading' | 'success' | 'warning' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Check if WebAssembly is supported in this browser
    if (typeof WebAssembly !== 'object') {
      setWasmStatus('error');
      setErrorMessage('Your browser does not support WebAssembly, which is required for XMTP messaging.');
      return;
    }

    // Simple check for WebAssembly support
    const checkWasmSupport = async () => {
      try {
        // Create the simplest possible WebAssembly module (empty module)
        const wasmTestCode = new Uint8Array([
          0, 97, 115, 109, // magic bytes
          1, 0, 0, 0       // version
        ]);

        // Try to instantiate the module
        await WebAssembly.instantiate(wasmTestCode);
        console.log('WebAssembly basic support check passed');
        
        // Even if this simple test passes, we might still have issues with the actual XMTP WASM modules
        // So we'll set status to warning if we've seen errors in the console
        const wasmErrorMeta = document.querySelector('meta[name="wasm-error"]');
        if (wasmErrorMeta) {
          setWasmStatus('warning');
          setErrorMessage('WebAssembly is supported, but there might be issues with XMTP WebAssembly modules. The app will try to continue.');
        } else {
          setWasmStatus('success');
        }
      } catch (error) {
        console.error('WebAssembly support check failed:', error);
        setWasmStatus('error');
        setErrorMessage(`WebAssembly is not fully supported in this browser: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    checkWasmSupport();
  }, []);

  // Show loading state while checking WebAssembly support
  if (wasmStatus === 'loading') {
    return (
      <Center style={{ height: '100vh' }}>
        <Box style={{ textAlign: 'center' }}>
          <Loader size="lg" />
          <Text mt="md">Initializing WebAssembly...</Text>
        </Box>
      </Center>
    );
  }

  // Show error state if WebAssembly is not supported
  if (wasmStatus === 'error') {
    return (
      <Center style={{ height: '100vh' }}>
        <Box style={{ textAlign: 'center', maxWidth: '600px', padding: '20px' }}>
          <Text color="red" size="lg" fw={700}>WebAssembly Error</Text>
          <Text mt="md">{errorMessage || 'WebAssembly is not supported in this browser, which is required for XMTP messaging.'}</Text>
          <Text mt="lg">
            Try using a modern browser like Chrome, Firefox, or Edge, and ensure that WebAssembly execution is not blocked by any browser extensions or security settings.
          </Text>
          <Text mt="md" size="sm" color="dimmed">
            Common issues include Content Security Policy restrictions, browser extensions blocking WebAssembly, or outdated browsers.
          </Text>
        </Box>
      </Center>
    );
  }

  // Show warning state if WebAssembly might have issues
  if (wasmStatus === 'warning') {
    return (
      <Center style={{ height: '100vh' }}>
        <Box style={{ textAlign: 'center', maxWidth: '600px', padding: '20px' }}>
          <Text color="orange" size="lg" fw={700}>WebAssembly Warning</Text>
          <Text mt="md">{errorMessage}</Text>
          <Group mt="lg" position="center">
            <Button onClick={() => setWasmStatus('success')} color="blue">Continue Anyway</Button>
            <Button variant="outline" onClick={() => setShowDetails(!showDetails)}>
              {showDetails ? 'Hide Details' : 'Show Details'}
            </Button>
          </Group>
          {showDetails && (
            <Box mt="md" p="md" style={{ textAlign: 'left', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
              <Text size="sm">WebAssembly is supported by your browser, but there might be issues with the specific WebAssembly modules used by XMTP.</Text>
              <Text size="sm" mt="sm">Possible causes:</Text>
              <ul style={{ textAlign: 'left', paddingLeft: '20px' }}>
                <li>Content Security Policy restrictions</li>
                <li>Browser extensions interfering with WebAssembly</li>
                <li>Network issues loading WebAssembly modules</li>
                <li>Incompatible WebAssembly features being used</li>
              </ul>
            </Box>
          )}
        </Box>
      </Center>
    );
  }

  // If WebAssembly is supported, render the children
  return <>{children}</>;
};

export default WasmHandler;
