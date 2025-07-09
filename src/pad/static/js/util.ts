export function getBasePath() {
  // The path is in the form of .../p/id or .../t/title, so get the part before that
  const path = window.location.pathname;
  let index = path.indexOf("/p/");
  if (index < 0) {
    index = path.indexOf("/t/");
    if (index < 0) {
      console.warn("Base path not found", path);
      // remove the last part of the path
      const lastSlash = path.lastIndexOf("/");
      if (lastSlash >= 0) {
        return path.substring(0, lastSlash);
      } else {
        return "";
      }
    }
  }
  return path.substring(0, index);
}

// Keyboard utility functions
export type KeyCombination = {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  cmd: boolean;
  key: string;
};

const VALID_MODIFIERS = new Set([
  "ctrl", "control",
  "shift", 
  "alt", "option",
  "cmd", "command", "meta"
]);

export function parseKeyCombination(keyCombination: string): KeyCombination {
  if (!keyCombination || typeof keyCombination !== "string") {
    throw new Error("Key combination must be a non-empty string");
  }

  const parts = keyCombination.split("+").map(part => part.trim());
  
  if (parts.length === 0) {
    throw new Error("Key combination cannot be empty");
  }

  const result: KeyCombination = {
    ctrl: false,
    shift: false,
    alt: false,
    cmd: false,
    key: "",
  };

  let keyFound = false;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    if (!part) {
      throw new Error("Key combination cannot contain empty parts");
    }

    const lowerPart = part.toLowerCase();
    
    if (VALID_MODIFIERS.has(lowerPart)) {
      // This is a modifier
      if (keyFound) {
        throw new Error(`Modifier "${part}" must come before the key`);
      }
      
      switch (lowerPart) {
        case "ctrl":
        case "control":
          if (result.ctrl) {
            console.warn(`Duplicate modifier: ${part}`);
          }
          result.ctrl = true;
          break;
        case "shift":
          if (result.shift) {
            console.warn(`Duplicate modifier: ${part}`);
          }
          result.shift = true;
          break;
        case "alt":
        case "option":
          if (result.alt) {
            console.warn(`Duplicate modifier: ${part}`);
          }
          result.alt = true;
          break;
        case "cmd":
        case "command":
        case "meta":
          if (result.cmd) {
            console.warn(`Duplicate modifier: ${part}`);
          }
          result.cmd = true;
          break;
      }
    } else {
      // This should be the key
      if (keyFound) {
        throw new Error(`Multiple keys found: "${result.key}" and "${part}". Only one key is allowed.`);
      }
      
      if (i !== parts.length - 1) {
        throw new Error(`Key "${part}" must be the last part of the combination`);
      }
      
      if (part.length !== 1) {
        throw new Error(`Key must be a single character, got: "${part}"`);
      }
      
      result.key = part.toUpperCase();
      keyFound = true;
    }
  }
  
  if (!keyFound) {
    throw new Error("Key combination must contain at least one key");
  }
  
  return result;
}

export function matchesKeyEvent(
  event: KeyboardEvent,
  combination: KeyCombination
): boolean {
  // Check modifiers
  if (combination.ctrl && !event.ctrlKey) return false;
  if (combination.shift && !event.shiftKey) return false;
  if (combination.alt && !event.altKey) return false;
  if (combination.cmd && !event.metaKey) return false;
  
  // Check that non-required modifiers are not pressed
  if (!combination.ctrl && event.ctrlKey) return false;
  if (!combination.shift && event.shiftKey) return false;
  if (!combination.alt && event.altKey) return false;
  if (!combination.cmd && event.metaKey) return false;
  
  // Check the key
  const eventKey = event.key
    ? event.key.toUpperCase()
    : String.fromCharCode(event.which || event.keyCode).toUpperCase();
  
  return eventKey === combination.key;
}
