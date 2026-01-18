import { createSignal, createMemo, createEffect, onMount, For, Show, createSelector } from 'solid-js';
import styles from './App.module.css';

function encodeState(items: string[], rows: number, cols: number): string {
  const data = { items, rows, cols };
  return btoa(encodeURIComponent(JSON.stringify(data)));
}

function decodeState(hash: string): { items: string[]; rows: number; cols: number } | null {
  try {
    const decoded = JSON.parse(decodeURIComponent(atob(hash)));
    if (decoded.items && Array.isArray(decoded.items) && decoded.rows && decoded.cols) {
      return decoded;
    }
  } catch {
    // Invalid hash
  }
  return null;
}

function updateURL(items: string[], rows: number, cols: number) {
  const hash = encodeState(items, rows, cols);
  window.history.replaceState(null, '', `#${hash}`);
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}


interface AutoSizingTextProps {
  text: string;
}

function AutoSizingText(props: AutoSizingTextProps) {
  let containerRef: HTMLDivElement | undefined;
  let textRef: HTMLSpanElement | undefined;
  const [fontSize, setFontSize] = createSignal(100);

  const measureAndResize = () => {
    if (!containerRef || !textRef || !props.text) return;

    const containerWidth = containerRef.clientWidth;
    const containerHeight = containerRef.clientHeight;

    if (containerWidth === 0 || containerHeight === 0) return;

    // Start with a large font size and decrease until it fits
    let size = Math.min(containerWidth, containerHeight) * 0.4;
    const minSize = 8;
    const step = 1;

    textRef.style.fontSize = `${size}px`;

    while (size > minSize) {
      textRef.style.fontSize = `${size}px`;

      if (textRef.scrollWidth <= containerWidth && textRef.scrollHeight <= containerHeight) {
        break;
      }
      size -= step;
    }

    setFontSize(size);
  };

  createEffect(() => {
    // Re-run when text changes
    props.text;
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(measureAndResize);
  });

  onMount(() => {
    measureAndResize();
    // Also resize on window resize
    const resizeObserver = new ResizeObserver(measureAndResize);
    if (containerRef) {
      resizeObserver.observe(containerRef);
    }
    return () => resizeObserver.disconnect();
  });

  return (
    <div ref={containerRef} class={styles.autoSizeContainer}>
      <span
        ref={textRef}
        class={styles.autoSizeText}
        style={{ 'font-size': `${fontSize()}px` }}
      >
        {props.text}
      </span>
    </div>
  );
}

