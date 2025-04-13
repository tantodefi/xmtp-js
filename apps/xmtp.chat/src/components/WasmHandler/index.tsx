import { ReactNode, useEffect, useState } from 'react';
import { Text, Button, Group, Stack } from '@mantine/core';

type WasmHandlerProps = {
  children: ReactNode;
};

/**
 * Component that handles WASM loading errors and provides 
 * a fallback UI and retry functionality
 */
export default function WasmHandler({ children }: WasmHandlerProps) {
  const [wasmError, setWasmError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // Check for WASM loading errors in the window object
    const checkForWasmErrors = () => {
      const errors = window.console.error;
      const originalConsoleError = window.console.error;

      // Override console.error to catch WASM-related errors
      window.console.error = (...args: any[]) => {
        const errorMessage = args.join(' ');
        if (
          errorMessage.includes('@xmtp/wasm-bindings') ||
          errorMessage.includes('module specifier') ||
          errorMessage.includes('WebAssembly')
        ) {
          setWasmError(new Error(errorMessage));
        }
        originalConsoleError.apply(console, args);
      };

      return () => {
        window.console.error = originalConsoleError;
      };
    };

    const cleanup = checkForWasmErrors();
    return cleanup;
  }, [retryCount]);

  const handleRetry = () => {
    setWasmError(null);
    setRetryCount(prev => prev + 1);

    // Force reload the page to retry WASM loading
    window.location.reload();
  };

  // If there's a WASM error, show a helpful message
  if (wasmError) {
    return (
      <Stack align="center" justify="center" style={{ height: '100vh', padding: '2rem' }}>
        <Text size="xl" fw={700}>WebAssembly Loading Issue</Text>
        <Text>There was an error loading the required WebAssembly modules</Text>
        <Text size="sm" c="dimmed" style={{ maxWidth: '600px', textAlign: 'center' }}>
          This could be due to Content Security Policy restrictions or network issues.
          The XMTP chat app uses WebAssembly for secure messaging functionality.
        </Text>
        <Group mt="xl">
          <Button onClick={handleRetry}>Retry Loading</Button>
        </Group>
      </Stack>
    );
  }

  // No error, render children normally
  return <>{children}</>;
} 
