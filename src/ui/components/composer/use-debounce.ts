// use-debounce.ts - Non-bracketed paste coalescing (Termux + Gboard).
// Each Enter is buffered; debounce timer decides send vs coalesced insert.

import { useRef, useEffect, type RefObject } from 'react';
import type { TextareaRenderable } from '@opentui/core';
import { normalizeForSend } from './normalize.js';

const PASTE_DEBOUNCE_MS = 40;

export function useDebouncedSubmit(
  editorRef: RefObject<TextareaRenderable | null>,
  onSubmit: (text: string) => boolean,
  setNotConnected: (v: boolean) => void,
) {
  const pendingLinesRef = useRef<string[]>([]);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPending = (): void => {
    const editor = editorRef.current;
    if (!editor) {
      pendingLinesRef.current = [];
      if (pendingTimerRef.current) { clearTimeout(pendingTimerRef.current); pendingTimerRef.current = null; }
      return;
    }
    const lines = pendingLinesRef.current;
    const rawRemaining = editor.plainText;
    const remaining = normalizeForSend(rawRemaining);
    const remainingText = remaining.trim() === '' ? '' : remaining;
    const hasLines = lines.length > 0;
    const hasRemainingText = remainingText !== '';
    if (!hasLines && !hasRemainingText) {
      pendingLinesRef.current = [];
      if (pendingTimerRef.current) { clearTimeout(pendingTimerRef.current); pendingTimerRef.current = null; }
      return;
    }
    const snapshot = [...lines];
    pendingLinesRef.current = [];
    if (pendingTimerRef.current) { clearTimeout(pendingTimerRef.current); pendingTimerRef.current = null; }
    const totalEntries = snapshot.length + (hasRemainingText ? 1 : 0);
    if (totalEntries > 1) {
      const all = [...snapshot];
      if (hasRemainingText) all.push(remainingText);
      const joined = all.join('\n');
      editor.clear();
      if (joined) editor.insertText(joined);
      setNotConnected(false);
      return;
    }
    const singleText = snapshot.length === 1 ? snapshot[0] : remainingText;
    if (!singleText || singleText.trim() === '') return;
    if (onSubmit(singleText)) {
      editor.clear();
      setNotConnected(false);
    } else {
      editor.clear();
      editor.insertText(singleText);
      setNotConnected(true);
    }
  };

  useEffect(() => () => {
    if (pendingTimerRef.current) { clearTimeout(pendingTimerRef.current); pendingTimerRef.current = null; }
  }, []);

  const bufferLine = (text: string): void => {
    const editor = editorRef.current;
    if (!editor) return;
    pendingLinesRef.current.push(text);
    editor.clear();
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(flushPending, PASTE_DEBOUNCE_MS);
  };

  const bufferBlank = (): void => {
    const editor = editorRef.current;
    if (!editor) return;
    pendingLinesRef.current.push('');
    editor.clear();
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(flushPending, PASTE_DEBOUNCE_MS);
  };

  const hasPending = (): boolean => pendingLinesRef.current.length > 0 || pendingTimerRef.current !== null;

  return { bufferLine, bufferBlank, hasPending, flushPending, pendingLinesRef, pendingTimerRef };
}