const App = () => {
  const [text, setText] = createSignal('');
  const [rows, setRows] = createSignal(5);
  const [cols, setCols] = createSignal(5);
  const [shuffledIndices, setShuffledIndices] = createSignal<number[] | null>(null);
  const [playMode, setPlayMode] = createSignal(false);
  const [selected, setSelected] = createSignal<number[]>([]);
  const isSelected = createSelector<number[], number>(selected, (id, list) => list.includes(id));
  const [hasBingo, setHasBingo] = createSignal(false);

  const checkBingo = () => {
    const r = rows();
    const c = cols();

    // Check rows
    for (let row = 0; row < r; row++) {
      let complete = true;
      for (let col = 0; col < c; col++) {
        if (!isSelected(row * c + col)) {
          complete = false;
          break;
        }
      }
      if (complete) return true;
    }

    // Check columns
    for (let col = 0; col < c; col++) {
      let complete = true;
      for (let row = 0; row < r; row++) {
        if (!isSelected(row * c + col)) {
          complete = false;
          break;
        }
      }
      if (complete) return true;
    }

    // Check diagonals (only for square grids)
    if (r === c) {
      // Top-left to bottom-right
      let complete = true;
      for (let i = 0; i < r; i++) {
        if (!isSelected(i * c + i)) {
          complete = false;
          break;
        }
      }
      if (complete) return true;

      // Top-right to bottom-left
      complete = true;
      for (let i = 0; i < r; i++) {
        if (!isSelected(i * c + (c - 1 - i))) {
          complete = false;
          break;
        }
      }
      if (complete) return true;
    }

    return false;
  };

  onMount(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const state = decodeState(hash);
      if (state) {
        setText(state.items.join('\n'));
        setRows(state.rows);
        setCols(state.cols);
      }
    }
  });

  const items = createMemo(() => {
    const lines = text()
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    return lines;
  });

  const gridItems = createMemo(() => {
    const total = rows() * cols();
    const allItems = items();
    const indices = shuffledIndices();

    const result: string[] = [];
    for (let i = 0; i < total; i++) {
      const index = indices ? indices[i] : i;
      result.push(allItems[index] || '');
    }
    return result;
  });

  // Check for bingo whenever selection changes
  createEffect(() => {
    selected(); // track dependency
    setHasBingo(checkBingo());
  });

  const handleTextChange = (value: string) => {
    setText(value);
    updateURL(value.split('\n').map(l => l.trim()).filter(l => l), rows(), cols());
  };

  const handleRowsChange = (value: number) => {
    const clamped = Math.max(1, Math.min(10, value));
    setRows(clamped);
    updateURL(items(), clamped, cols());
    // Reset shuffle when grid size changes
    setShuffledIndices(null);
  };

  const handleColsChange = (value: number) => {
    const clamped = Math.max(1, Math.min(10, value));
    setCols(clamped);
    updateURL(items(), rows(), clamped);
    // Reset shuffle when grid size changes
    setShuffledIndices(null);
  };

  const handleRandomize = () => {
    const total = rows() * cols();
    const indices = Array.from({ length: total }, (_, i) => i);
    setShuffledIndices(shuffleArray(indices));
  };

  const handleCellClick = (index: number) => {
    if (!playMode()) return;

    setSelected(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const handlePlay = () => {
    handleRandomize();
    setPlayMode(true);
    setSelected([]);
    setHasBingo(false);
  };

  const handleRestart = () => {
    if (confirm('Are you sure you want to restart? All progress will be lost.')) {
      handleRandomize();
      setSelected([]);
      setHasBingo(false);
    }
  };

  const handleExitPlay = () => {
    setPlayMode(false);
    setSelected([]);
    setHasBingo(false);
  };

  return (
    <div class={styles.container} classList={{ [styles.playModeContainer]: playMode() }}>
      <div
        class={styles.bingoOverlay}
        classList={{ [styles.bingoOverlayVisible]: hasBingo() }}
        onClick={() => setHasBingo(false)}
      >
        <div class={styles.bingoText}>BINGO!</div>
      </div>

      <Show when={!playMode()}>
        <div class={styles.sidebar}>
          <div class={styles.buttons}>
            <button class={styles.button} onClick={handleRandomize}>
              Randomize
            </button>
            <button class={styles.button} onClick={handlePlay}>
              Play
            </button>
          </div>

          <div class={styles.controls}>
            <div class={styles.inputGroup}>
              <label>Rows:</label>
              <input
                type="number"
                min="1"
                max="10"
                value={rows()}
                onInput={(e) => handleRowsChange(parseInt(e.currentTarget.value) || 1)}
              />
            </div>
            <div class={styles.inputGroup}>
              <label>Columns:</label>
              <input
                type="number"
                min="1"
                max="10"
                value={cols()}
                onInput={(e) => handleColsChange(parseInt(e.currentTarget.value) || 1)}
              />
            </div>
          </div>

          <div class={styles.count}>
            {items().length} / {rows() * cols()} items
          </div>

          <textarea
            class={styles.textarea}
            placeholder="Enter one item per line..."
            value={text()}
            onInput={(e) => handleTextChange(e.currentTarget.value)}
          />
        </div>
      </Show>

      <Show when={playMode()}>
        <div class={styles.playControls}>
          <button class={styles.button} onClick={handleRestart}>
            Restart
          </button>
          <button class={styles.button} onClick={handleExitPlay}>
            Exit
          </button>
        </div>
      </Show>

      <div class={styles.gridContainer}>
        <div
          class={styles.grid}
          classList={{ [styles.gridPlayMode]: playMode() }}
          style={{
            'grid-template-columns': `repeat(${cols()}, 1fr)`,
            'grid-template-rows': `repeat(${rows()}, 1fr)`,
          }}
        >
          <For each={gridItems()}>
            {(item, index) => (
              <div
                class={styles.cell}
                classList={{
                  [styles.cellClickable]: playMode(),
                  [styles.cellSelected]: isSelected(index()),
                }}
                onClick={() => handleCellClick(index())}
              >
                <AutoSizingText text={item} />
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
};

export default App;
