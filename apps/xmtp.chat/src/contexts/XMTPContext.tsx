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
  setClient: () => {},
  initialize: () => Promise.reject(new Error("XMTPProvider not available")),
  initializing: false,
  error: null,
  disconnect: () => {},
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
          
          // create a new XMTP client
          xmtpClient = await Client.create(signer, {
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
          });
          
          console.log("XMTP client created successfully");
          setClient(xmtpClient);
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

        return xmtpClient;
      }
      return client;
    },
    [client],
  );

  const disconnect = useCallback(() => {
    if (client) {
      client.close();
      setClient(undefined);
      console.log("XMTP client disconnected");
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
