import { Client, type ClientOptions, type Signer } from "@xmtp/browser-sdk";
import { ReactionCodec } from "@xmtp/content-type-reaction";
import { RemoteAttachmentCodec } from "@xmtp/content-type-remote-attachment";
import { ReplyCodec } from "@xmtp/content-type-reply";
import { TransactionReferenceCodec } from "@xmtp/content-type-transaction-reference";
import { WalletSendCallsCodec } from "@xmtp/content-type-wallet-send-calls";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// Cache key for preventing duplicate client creations
const XMTP_CACHE_KEY_PREFIX = "xmtp:last_client_";

export type InitializeClientOptions = {
  dbEncryptionKey?: Uint8Array;
  env?: ClientOptions["env"];
  loggingLevel?: ClientOptions["loggingLevel"];
  signer: Signer;
  options?: any;
};

export type XMTPContextValue = {
  /**
   * The XMTP client instance
   */
  client?: Client;
  /**
   * Set the XMTP client instance
   */
  setClient: React.Dispatch<React.SetStateAction<Client | undefined>>;
  initialize: (options: InitializeClientOptions) => Promise<Client | undefined>;
  initializing: boolean;
  error: Error | null;
  disconnect: () => void;
};

export const XMTPContext = createContext<XMTPContextValue>({
  setClient: () => { },
  initialize: () => Promise.reject(new Error("XMTPProvider not available")),
  initializing: false,
  error: null,
  disconnect: () => { },
});

export type XMTPProviderProps = React.PropsWithChildren & {
  /**
   * Initial XMTP client instance
   */
  client?: Client;
};

