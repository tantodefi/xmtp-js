import { Badge, TextInput, ActionIcon, Group, Tooltip, useMantineTheme } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { IconEdit, IconCheck, IconX } from "@tabler/icons-react";
import { useLocalStorage } from "@mantine/hooks";
import classes from "./EditableAnonBadge.module.css";

export type EditableAnonBadgeProps = {
  address: string;
  editable?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  conversationId?: string; // Add conversationId prop for per-conversation labels
  isInConversationHeader?: boolean; // Add flag for special styling in conversation view
};

/**
 * A component that displays an editable badge for addresses that don't resolve to ENS or other identity services.
 * The badge defaults to "Anon" but can be edited by the user. The edits persist across sessions.
 */
export const EditableAnonBadge: React.FC<EditableAnonBadgeProps> = ({
  address,
  editable = true,
  size = "sm",
  conversationId,
  isInConversationHeader = false
}) => {
  const theme = useMantineTheme();

  // Console log to check if component is being rendered
  console.log("EditableAnonBadge rendering", {
    address,
    conversationId,
    isInConversationHeader,
    editable
  });

  // Define a type for our custom name entries
  type CustomNameEntry = {
    name: string;
    timestamp: number;
  };

  // Use localStorage to persist custom names for addresses
  // This ensures data persists across sign-ins
  const [customNames, setCustomNames] = useLocalStorage<Record<string, CustomNameEntry>>({
    key: "xmtp_custom_address_names_v2", // Using v2 to avoid conflicts with old format
    defaultValue: {},
    getInitialValueInEffect: false, // Important for SSR compatibility
  });

  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("Anon");
  const inputRef = useRef<HTMLInputElement>(null);
  const addressKey = address ? address.toLowerCase() : "";

  // Generate a storage key - either per-conversation or global
  const getStorageKey = () => {
    if (conversationId) {
      return `${addressKey}_${conversationId}`;
    }
    return addressKey;
  };

  // Load the custom name if it exists, or use "Anon" as default
  useEffect(() => {
    if (!address) return;

    const storageKey = getStorageKey();

    // Add the address to the badge for debugging
    console.log(`[EditableAnonBadge] Loading name for ${address.substring(0, 6)}...${address.substring(address.length - 4)} (conversation: ${conversationId?.substring(0, 6) || 'global'}))`);

    // Check if we have a name for this address in this conversation
    if (customNames[storageKey]) {
      setInputValue(customNames[storageKey].name || "Anon");
      console.log(`[EditableAnonBadge] Loaded custom name for ${storageKey}:`, customNames[storageKey].name);
    }
    // If not, check if we have a global name for this address
    else if (customNames[addressKey]) {
      setInputValue(customNames[addressKey].name || "Anon");
      console.log(`[EditableAnonBadge] Loaded global name for ${addressKey}:`, customNames[addressKey].name);
    }
    // Default to "Anon"
    else {
      setInputValue("Anon");
    }
  }, [address, customNames, addressKey, conversationId]);

  const handleEditStart = () => {
    if (!editable) return;
    setIsEditing(true);
    // Focus the input after rendering
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 50);
  };

  const handleSave = () => {
    const trimmedValue = inputValue.trim();
    const valueToSave = trimmedValue || "Anon";
    const storageKey = getStorageKey();

    console.log("Saving custom name", { storageKey, value: valueToSave });

    // Save to local storage
    setCustomNames((prev) => ({
      ...prev,
      [storageKey]: { name: valueToSave, timestamp: Date.now() }
    }));

    setInputValue(valueToSave);
    setIsEditing(false);
  };

  const handleCancel = () => {
    // Revert to previous value
    const storageKey = getStorageKey();
    if (customNames[storageKey]) {
      setInputValue(customNames[storageKey].name || "Anon");
    } else if (customNames[addressKey]) {
      setInputValue(customNames[addressKey].name || "Anon");
    } else {
      setInputValue("Anon");
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  // Determine appropriate sizes based on badge size
  const getIconSize = () => {
    switch (size) {
      case "xs": return 12;
      case "sm": return 14;
      case "md": return 16;
      case "lg": return 18;
      case "xl": return 20;
      default: return 14;
    }
  };

  if (isEditing) {
    return (
      <Group gap="xs" className={classes.editingContainer}>
        <TextInput
          ref={inputRef}
          size={size}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={(e) => {
            // Only save on blur if not caused by clicking cancel button
            if (e.relatedTarget?.getAttribute('data-action') !== 'cancel') {
              handleSave();
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Anon"
          styles={{
            input: {
              minHeight: "unset",
              height: size === "xs" ? "20px" :
                size === "sm" ? "24px" :
                  size === "md" ? "30px" :
                    size === "lg" ? "36px" : "44px",
              paddingTop: 0,
              paddingBottom: 0,
              fontSize: size === "xs" ? "11px" :
                size === "sm" ? "13px" :
                  size === "md" ? "14px" :
                    size === "lg" ? "16px" : "18px",
              fontWeight: 600,
            },
            wrapper: {
              width: inputValue.length > 0 ? `${Math.min(Math.max(inputValue.length * 10, 80), 200)}px` : "80px",
            }
          }}
        />
        <Group gap="xs">
          <ActionIcon
            size={size}
            color="green"
            onClick={handleSave}
            variant="filled"
            radius="xl"
            aria-label="Save"
          >
            <IconCheck size={getIconSize()} />
          </ActionIcon>
          <ActionIcon
            size={size}
            color="red"
            onClick={handleCancel}
            variant="filled"
            radius="xl"
            aria-label="Cancel"
            data-action="cancel"
          >
            <IconX size={getIconSize()} />
          </ActionIcon>
        </Group>
      </Group>
    );
  }

  return (
    <Tooltip
      label={editable ? "Click to edit label" : ""}
      disabled={!editable}
      position="top"
      withArrow
    >
      <Badge
        color="gray.8"
        variant="filled"
        size={size}
        radius="md"
        className={`${editable ? classes.editableBadge : ""} ${isInConversationHeader ? classes.conversationBadge : ""}`}
        styles={{
          root: {
            cursor: editable ? "pointer" : "default",
            padding: `${size === "xs" ? 3 : 4}px ${size === "xs" ? 7 : 10}px`,
            marginLeft: 6,
            fontWeight: 600,
            letterSpacing: 0.3,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s ease',
            zIndex: isInConversationHeader ? 10 : 'auto',
            '&:hover': editable ? {
              transform: 'translateY(-1px)',
              boxShadow: '0 2px 5px rgba(0, 0, 0, 0.15)'
            } : {}
          },
          label: {
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1.4,
            height: "100%",
            marginTop: "-1px"
          }
        }}
        rightSection={
          editable ? (
            <ActionIcon
              size="xs"
              color="white"
              onClick={(e) => {
                e.stopPropagation();
                handleEditStart();
              }}
              variant="transparent"
              className={classes.editIcon}
              style={{ marginLeft: 4 }}
            >
              <IconEdit size={getIconSize() - 2} />
            </ActionIcon>
          ) : null
        }
        onClick={handleEditStart}
      >
        {inputValue}
      </Badge>
    </Tooltip>
  );
}; 