export const XMTPProvider: React.FC<XMTPProviderProps> = ({
  children,
  client: initialClient,
}) => {
  const [client, setClient] = useState<Client | undefined>(initialClient);

  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // client is initializing
  const initializingRef = useRef(false);

  /**
   * Initialize an XMTP client
   */
  const initialize = useCallback(
    async ({
      dbEncryptionKey,
      env,
      loggingLevel,
      signer,
      options,
    }: InitializeClientOptions) => {
      // only initialize a client if one doesn't already exist
      if (!client) {
        // if the client is already initializing, don't do anything
        if (initializingRef.current) {
          return undefined;
        }

        // flag the client as initializing
        initializingRef.current = true;

        // reset error state
        setError(null);
        // reset initializing state
        setInitializing(true);

        let xmtpClient: Client;

        try {
          console.log("Creating XMTP client with signer type:", signer.type);

          // Get identifier to track sessions per address
          const identifier = await signer.getIdentifier();
          const address = identifier?.identifier?.toLowerCase();

          // Check if we already created a client for this address in this session
          if (address) {
            const lastClientCreationTime = localStorage.getItem(XMTP_CACHE_KEY_PREFIX + address);
            const now = Date.now();
            if (lastClientCreationTime) {
              const timeSinceLastCreation = now - parseInt(lastClientCreationTime);
              console.log(`Time since last client creation for ${address}: ${timeSinceLastCreation}ms`);

              // If we created a client for this address less than 1 hour ago, log a warning
              if (timeSinceLastCreation < 60 * 60 * 1000) {
                console.warn(`Creating a new XMTP client for ${address} within 1 hour of the last creation. This may lead to multiple sessions.`);
              }
            }

            // Update the last creation time for this address
            localStorage.setItem(XMTP_CACHE_KEY_PREFIX + address, now.toString());
          }

          // Test the signer's getIdentifier method
          try {
            console.log("Signer identifier:", identifier);

            if (!identifier || !identifier.identifier || !identifier.identifierKind) {
              console.error("WARNING: Signer getIdentifier returned invalid data:", identifier);
            }
          } catch (identifierError) {
            console.error("ERROR: Signer getIdentifier method failed:", identifierError);
          }

          // Test the signer's signMessage method with a test message
          try {
            const testMessage = "XMTP Test Message";
            const testSignature = await signer.signMessage(testMessage);
            console.log("Test signature:", {
              message: testMessage,
              signature: testSignature,
              isUint8Array: testSignature instanceof Uint8Array,
              byteLength: testSignature?.byteLength,
            });
          } catch (signError) {
            console.error("ERROR: Signer signMessage method failed:", signError);
          }

          // Log detailed signer structure
          console.log("Detailed signer info:", {
            type: signer.type,
            hasGetIdentifier: !!signer.getIdentifier,
            hasSignMessage: !!signer.signMessage,
            hasGetChainId: !!(signer as any).getChainId,
            getIdentifierIsAsync: signer.getIdentifier.constructor.name === 'AsyncFunction',
            signMessageIsAsync: signer.signMessage.constructor.name === 'AsyncFunction',
          });

          console.log("Creating XMTP client with config:", {
            env: env || 'production',
            loggingLevel: loggingLevel || 'error',
            hasDbEncryptionKey: !!dbEncryptionKey,
            codecsCount: 5
          });
          
          try {
            // Check if WASM loading was successful
            const wasmStatus = (window as any).wasmLoadingStatus || { attempted: false, successful: false, error: null };
            console.log("XMTP WASM loading status:", wasmStatus);
            
            // If WASM loading failed, we need to handle it
            if (wasmStatus.attempted && !wasmStatus.successful) {
              console.warn("WASM loading was not successful, client creation may fail");
            }
            
            // Set up worker error detection
            let workerErrorOccurred = false;
            const detectWorkerError = () => {
              if ((window as any).wasmLoadingStatus?.error) {
                workerErrorOccurred = true;
                return true;
              }
              
              // Check for console errors related to the worker
              const consoleErrors = (window as any).__xmtp_console_errors || [];
              if (consoleErrors.some((err: string) => 
                err.includes('Worker error') || 
                err.includes('ClientWorkerClass')
              )) {
                workerErrorOccurred = true;
                return true;
              }
              
              return false;
            };
            
            // Initialize console error tracking if not already set up
            if (!(window as any).__xmtp_console_errors) {
              (window as any).__xmtp_console_errors = [];
              const originalConsoleError = console.error;
              console.error = function(...args: any[]) {
                // Call the original console.error
                originalConsoleError.apply(console, args);
                
                // Store the error message
                const errorMessage = args.map(arg => 
                  typeof arg === 'string' ? arg : JSON.stringify(arg)
                ).join(' ');
                (window as any).__xmtp_console_errors.push(errorMessage);
              };
            }
            
            // Create a promise with a timeout to handle potential WASM worker errors
            const clientPromise = Promise.race([
              // Attempt to create the client
              Client.create(signer, {
                env,
                loggingLevel,
                dbEncryptionKey,
                codecs: [
                  new ReactionCodec(),
                  new ReplyCodec(),
                  new RemoteAttachmentCodec(),
                  new TransactionReferenceCodec(),
                  new WalletSendCallsCodec(),
                ],
              }),
              // Set a timeout to prevent hanging
              new Promise((_, reject) => {
                // Check for worker errors periodically
                const errorCheckInterval = setInterval(() => {
                  if (detectWorkerError()) {
                    clearInterval(errorCheckInterval);
                    reject(new Error('XMTP client creation failed due to WASM worker error'));
                  }
                }, 200); // Check more frequently
                
                // Set a longer timeout for client creation
                setTimeout(() => {
                  clearInterval(errorCheckInterval);
                  if (workerErrorOccurred) {
                    reject(new Error('XMTP client creation failed due to worker error'));
                  } else {
                    reject(new Error('XMTP client creation timed out'));
                  }
                }, 20000); // 20 second timeout to give more time for client creation
              })
            ]);
            
            // Wait for either successful client creation or timeout
            xmtpClient = await clientPromise as Client;

            // Log client creation success with safe property access
            console.log("XMTP client created successfully", {
              clientExists: !!xmtpClient,
              hasInboxId: !!xmtpClient?.inboxId,
              // Use the address from the identifier instead
              address: identifier?.identifier ? `${identifier.identifier.substring(0, 10)}...` : 'unknown',
            });
            
            // Set client in state with detailed logging
            console.log("About to set client in state", {
              hasClient: !!xmtpClient,
              hasInboxId: !!xmtpClient?.inboxId,
            });
            
            // Set the client in state
            setClient(xmtpClient);
            console.log("Client successfully set in state");
            
            // Set a flag in localStorage to indicate successful client creation
            localStorage.setItem('xmtp_client_created', 'true');
            
            return xmtpClient;
          } catch (e) {
            console.error("Error creating XMTP client:", e);

            // Provide more detailed diagnostics for "Unknown signer" error
            if (e instanceof Error && e.message === "Unknown signer") {
              console.error("XMTP Unknown signer error detected. This typically means:");
              console.error("1. The signer type is not supported by XMTP");
              console.error("2. The signer implementation is missing required methods");
              console.error("3. The signer implementation is not returning values in the expected format");
              console.error("Please review the docs for a fix @https://docs.xmtp.org/");
            }

            setClient(undefined);
            setError(e as Error);
            // re-throw error for upstream consumption
            throw e;
          } finally {
            initializingRef.current = false;
            setInitializing(false);
          }
        } catch (e) {
          console.error("Error in initialize function:", e);
          initializingRef.current = false;
          setInitializing(false);
          throw e;
        }
      }
      return client;
    },
    [client],
  );

  const disconnect = useCallback(() => {
    if (client) {
      // Before disconnecting, save the client identifier to allow for easier reconnection
      try {
        if (client.inboxId) {
          console.log("Saving client inbox ID for potential reconnection:", client.inboxId);
          localStorage.setItem("xmtp_last_connected_inbox", client.inboxId);
        }
      } catch (error) {
        console.warn("Error saving client inbox ID for reconnection:", error);
      }

      // Clean up localStorage flags
      localStorage.removeItem('xmtp_client_created');
      localStorage.removeItem('xmtp_client_attempted');

      // Close the client connection without losing stored keys
      client.close();
      setClient(undefined);
      console.log("XMTP client disconnected while preserving session data");
    }
  }, [client, setClient]);

  // memo-ize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      client,
      setClient,
      initialize,
      initializing,
      error,
      disconnect,
    }),
    [client, initialize, initializing, error, disconnect],
  );

  return <XMTPContext.Provider value={value}>{children}</XMTPContext.Provider>;
};

export const useXMTP = () => {
  return useContext(XMTPContext);
};
